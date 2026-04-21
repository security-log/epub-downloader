/**
 * EPUB Download Module
 * Contains all the logic for downloading and building EPUB files from O'Reilly
 */

console.log('Download module loaded');

const API_BASE = 'https://learning.oreilly.com';
const CONCURRENCY = 10;
const STAGGER_MS = 50;
const RATE_LIMIT_DELAY = 100;
const PRE_COMPRESSED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function zipOptions(mediaType) {
  if (PRE_COMPRESSED_TYPES.has(mediaType)) {
    return { compression: 'STORE' };
  }
  return {};
}

/**
 * Download EPUB from O'Reilly
 * @param {Object} bookData - Book info from content script
 * @param {Object} options - { useCache: true, forceRefresh: false, rebuildOnly: false }
 * @param {Function} [onProgress] - Callback (current, total, message) for progress updates
 */
async function downloadEPUB(bookData, options = { useCache: true, forceRefresh: false }, onProgress) {
  console.log('Starting EPUB download for:', bookData.title);

  // Local closure — no global state access (REL-02, D-06)
  const sendProgress = (current, total, message) => {
    if (typeof onProgress === 'function') {
      onProgress(current, total, message);
    }
    browser.runtime.sendMessage({
      type: 'DOWNLOAD_PROGRESS',
      current,
      total,
      message
    }).catch(() => {
      // Popup might be closed, ignore error
    });
  };

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

    // Construct the JSZip instance that will accumulate all files (PERF-01)
    const zip = new JSZip();

    // rebuildOnly: assemble EPUB from IndexedDB, no network (BUG-04, D-03, D-04)
    if (options.rebuildOnly) {
      sendProgress(10, 100, 'Checking cache...');

      const manifest = await BookCache.getFileManifest(bookOurn);
      if (!manifest) {
        throw new Error(
          'Rebuild failed: no file manifest found for this book. ' +
          'Download the book normally first to populate the cache.'
        );
      }

      const cachedPaths = await BookCache.getCachedFilePaths(bookOurn);
      const missingFiles = manifest.filter(url => !cachedPaths.has(url));
      if (missingFiles.length > 0) {
        throw new Error(
          `Rebuild failed: ${missingFiles.length} file(s) missing from cache:\n` +
          missingFiles.join('\n')
        );
      }

      sendProgress(50, 100, `Building EPUB from ${cachedPaths.size} cached files...`);
      // mimetype MUST be first and MUST use STORE (EPUB spec requirement)
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
      // buildEPUB loads all cached files directly from IndexedDB
      const epubBlob = await buildEPUB(zip, bookOurn);
      sendProgress(95, 100, 'Saving file...');
      const filename = sanitizeFilename(`${metadata.title}-${metadata.isbn}.epub`);
      await saveFile(epubBlob, filename);
      await addToHistory(metadata, bookOurn, filename, []);
      sendProgress(100, 100, 'Download complete!');
      return { success: true, filename, failedFiles: [], fromCache: cachedPaths.size };
    }

    sendProgress(10, 100, 'Getting file list...');
    const files = await getAllFiles(metadata.files, bookData.jwtToken);
    console.log(`Found ${files.length} files to download`);

    // Persist expected file list so rebuildOnly can diff against cache (BUG-04, D-04)
    await BookCache.storeFileManifest(bookOurn, files.map(f => f.full_path));

    let filesToDownload = files;
    let fromCache = 0;

    if (options.useCache && !options.forceRefresh) {
      // Single IDB pass to check cache (PERF-03: getCachedFilePaths replaces getCachedFilePaths+getFiles)
      const cachedPaths = await BookCache.getCachedFilePaths(bookOurn);
      if (cachedPaths.size > 0) {
        fromCache = cachedPaths.size;
        sendProgress(15, 100, `Found ${fromCache}/${files.length} files in cache`);
        filesToDownload = files.filter(f => !cachedPaths.has(f.full_path));
      }
    }

    const downloadMsg = fromCache > 0
      ? `Downloading ${filesToDownload.length} files (${fromCache} cached)...`
      : `Downloading ${filesToDownload.length} files...`;
    sendProgress(20, 100, downloadMsg);

    const { failedFiles } = await downloadAllFiles(
      zip, filesToDownload, bookData.jwtToken, metadata, bookOurn, files.length, fromCache, sendProgress
    );

    const totalCached = fromCache + filesToDownload.length - failedFiles.length;
    await BookCache.saveBookMeta(bookOurn, {
      ...metadata,
      fileCount: files.length,
      cachedFileCount: totalCached,
      complete: failedFiles.length === 0
    });

    sendProgress(90, 100, 'Building EPUB file...');
    const epubBlob = await buildEPUB(zip, bookOurn);

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
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };

  const firstUrl = `${API_BASE}/api/v2/epubs/${identifier}/`;
  const firstResponse = await fetchWithRetry(firstUrl, { headers });

  if (firstResponse.ok) {
    return await firstResponse.json();
  }

  if (identifier.includes(':book:')) {
    const articleUrn = identifier.replace(':book:', ':article:');
    const secondUrl = `${API_BASE}/api/v2/epubs/${articleUrn}/`;
    const secondResponse = await fetchWithRetry(secondUrl, { headers });

    if (secondResponse.ok) {
      return await secondResponse.json();
    }
    throw new Error(`Failed to fetch metadata: ${secondResponse.status}`);
  }

  throw new Error(`Failed to fetch metadata: ${firstResponse.status}`);
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
    const rawNext = data.next;
    if (rawNext != null) {
      if (typeof rawNext !== 'string') {
        throw new Error(`Unexpected pagination URL type: ${typeof rawNext}`);
      }
      const nextHostname = new URL(rawNext).hostname;
      if (!nextHostname.endsWith('.oreilly.com') && nextHostname !== 'learning.oreilly.com') {
        throw new Error(`Pagination URL left oreilly.com domain: ${rawNext}`);
      }
    }
    nextUrl = rawNext ?? null;

    await sleep(RATE_LIMIT_DELAY);
  }

  return allFiles;
}

/**
 * Download all files using concurrency pool with retry
 */
async function downloadAllFiles(zip, files, jwtToken, metadata, bookOurn, totalFileCount, fromCache, sendProgress) {
  const failedFiles = [];
  let completedFiles = fromCache;

  // mimetype MUST be added first and MUST use STORE (EPUB spec requirement)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

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
    const fullPath = `OEBPS/${sanitizeZipPath(file.full_path)}`;
    let processedContent = content;

    const isHTML = file.media_type === 'application/xhtml+xml' || file.media_type === 'text/html';
    if (isHTML && typeof content === 'string') {
      processedContent = cleanHTML(content, metadata.ourn || bookOurn, file.full_path);
    }

    if (file.media_type === 'application/oebps-package+xml') {
      zip.file('META-INF/container.xml', generateContainerXml(fullPath), { compression: 'STORE' });
    }

    zip.file(fullPath, processedContent, zipOptions(file.media_type));

    BookCache.saveFile(bookOurn, file.full_path, {
      content: processedContent,
      mediaType: file.media_type,
      kind: file.kind
    }).catch(err => console.warn('Cache write failed for', file.full_path, err));

    sendProgress(progress, 100, `Downloaded ${completedFiles}/${totalFileCount} files`);
  };

  await pool.run(tasks, onComplete);

  zip.file('META-INF/com.apple.ibooks.display-options.xml', `<?xml version="1.0" encoding="UTF-8"?>
<display_options>
  <platform name="*">
    <option name="specified-fonts">true</option>
  </platform>
</display_options>`, {});

  return { failedFiles };
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

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

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
    <rootfile full-path="${escapeXml(opfPath)}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/**
 * Build EPUB file from downloaded content
 */
async function buildEPUB(zip, ourn) {
  console.log('Building EPUB, loading cached files...');

  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip library not loaded');
  }

  // Load cached files one at a time from IndexedDB (PERF-01: no Map accumulation)
  // cachedPaths and filesToDownload are disjoint by construction — no duplicate check needed
  const cached = await BookCache.getCachedFiles(ourn);
  for (const [fullPath, fileData] of cached) {
    const zipPath = `OEBPS/${sanitizeZipPath(fullPath)}`;
    zip.file(zipPath, fileData.content, zipOptions(fileData.mediaType));

    if (fileData.mediaType === 'application/oebps-package+xml') {
      zip.file('META-INF/container.xml', generateContainerXml(zipPath), { compression: 'STORE' });
    }
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
  // SEC-02: use DOMParser to remove script elements structurally
  // BUG-02: do NOT remove <link> elements — stylesheets must survive
  const doc = new DOMParser().parseFromString(content, 'text/html');
  doc.querySelectorAll('script').forEach(el => el.remove());
  content = doc.documentElement.outerHTML;

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
  let downloadStarted = false;

  try {
    await browser.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
    downloadStarted = true;
    // Browser download manager needs the URL alive briefly; revoke after 10 s
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally {
    if (!downloadStarted) {
      // Exception thrown before or during download — revoke immediately
      URL.revokeObjectURL(url);
    }
  }
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
 * Sanitize filename for download
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

/**
 * Escape special XML characters in a string to prevent XML injection
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sanitize a path from the API to prevent ZIP path traversal.
 * Removes backslashes, collapses '.' and '..' segments, and strips
 * any leading slash so the result is always a relative path.
 */
function sanitizeZipPath(p) {
  return String(p)
    .replace(/\\/g, '/')
    .split('/')
    .filter(seg => seg !== '..' && seg !== '.' && seg !== '')
    .join('/');
}
