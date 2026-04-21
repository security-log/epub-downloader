/**
 * Background script for O'Reilly EPUB Downloader
 * Handles download requests and manages state
 */

console.log('O\'Reilly EPUB Downloader - Background script loaded');

const activeDownloads = new Map();

// Restore activeDownloads from session storage after worker restart (D-07, REL-01)
// D-08: no auto-resume — restored entries are read-only context for the popup
browser.storage.session.get('activeDownloads').then(({ activeDownloads: saved }) => {
  if (saved && typeof saved === 'object') {
    for (const [ourn, entry] of Object.entries(saved)) {
      activeDownloads.set(ourn, entry);
    }
    console.log('Restored', activeDownloads.size, 'download entries from session storage');
  }
}).catch(err => console.warn('Failed to restore activeDownloads:', err));

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  if (sender.id !== browser.runtime.id) {
    console.warn('Rejected message from unknown sender:', sender.id);
    return;
  }

  if (message.type === 'DOWNLOAD_EPUB') {
    const ourn = message.data.ourn || message.data.isbn;
    if (!ourn) {
      sendResponse({ success: false, error: 'Missing book identifier (ourn or isbn)' });
      return true;
    }
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

});

async function handleDownloadRequest(bookData, ourn) {
  console.log('Starting EPUB download for:', bookData.title);
  try {
    const options = bookData.downloadOptions || { useCache: true, forceRefresh: false };
    const onProgress = (current, total, message) => {
      const entry = activeDownloads.get(ourn);
      if (entry && entry.status === 'running') {
        entry.current = current;
        entry.total = total;
        entry.message = message;
        browser.storage.session.set({ activeDownloads: Object.fromEntries(activeDownloads) })
          .catch(err => console.warn('session sync failed:', err));
      }
    };

    const result = await downloadEPUB(bookData, options, onProgress);

    console.log('Download completed successfully');
    activeDownloads.set(ourn, { status: 'done', result });
    browser.storage.session.set({ activeDownloads: Object.fromEntries(activeDownloads) })
      .catch(err => console.warn('session sync failed:', err));
    browser.runtime.sendMessage({ type: 'DOWNLOAD_COMPLETE', ourn, data: result }).catch(() => {});
    return result;

  } catch (error) {
    console.error('Download failed:', error);
    activeDownloads.set(ourn, { status: 'error', error: error.message });
    browser.storage.session.set({ activeDownloads: Object.fromEntries(activeDownloads) })
      .catch(err => console.warn('session sync failed:', err));
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
