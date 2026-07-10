/**
 * EPUB Download Module
 * Contains all the logic for downloading and building EPUB files from O'Reilly
 * Also handles PDF conversion from cached EPUB content.
 */

console.log('Download module loaded');

// Default API base — may be overridden per-book when user is on a proxy domain
const DEFAULT_API_BASE = 'https://learning.oreilly.com';
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

  // Derive API base from the page URL so proxy users fetch through the proxy
  const apiBase = apiBaseFromUrl(bookData.url || '');

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
      metadata = await getBookMetadata(ourn, bookData.jwtToken, apiBase);
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
    const files = await getAllFiles(metadata.files, bookData.jwtToken, apiBase);
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
      zip, filesToDownload, bookData.jwtToken, metadata, bookOurn, files.length, fromCache, sendProgress, apiBase
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
 * Derive the API base URL from the book's page URL.
 * If the user is browsing through a library proxy, API calls must
 * go through the same proxy host.
 */
function apiBaseFromUrl(pageUrl) {
  if (!pageUrl) return DEFAULT_API_BASE;
  try {
    const parsed = new URL(pageUrl);
    // If the hostname isn't an oreilly.com domain, it's a proxy — use it
    if (!parsed.hostname.endsWith('.oreilly.com')) {
      return `${parsed.protocol}//${parsed.hostname}`;
    }
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return DEFAULT_API_BASE;
  }
}

/**
 * Get book metadata from API
 */
async function getBookMetadata(identifier, jwtToken, apiBase = DEFAULT_API_BASE) {
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };

  const firstUrl = `${apiBase}/api/v2/epubs/${identifier}/`;
  const firstResponse = await fetchWithRetry(firstUrl, { headers });

  if (firstResponse.ok) {
    return await firstResponse.json();
  }

  if (identifier.includes(':book:')) {
    const articleUrn = identifier.replace(':book:', ':article:');
    const secondUrl = `${apiBase}/api/v2/epubs/${articleUrn}/`;
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
 * @param {string} filesUrl - URL to fetch files from (absolute)
 * @param {string} jwtToken - JWT for auth
 * @param {string} apiBase - Base API URL (e.g., https://learning.oreilly.com or proxy)
 */
async function getAllFiles(filesUrl, jwtToken, apiBase = DEFAULT_API_BASE) {
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
      const nextUrlObj = new URL(rawNext);
      const nextHostname = nextUrlObj.hostname;
      const apiBaseHost = new URL(apiBase).hostname;
      // Allow oreilly.com domains or the same proxy host as apiBase
      if (!nextHostname.endsWith('.oreilly.com') && nextHostname !== apiBaseHost) {
        throw new Error(`Pagination URL left expected domain: ${rawNext}`);
      }
    }

    nextUrl = rawNext ?? null;
    if (nextUrl) await sleep(RATE_LIMIT_DELAY);
  }

  return allFiles;
}

/**
 * Download all files using concurrency pool with retry
 */
async function downloadAllFiles(zip, files, jwtToken, metadata, bookOurn, totalFileCount, fromCache, sendProgress, apiBase = DEFAULT_API_BASE) {
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
    console.log(`Processing ${fullPath}: media_type=${file.media_type}, isHTML=${isHTML}, contentType=${typeof content}`);

    if (isHTML && typeof content === 'string') {
      processedContent = cleanHTML(content, metadata.ourn || bookOurn, file.full_path);
    } else if (isHTML && typeof content !== 'string') {
      console.error('HTML file received non-string content:', typeof content, fullPath);
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
 * Clean HTML content and fix relative paths.
 * Uses regex (not DOMParser) so it works in Chrome MV3 service workers.
 */
function cleanHTML(content, ourn, filePath) {
  // Remove script tags — regex approach works in service workers
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Check if this is a full XHTML document or a content fragment
  const isFullDoc = /<html\b/i.test(content);

  if (!isFullDoc) {
    // Content fragment — wrap in a proper XHTML document for Apple Books compatibility
    // Extract XML namespaces from the root element
    const rootNSMatch = content.match(/<[a-zA-Z][\w.-]*\s+((?:xmlns(?::\w+)?\s*=\s*"[^"]*"\s*)*)/);
    content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:m="http://www.w3.org/1998/Math/MathML">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body>
${content}
</body>
</html>`;
  } else {
    // Full document — ensure epub namespace is declared
    if (!/xmlns:epub/i.test(content)) {
      content = content.replace(/<html\b/i, '<html xmlns:epub="http://www.idpf.org/2007/ops"');
    }
  }

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
/**
 * Save file using browser downloads API.
 * Converts Blob to base64 data URI since Chrome MV3 service workers
 * don't support URL.createObjectURL.
 */
async function saveFile(blob, filename) {
  let downloadStarted = false;
  let dataUrl = null;

  try {
    dataUrl = await blobToDataUrl(blob);
    await browser.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    });
    downloadStarted = true;
  } finally {
    if (!downloadStarted && dataUrl) {
      // No cleanup needed for data URLs — they're garbage-collected
    }
  }
}

/**
 * Convert a Blob to a base64 data URI.
 * Works in both service workers (Chrome MV3) and regular contexts (Firefox).
 */
async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chars = [];
  const len = bytes.length;
  // Process in chunks to avoid stack overflow on large files
  const CHUNK = 8192;
  for (let offset = 0; offset < len; offset += CHUNK) {
    const slice = bytes.subarray(offset, offset + CHUNK);
    for (let i = 0; i < slice.length; i++) {
      chars.push(String.fromCharCode(slice[i]));
    }
  }
  const base64 = btoa(chars.join(''));
  return `data:${blob.type};base64,${base64}`;
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

/**
 * Open printable book view — opens the extension print page for the given book.
 * The print page reads directly from IndexedDB and triggers the print dialog.
 */
async function openPrintView(bookData) {
  const ourn = bookData.ourn || bookData.isbn;
  if (!ourn) throw new Error('Missing book identifier');

  // Verify cache exists
  const cachedMeta = await BookCache.getBookMeta(ourn);
  if (!cachedMeta) {
    throw new Error('Book not downloaded yet. Please download the EPUB first.');
  }

  // Open the extension print page — it reads from IndexedDB directly
  const printPageUrl = browser.runtime.getURL('print.html') + '?ourn=' + encodeURIComponent(ourn);
  await browser.tabs.create({ url: printPageUrl, active: true });
}
