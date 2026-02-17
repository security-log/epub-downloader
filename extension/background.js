/**
 * Background script for O'Reilly EPUB Downloader
 * Handles download requests and manages state
 */

console.log('O\'Reilly EPUB Downloader - Background script loaded');

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  if (message.type === 'DOWNLOAD_EPUB') {
    handleDownloadRequest(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
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

async function handleDownloadRequest(bookData) {
  console.log('Starting EPUB download for:', bookData.title);

  try {
    const options = bookData.downloadOptions || { useCache: true, forceRefresh: false };
    const result = await downloadEPUB(bookData, options);

    console.log('Download completed successfully');
    return result;

  } catch (error) {
    console.error('Download failed:', error);
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
