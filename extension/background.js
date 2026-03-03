/**
 * Background script for O'Reilly EPUB Downloader
 * Handles download requests and manages state
 */

console.log('O\'Reilly EPUB Downloader - Background script loaded');

const activeDownloads = new Map();

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  if (message.type === 'DOWNLOAD_EPUB') {
    const ourn = message.data.ourn || message.data.isbn;
    const existing = activeDownloads.get(ourn);
    if (existing && existing.status === 'running') {
      sendResponse({ success: true, queued: true, alreadyRunning: true });
      return true;
    }
    activeDownloads.set(ourn, { status: 'running', current: 0, total: 100, message: 'Starting...' });
    sendResponse({ success: true, queued: true });
    handleDownloadRequest(message.data, ourn).catch(() => {});
    return true;
  }

  if (message.type === 'GET_DOWNLOAD_STATUS') {
    const entry = activeDownloads.get(message.ourn) || null;
    sendResponse({ success: true, data: entry });
    return true;
  }

  if (message.type === 'GET_CACHED_BOOKS') {
    BookCache.listCachedBooks()
      .then(books => sendResponse({ success: true, data: books }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_CACHE_STATS') {
    BookCache.getCachedFilePaths(message.ourn)
      .then(paths => sendResponse({ success: true, data: { cachedFiles: paths.size } }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'DELETE_CACHED_BOOK') {
    BookCache.deleteBook(message.ourn)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'CLEAR_ALL_CACHE') {
    BookCache.clearAll()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_DOWNLOAD_HISTORY') {
    browser.storage.local.get('downloadHistory')
      .then(({ downloadHistory = [] }) => sendResponse({ success: true, data: downloadHistory }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_BOOK_INFO') {
    return false;
  }
});

async function handleDownloadRequest(bookData, ourn) {
  console.log('Starting EPUB download for:', bookData.title);
  try {
    const options = bookData.downloadOptions || { useCache: true, forceRefresh: false };
    const result = await downloadEPUB(bookData, options);

    console.log('Download completed successfully');
    activeDownloads.set(ourn, { status: 'done', result });
    browser.runtime.sendMessage({ type: 'DOWNLOAD_COMPLETE', ourn, data: result }).catch(() => {});
    return result;

  } catch (error) {
    console.error('Download failed:', error);
    activeDownloads.set(ourn, { status: 'error', error: error.message });
    browser.runtime.sendMessage({ type: 'DOWNLOAD_FAILED', ourn, error: error.message }).catch(() => {});
    throw error;
  }
}

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', browser.runtime.getManifest().version);
  }
});
