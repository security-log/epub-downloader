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
      // Tag as restored: nothing in this fresh worker instance is actually
      // driving this download forward, so a 'running' status here is stale
      // context for the popup, not proof that a download is still active.
      activeDownloads.set(ourn, { ...entry, restored: true });
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
    // Restored entries are stale display context (D-08), not proof of an
    // in-flight download in this worker instance — never gate on them.
    const existing = activeDownloads.get(ourn);
    if (existing && existing.status === 'running' && !existing.restored) {
      sendResponse({ success: true, queued: true, alreadyRunning: true });
      return true;
    }

    // If a different book is already downloading, require explicit confirmation
    // before running a second one concurrently (each spins up its own pool of
    // parallel requests, so unconfirmed piling-up hurts everyone's throughput).
    if (!message.data.confirmed) {
      const other = [...activeDownloads.entries()].find(([id, e]) => id !== ourn && e.status === 'running' && !e.restored);
      if (other) {
        const [otherOurn, otherEntry] = other;
        sendResponse({ success: true, needsConfirmation: true, activeBook: { ourn: otherOurn, title: otherEntry.title || otherOurn } });
        return true;
      }
    }

    activeDownloads.set(ourn, { status: 'running', current: 0, total: 100, message: 'Starting...', title: message.data.title || ourn });
    sendResponse({ success: true, queued: true });
    handleDownloadRequest(message.data, ourn).catch(() => {});
    return true;
  }

  if (message.type === 'GET_DOWNLOAD_STATUS') {
    const entry = activeDownloads.get(message.ourn) || null;
    sendResponse({ success: true, data: entry });
    return true;
  }

  if (message.type === 'GET_ALL_DOWNLOADS') {
    const running = [...activeDownloads.entries()]
      .filter(([, e]) => e.status === 'running')
      .map(([ourn, e]) => ({ ourn, title: e.title || ourn, current: e.current, total: e.total, message: e.message }));
    sendResponse({ success: true, data: running });
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
