/**
 * Print view script
 * Loads cached EPUB content from IndexedDB and triggers the browser print dialog.
 */

(async function() {
  const params = new URLSearchParams(location.search);
  const ourn = params.get('ourn');

  if (!ourn) {
    document.getElementById('loading').textContent = 'Error: No book identifier provided.';
    return;
  }

  try {
    const printData = await buildPrintContent(ourn);
    if (!printData) {
      document.getElementById('loading').textContent = 'Error: Print content not found. Please download the EPUB first, then try again.';
      return;
    }

    // Render the full HTML
    document.open();
    document.write(printData);
    document.close();

    // Wait for fonts and images to load, then trigger print
    setTimeout(function() {
      window.print();
    }, 1200);

  } catch (err) {
    document.getElementById('loading').textContent = 'Error: ' + err.message;
    console.error('Print view error:', err);
  }
})();

/**
 * Build printable HTML from cached EPUB content in IndexedDB
 */
async function buildPrintContent(ourn) {
  const db = await openCacheDB();
  if (!db) return null;

  // Get book metadata
  const bookMeta = await dbGet(db, 'books', ourn);
  if (!bookMeta) return null;

  const title = escapeHtml(bookMeta.title || 'Book');

  // Get all cached files for this book
  const cachedFiles = await dbGetAllByIndex(db, 'files', 'byBook', ourn);
  if (!cachedFiles || cachedFiles.length === 0) return null;

  // Build file lookup by fullPath
  const fileMap = new Map();
  for (const file of cachedFiles) {
    fileMap.set(file.fullPath, file);
  }

  // Find OPF
  let opfContent = null;
  let opfPath = null;
  for (const file of cachedFiles) {
    if (file.mediaType === 'application/oebps-package+xml') {
      opfPath = file.fullPath;
      opfContent = file.content;
      break;
    }
  }

  // Build chapter order from spine
  const chapterPaths = [];
  if (opfContent) {
    const manifestItems = {};
    const manifestRegex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*media-type=["']([^"']+)["'][^>]*\/?>/gi;
    let match;
    while ((match = manifestRegex.exec(opfContent)) !== null) {
      manifestItems[match[1]] = { href: match[2], mediaType: match[3] };
    }
    const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*\/?>/gi;
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
    while ((match = spineRegex.exec(opfContent)) !== null) {
      const idref = match[1];
      const item = manifestItems[idref];
      if (item) {
        const resolvedPath = opfDir + item.href;
        chapterPaths.push(resolvedPath);
      }
    }
  }

  if (chapterPaths.length === 0) {
    for (const file of cachedFiles) {
      if (file.mediaType === 'application/xhtml+xml' || file.mediaType === 'text/html') {
        chapterPaths.push(file.fullPath);
      }
    }
    chapterPaths.sort();
  }

  // Pre-compute data URLs for all cached images
  const dataUrlCache = new Map();
  for (const file of cachedFiles) {
    if (file.mediaType && file.mediaType.startsWith('image/')) {
      const dataUrl = contentToDataUrl(file);
      if (dataUrl) dataUrlCache.set(file.fullPath, dataUrl);
    }
  }

  // Build body content
  let bodyHtml = '';

  for (const chapterPath of chapterPaths) {
    const fileData = fileMap.get(chapterPath);
    if (!fileData || typeof fileData.content !== 'string') continue;

    let chapterContent = fileData.content;

    // Extract body content
    const bodyMatch = chapterContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      chapterContent = bodyMatch[1];
    }

    // Strip scripts and nav
    chapterContent = chapterContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    chapterContent = chapterContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    chapterContent = chapterContent.replace(/<\?xml-stylesheet[^?]*\?>/gi, '');

    // Resolve images to inline base64
    chapterContent = chapterContent.replace(/<img([^>]*?)src\s*=\s*["']([^"']+)["']/gi, function(match, attrs, src) {
      if (src.startsWith('http') || src.startsWith('data:')) return match;
      var chapterDir = chapterPath.substring(0, chapterPath.lastIndexOf('/') + 1);
      var resolvedSrc = chapterDir + src;
      var dataUrl = dataUrlCache.get(resolvedSrc);
      if (dataUrl) return match.replace(src, dataUrl);
      // Fallback: match by filename
      var imgName = src.replace(/^.*\//, '');
      for (var [cachePath, du] of dataUrlCache) {
        if (cachePath.endsWith('/' + imgName) || cachePath === imgName) {
          return match.replace(src, du);
        }
      }
      return match;
    });

    // Resolve SVG <image> references
    chapterContent = chapterContent.replace(/<image\s+([^>]*?)(?:xlink:href|href)\s*=\s*["']([^"']+)["']/gi, function(match, attrs, src) {
      if (src.startsWith('http') || src.startsWith('data:')) return match;
      var chapterDir = chapterPath.substring(0, chapterPath.lastIndexOf('/') + 1);
      var dataUrl = dataUrlCache.get(chapterDir + src);
      if (dataUrl) return match.replace(src, dataUrl);
      return match;
    });

    bodyHtml += '\n<section class="chapter">\n' + chapterContent + '\n</section>\n';
  }

  if (!bodyHtml) return null;

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n'
    + '<title>' + title + ' - Print View</title>\n'
    + '<style>\n'
    + '*, *::before, *::after { box-sizing: border-box; }\n'
    + 'body { font-family: Georgia, "Times New Roman", "Liberation Serif", serif; font-size: 11pt; line-height: 1.5; color: #222; max-width: 750px; margin: 1em auto; padding: 0 30px; }\n'
    + 'h1 { font-size: 22pt; text-align: center; margin: 1.5em 0 0.5em; font-weight: 700; line-height: 1.2; }\n'
    + 'h2 { font-size: 16pt; margin: 1.5em 0 0.5em; font-weight: 600; line-height: 1.3; color: #111; }\n'
    + 'h3 { font-size: 13pt; margin: 1.3em 0 0.4em; font-weight: 600; color: #222; }\n'
    + 'h4 { font-size: 11pt; margin: 1em 0 0.3em; font-weight: 600; }\n'
    + 'p { margin: 0.6em 0; text-align: justify; }\n'
    + 'img { max-width: 100%; height: auto; display: block; margin: 1em auto; }\n'
    + 'pre, code, tt { font-family: "SF Mono", "Cascadia Code", "Fira Code", "Liberation Mono", monospace; }\n'
    + 'pre { font-size: 9pt; background: #f7f7f7; padding: 12px; overflow-x: auto; border: 1px solid #ddd; border-radius: 3px; margin: 1em 0; white-space: pre-wrap; word-break: break-word; }\n'
    + 'code { font-size: 9.5pt; background: #f5f5f5; padding: 1px 4px; border-radius: 2px; }\n'
    + 'pre code { background: none; padding: 0; }\n'
    + 'table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 10pt; }\n'
    + 'th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-weight: 600; }\n'
    + 'td { border: 1px solid #ccc; padding: 5px 8px; }\n'
    + 'tr:nth-child(even) td { background: #fafafa; }\n'
    + 'blockquote { margin: 1em 20px; padding: 0 15px; border-left: 3px solid #ccc; color: #555; font-style: italic; }\n'
    + 'ul, ol { margin: 0.5em 0; padding-left: 2em; }\n'
    + 'li { margin: 0.2em 0; }\n'
    + 'hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }\n'
    + 'figure { margin: 1em 0; text-align: center; }\n'
    + 'figcaption { font-size: 9.5pt; color: #666; margin-top: 4px; font-style: italic; }\n'
    + 'a { color: #1a5a99; text-decoration: none; }\n'
    + 'sup, sub { font-size: 0.75em; }\n'
    + 'div.note, div.sidebar, div.tip, div.warning { background: #f9f9f9; border: 1px solid #ddd; border-left: 4px solid #1a5a99; padding: 12px 15px; margin: 1em 0; }\n'
    + 'div.note { border-left-color: #5b9bd5; }\n'
    + 'div.warning { border-left-color: #d9534f; }\n'
    + 'div.tip { border-left-color: #5cb85c; }\n'
    + 'dt { font-weight: 600; margin-top: 0.5em; }\n'
    + 'dd { margin-left: 1.5em; }\n'
    + '.chapter { page-break-before: always; }\n'
    + '.chapter:first-of-type { page-break-before: avoid; }\n'
    + '@media print {\n'
    + '  body { max-width: none; margin: 0; padding: 0; font-size: 10pt; line-height: 1.4; }\n'
    + '  @page { margin: 1.5cm 2cm; }\n'
    + '  pre { page-break-inside: avoid; }\n'
    + '  table { page-break-inside: avoid; }\n'
    + '  img { page-break-inside: avoid; }\n'
    + '  h2, h3 { page-break-after: avoid; }\n'
    + '}\n'
    + '</style>\n</head>\n<body>\n'
    + bodyHtml + '\n</body>\n</html>';
}

/**
 * Open the IndexedDB cache database
 */
function openCacheDB() {
  return new Promise(function(resolve) {
    var request = indexedDB.open('epub-downloader-cache', 2);
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { resolve(null); };
    request.onupgradeneeded = function(event) {
      var db = event.target.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'ourn' });
      }
      if (!db.objectStoreNames.contains('files')) {
        var fileStore = db.createObjectStore('files', { keyPath: ['ourn', 'fullPath'] });
        fileStore.createIndex('byBook', 'ourn', { unique: false });
      }
    };
  });
}

/**
 * Get a single value from an object store
 */
function dbGet(db, storeName, key) {
  return new Promise(function(resolve, reject) {
    var tx = db.transaction(storeName, 'readonly');
    var request = tx.objectStore(storeName).get(key);
    request.onsuccess = function() { resolve(request.result || null); };
    request.onerror = function() { reject(request.error); };
  });
}

/**
 * Get all values matching an index key
 */
function dbGetAllByIndex(db, storeName, indexName, key) {
  return new Promise(function(resolve, reject) {
    var results = [];
    var tx = db.transaction(storeName, 'readonly');
    var index = tx.objectStore(storeName).index(indexName);
    var request = index.openCursor(IDBKeyRange.only(key));
    request.onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      }
    };
    tx.oncomplete = function() { resolve(results); };
    tx.onerror = function() { reject(tx.error); };
  });
}

/**
 * Convert cached file content (string or ArrayBuffer) to base64 data URL
 */
function contentToDataUrl(fileData) {
  if (!fileData || !fileData.mediaType) return null;
  var bytes = null;
  if (typeof fileData.content === 'string') {
    var encoder = new TextEncoder();
    bytes = encoder.encode(fileData.content);
  } else if (fileData.content instanceof ArrayBuffer) {
    bytes = new Uint8Array(fileData.content);
  } else if (fileData.content instanceof Uint8Array) {
    bytes = fileData.content;
  } else {
    return null;
  }
  try {
    var chars = [];
    for (var i = 0; i < bytes.length; i++) {
      chars.push(String.fromCharCode(bytes[i]));
    }
    return 'data:' + fileData.mediaType + ';base64,' + btoa(chars.join(''));
  } catch (e) {
    return null;
  }
}

/**
 * Escape XML/HTML special characters
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
