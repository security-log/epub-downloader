/**
 * EPUB Download Module
 * Contains all the logic for downloading and building EPUB files from O'Reilly
 */

console.log('Download module loaded');

const API_BASE = 'https://learning.oreilly.com';
const CONCURRENCY = 10;
const STAGGER_MS = 50;
const RATE_LIMIT_DELAY = 100;

/**
 * Download EPUB from O'Reilly
 * @param {Object} bookData - Book info from content script
 * @param {Object} options - { useCache: true, forceRefresh: false }
 */
async function downloadEPUB(bookData, options = { useCache: true, forceRefresh: false }) {
  console.log('Starting EPUB download for:', bookData.title);
  const ourn = bookData.ourn || bookData.isbn;

  try {
    let metadata;
    if (options.useCache && !options.forceRefresh) {
      const cached = await BookCache.getBookMeta(ourn);
      if (cached) {
        metadata = cached.metadata;
        sendProgress(5, 100, 'Using cached metadata...');
      }
    }
    if (!metadata) {
      sendProgress(0, 100, 'Fetching book metadata...');
      metadata = await getBookMetadata(ourn, bookData.jwtToken);
      if (!metadata) throw new Error('Could not fetch book metadata');
    }

    console.log('Metadata:', metadata);
    const bookOurn = metadata.ourn || ourn;

    await BookCache.saveBookMeta(bookOurn, {
      ...metadata,
      fileCount: 0,
      cachedFileCount: 0,
      complete: false
    });

    sendProgress(10, 100, 'Getting file list...');
    const files = await getAllFiles(metadata.files, bookData.jwtToken);
    console.log(`Found ${files.length} files to download`);

    let cachedFiles = new Map();
    let filesToDownload = files;
    let fromCache = 0;

    if (options.useCache && !options.forceRefresh) {
      const cachedPaths = await BookCache.getCachedFilePaths(bookOurn);
      if (cachedPaths.size > 0) {
        fromCache = cachedPaths.size;
        sendProgress(15, 100, `Found ${fromCache}/${files.length} files in cache`);

        const cachedEntries = await BookCache.getFiles(bookOurn);
        for (const entry of cachedEntries) {
          cachedFiles.set(entry.fullPath, entry);
        }

        filesToDownload = files.filter(f => !cachedPaths.has(f.full_path));
      }
    }

    const downloadMsg = fromCache > 0
      ? `Downloading ${filesToDownload.length} files (${fromCache} cached)...`
      : `Downloading ${filesToDownload.length} files...`;
    sendProgress(20, 100, downloadMsg);

    const { downloaded, failedFiles } = await downloadAllFiles(
      filesToDownload, bookData.jwtToken, metadata, bookOurn, files.length, fromCache
    );

    for (const [path, entry] of cachedFiles) {
      const fullPath = `OEBPS/${path}`;
      if (!downloaded.has(fullPath)) {
        downloaded.set(fullPath, {
          content: entry.content,
          mediaType: entry.mediaType,
          kind: entry.kind
        });

        if (entry.mediaType === 'application/oebps-package+xml') {
          downloaded.set('META-INF/container.xml', {
            content: generateContainerXml(fullPath),
            mediaType: 'application/xml'
          });
        }
      }
    }

    const totalCached = fromCache + filesToDownload.length - failedFiles.length;
    await BookCache.saveBookMeta(bookOurn, {
      ...metadata,
      fileCount: files.length,
      cachedFileCount: totalCached,
      complete: failedFiles.length === 0
    });

    sendProgress(90, 100, 'Building EPUB file...');
    const epubBlob = await buildEPUB(downloaded);

    sendProgress(95, 100, 'Saving file...');
    const filename = sanitizeFilename(`${metadata.title}-${metadata.isbn}.epub`);
    await saveFile(epubBlob, filename);

    await addToHistory(metadata, bookOurn, filename, failedFiles);

    sendProgress(100, 100, 'Download complete!');
    return { success: true, filename, failedFiles, fromCache };

  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

/**
 * Get book metadata from API
 */
async function getBookMetadata(identifier, jwtToken) {
  const url = `${API_BASE}/api/v2/epubs/${identifier}/`;

  const response = await fetchWithRetry(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    }
  });

  if (!response.ok) {
    if (identifier.includes(':book:')) {
      const articleUrn = identifier.replace(':book:', ':article:');
      return getBookMetadata(articleUrn, jwtToken);
    }
    throw new Error(`Failed to fetch metadata: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get all files from the book (handles pagination)
 */
async function getAllFiles(filesUrl, jwtToken) {
  let allFiles = [];
  let nextUrl = filesUrl;

  while (nextUrl) {
    const response = await fetchWithRetry(nextUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.status}`);
    }

    const data = await response.json();
    allFiles = allFiles.concat(data.results);
    nextUrl = data.next;

    await sleep(RATE_LIMIT_DELAY);
  }

  return allFiles;
}

/**
 * Download all files using concurrency pool with retry
 */
async function downloadAllFiles(files, jwtToken, metadata, bookOurn, totalFileCount, fromCache) {
  const downloaded = new Map();
  const failedFiles = [];
  let completedFiles = fromCache;

  downloaded.set('mimetype', {
    content: 'application/epub+zip',
    mediaType: 'text/plain',
    uncompressed: true
  });

  const pool = new ConcurrencyPool(CONCURRENCY, STAGGER_MS);

  const tasks = files.map((file) => async () => {
    const content = await downloadFileWithRetry(file.url, jwtToken);
    return { file, content };
  });

  const onComplete = (idx, result, error) => {
    completedFiles++;
    const progress = 20 + Math.round((completedFiles / totalFileCount) * 70);

    if (error) {
      failedFiles.push({ path: files[idx].full_path, error: error.message });
      sendProgress(progress, 100, `Downloaded ${completedFiles}/${totalFileCount} files (${failedFiles.length} failed)`);
      return;
    }

    const { file, content } = result;
    const fullPath = `OEBPS/${file.full_path}`;
    let processedContent = content;

    const isHTML = file.media_type === 'application/xhtml+xml' || file.media_type === 'text/html';
    if (isHTML && typeof content === 'string') {
      processedContent = cleanHTML(content, metadata.ourn || bookOurn, file.full_path);
    }

    if (file.media_type === 'application/oebps-package+xml') {
      downloaded.set('META-INF/container.xml', {
        content: generateContainerXml(fullPath),
        mediaType: 'application/xml'
      });
    }

    downloaded.set(fullPath, {
      content: processedContent,
      mediaType: file.media_type,
      kind: file.kind
    });

    BookCache.saveFile(bookOurn, file.full_path, {
      content: processedContent,
      mediaType: file.media_type,
      kind: file.kind
    }).catch(err => console.warn('Cache write failed for', file.full_path, err));

    sendProgress(progress, 100, `Downloaded ${completedFiles}/${totalFileCount} files`);
  };

  await pool.run(tasks, onComplete);

  downloaded.set('META-INF/com.apple.ibooks.display-options.xml', {
    content: `<?xml version="1.0" encoding="UTF-8"?>
<display_options>
  <platform name="*">
    <option name="specified-fonts">true</option>
  </platform>
</display_options>`,
    mediaType: 'application/xml'
  });

  return { downloaded, failedFiles };
}

/**
 * Download a single file with retry
 */
async function downloadFileWithRetry(url, jwtToken) {
  const response = await fetchWithRetry(url, {
    headers: {
      'Accept': '*/*',
      'Authorization': `Bearer ${jwtToken}`
    }
  });

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text') || contentType.includes('xml') || contentType.includes('json')) {
    return await response.text();
  }
  return await response.arrayBuffer();
}

/**
 * Generate container.xml pointing to the content.opf
 */
function generateContainerXml(opfPath) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/**
 * Build EPUB file from downloaded content
 */
async function buildEPUB(files) {
  console.log('Building EPUB with', files.size, 'files');

  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip library not loaded');
  }

  const zip = new JSZip();

  for (const [path, fileData] of files) {
    const { content, uncompressed } = fileData;
    const options = {};
    if (path === 'mimetype' || uncompressed) {
      options.compression = 'STORE';
    }
    zip.file(path, content, options);
  }

  console.log('Generating EPUB ZIP...');
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  console.log('EPUB created successfully, size:', blob.size);
  return blob;
}

/**
 * Clean HTML content and fix relative paths
 */
function cleanHTML(content, ourn, filePath) {
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  content = content.replace(/<link[^>]*>/gi, '');

  if (ourn) {
    const apiPath = `/api/v2/epubs/${ourn}/files/`;
    content = content.replaceAll(apiPath, '');
  }

  const depth = (filePath.match(/\//g) || []).length;
  const relativePrefix = '../'.repeat(depth);

  const selfClosingTags = ['img', 'br', 'hr', 'col', 'input', 'meta'];
  selfClosingTags.forEach(tag => {
    const regex = new RegExp(`<${tag}([^>]*[^/])>`, 'gi');
    content = content.replace(regex, (match) => {
      let fixed = match.replace('>', '/>');
      if (tag === 'img' && relativePrefix) {
        fixed = fixed.replace(/src="(?!http|data:|\/)/gi, `src="${relativePrefix}`);
      }
      return fixed;
    });
  });

  content = content.replace(/<image([^>]*)href="(?!http)/gi, `<image$1href="${relativePrefix}`);

  return content;
}

/**
 * Save file using browser downloads API
 */
async function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);

  await browser.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });

  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Add entry to download history in browser.storage.local
 */
async function addToHistory(metadata, ourn, filename, failedFiles) {
  try {
    const { downloadHistory = [] } = await browser.storage.local.get('downloadHistory');
    const filtered = downloadHistory.filter(h => h.ourn !== ourn);
    filtered.unshift({
      ourn,
      title: metadata.title,
      isbn: metadata.isbn,
      downloadedAt: Date.now(),
      filename,
      failedCount: failedFiles.length
    });
    await browser.storage.local.set({ downloadHistory: filtered.slice(0, 100) });
  } catch (err) {
    console.warn('Failed to save download history:', err);
  }
}

/**
 * Send progress update to UI
 */
function sendProgress(current, total, message) {
  browser.runtime.sendMessage({
    type: 'DOWNLOAD_PROGRESS',
    current,
    total,
    message
  }).catch(() => {
    // Popup might be closed, ignore error
  });
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
