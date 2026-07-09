/**
 * Popup script for O'Reilly EPUB Downloader
 * Handles UI interactions and communicates with background script
 */

// DOM Elements
const statusSection = document.getElementById('status-section');
const statusMessage = document.getElementById('status-message');
const bookInfo = document.getElementById('book-info');
const bookTitle = document.getElementById('book-title');
const bookIsbn = document.getElementById('book-isbn');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const successSection = document.getElementById('success-section');
const cacheSection = document.getElementById('cache-section');
const cacheStatusText = document.getElementById('cache-status-text');
const downloadCachedBtn = document.getElementById('download-cached-btn');
const forceDownloadBtn = document.getElementById('force-download-btn');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const warningSection = document.getElementById('warning-section');
const warningMessage = document.getElementById('warning-message');
const failedFilesList = document.getElementById('failed-files-list');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const confirmSection = document.getElementById('confirm-section');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');
const activeDownloadsSection = document.getElementById('active-downloads-section');
const activeDownloadsList = document.getElementById('active-downloads-list');

let currentBookData = null;
let currentDownloadOurn = null;
// Local mirror of background's activeDownloads, keyed by ourn. Updated in
// place from broadcast messages instead of re-querying the background
// script on every progress tick (which fires many times per second).
const activeDownloadsMap = new Map();

/**
 * Initialize popup
 */
async function init() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab.url || !currentTab.url.includes('learning.oreilly.com/library/view/')) {
      showStatus('Please navigate to a book page on O\'Reilly Learning');
      loadHistory();
      return;
    }

    const response = await browser.tabs.sendMessage(currentTab.id, { type: 'GET_BOOK_INFO' });

    if (response && response.success) {
      currentBookData = response.data;
      showBookInfo(currentBookData);
      checkCacheStatus(currentBookData.ourn || currentBookData.isbn);

      try {
        const ourn = currentBookData.ourn || currentBookData.isbn;
        const statusResp = await browser.runtime.sendMessage({ type: 'GET_DOWNLOAD_STATUS', ourn });
        if (statusResp && statusResp.data) {
          const dlStatus = statusResp.data;
          if (dlStatus.status === 'running') {
            currentDownloadOurn = ourn;
            downloadSection.classList.add('hidden');
            cacheSection.classList.add('hidden');
            progressSection.classList.remove('hidden');
            downloadBtn.disabled = true;
            updateProgress(dlStatus.current, dlStatus.total, dlStatus.message);
          } else if (dlStatus.status === 'done') {
            const data = dlStatus.result || {};
            showSuccess(data.failedFiles, data.fromCache);
            loadHistory();
            return;
          } else if (dlStatus.status === 'error') {
            showError(dlStatus.error || 'Download failed');
          }
        }
      } catch (err) {
        console.warn('Could not check download status:', err);
      }
    } else {
      showStatus('Could not detect book information. Please refresh the page.');
    }

    loadHistory();
    loadActiveDownloads();

  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize extension: ' + error.message);
  }
}

/**
 * Seed activeDownloadsMap from the background script (across every book,
 * not just the one matching the currently active tab). Only needed once on
 * open — after that, broadcast messages keep the map current.
 */
async function loadActiveDownloads() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_ALL_DOWNLOADS' });
    if (!response.success) return;
    activeDownloadsMap.clear();
    for (const dl of response.data) {
      activeDownloadsMap.set(dl.ourn, dl);
    }
    renderActiveDownloads();
  } catch (err) {
    console.warn('Could not load active downloads:', err);
  }
}

function renderActiveDownloads() {
  // The current tab's book already has its own progress bar — don't show it twice.
  const list = [...activeDownloadsMap.values()].filter(dl => dl.ourn !== currentDownloadOurn);

  if (list.length === 0) {
    activeDownloadsSection.classList.add('hidden');
    activeDownloadsList.innerHTML = '';
    return;
  }

  activeDownloadsList.innerHTML = '';
  for (const dl of list) {
    const li = document.createElement('li');

    const titleSpan = document.createElement('span');
    titleSpan.className = 'adl-title';
    titleSpan.textContent = dl.title || dl.ourn;
    titleSpan.title = dl.title || dl.ourn;

    const progressSpan = document.createElement('span');
    progressSpan.className = 'adl-progress';
    const total = Number(dl.total) || 0;
    const current = Number(dl.current) || 0;
    const percentage = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
    progressSpan.textContent = dl.message ? `${percentage}% — ${dl.message}` : `${percentage}%`;

    li.appendChild(titleSpan);
    li.appendChild(progressSpan);
    activeDownloadsList.appendChild(li);
  }

  activeDownloadsSection.classList.remove('hidden');
}

/**
 * Check if the current book has cached files
 */
async function checkCacheStatus(ourn) {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_CACHE_STATS', ourn });
    if (response.success && response.data.cachedFiles > 0) {
      cacheStatusText.textContent = `${response.data.cachedFiles} files cached for this book`;
      downloadCachedBtn.classList.remove('hidden');
      forceDownloadBtn.classList.remove('hidden');
      clearCacheBtn.classList.remove('hidden');
      cacheSection.classList.remove('hidden');
    }
  } catch (err) {
    console.warn('Could not check cache status:', err);
  }
}

/**
 * Show book information
 */
function showBookInfo(data) {
  statusSection.classList.add('hidden');
  bookInfo.classList.remove('hidden');
  downloadSection.classList.remove('hidden');

  bookTitle.textContent = data.title;
  bookIsbn.textContent = `ISBN: ${data.isbn || 'N/A'}`;
}

/**
 * Show status message
 */
function showStatus(message) {
  statusMessage.textContent = message;
  statusSection.classList.remove('hidden');
  bookInfo.classList.add('hidden');
  downloadSection.classList.add('hidden');
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorSection.classList.remove('hidden');
  progressSection.classList.add('hidden');
  downloadBtn.disabled = false;
}

/**
 * Show success with optional warnings
 */
function showSuccess(failedFiles, fromCache) {
  successSection.classList.remove('hidden');
  progressSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  downloadBtn.disabled = false;

  if (failedFiles && failedFiles.length > 0) {
    warningMessage.textContent = `Download completed with ${failedFiles.length} failed file(s)`;
    failedFilesList.innerHTML = '';
    for (const f of failedFiles) {
      const li = document.createElement('li');
      li.textContent = `${f.path}: ${f.error}`;
      failedFilesList.appendChild(li);
    }
    warningSection.classList.remove('hidden');
  }
}

/**
 * Update progress
 */
function updateProgress(current, total, message = '') {
  const percentage = Math.round((current / total) * 100);
  progressBar.style.width = percentage + '%';
  progressBar.textContent = percentage + '%';

  if (message) {
    progressText.textContent = message;
  } else {
    progressText.textContent = `Downloading files... ${current}/${total}`;
  }
}

/**
 * Start download with given options. Pass confirmed=true to proceed even
 * though another book is already downloading (bypasses the confirm prompt).
 */
async function startDownload(downloadOptions = {}, confirmed = false) {
  if (!currentBookData) {
    showError('No book data available');
    return;
  }

  const ourn = currentBookData.ourn || currentBookData.isbn;

  try {
    const response = await browser.runtime.sendMessage({
      type: 'DOWNLOAD_EPUB',
      data: { ...currentBookData, downloadOptions, confirmed }
    });

    if (response && response.needsConfirmation) {
      showConfirmDialog(response.activeBook, downloadOptions);
      return;
    }

    if (!response || !response.success) {
      showError('Failed to start download: ' + (response && response.error || 'unknown error'));
      return;
    }

    currentDownloadOurn = ourn;
    confirmSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    successSection.classList.add('hidden');
    warningSection.classList.add('hidden');
    downloadSection.classList.add('hidden');
    cacheSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    downloadBtn.disabled = true;

    updateProgress(0, 100, 'Starting download...');

  } catch (error) {
    console.error('Download error:', error);
    showError('Download failed: ' + error.message);
    currentDownloadOurn = null;
  }
}

/**
 * Show a prompt asking whether to download this book while another is
 * already in progress.
 */
function showConfirmDialog(activeBook, downloadOptions) {
  confirmMessage.textContent = `"${activeBook.title}" is currently downloading. Download this book at the same time?`;
  errorSection.classList.add('hidden');
  successSection.classList.add('hidden');
  warningSection.classList.add('hidden');
  progressSection.classList.add('hidden');
  confirmSection.classList.remove('hidden');
  downloadSection.classList.add('hidden');
  cacheSection.classList.add('hidden');

  confirmYesBtn.onclick = () => startDownload(downloadOptions, true);
  confirmNoBtn.onclick = () => {
    confirmSection.classList.add('hidden');
    downloadSection.classList.remove('hidden');
    checkCacheStatus(currentBookData.ourn || currentBookData.isbn);
  };
}

/**
 * Load and display download history
 */
async function loadHistory() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_DOWNLOAD_HISTORY' });
    if (!response.success || !response.data || response.data.length === 0) return;

    historyList.innerHTML = '';
    for (const entry of response.data.slice(0, 20)) {
      const li = document.createElement('li');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'history-title';
      titleSpan.textContent = entry.title;
      titleSpan.title = entry.title;

      const dateSpan = document.createElement('span');
      dateSpan.className = 'history-date';
      dateSpan.textContent = new Date(entry.downloadedAt).toLocaleDateString();

      li.appendChild(titleSpan);
      li.appendChild(dateSpan);
      historyList.appendChild(li);
    }

    historySection.classList.remove('hidden');
  } catch (err) {
    console.warn('Could not load history:', err);
  }
}

// Event Listeners

downloadBtn.addEventListener('click', () => {
  startDownload({ useCache: true, forceRefresh: false });
});

downloadCachedBtn.addEventListener('click', () => {
  startDownload({ useCache: true, forceRefresh: false });
});

forceDownloadBtn.addEventListener('click', () => {
  startDownload({ useCache: false, forceRefresh: true });
});

clearCacheBtn.addEventListener('click', async () => {
  if (!currentBookData) return;
  const ourn = currentBookData.ourn || currentBookData.isbn;
  try {
    await browser.runtime.sendMessage({ type: 'DELETE_CACHED_BOOK', ourn });
    cacheSection.classList.add('hidden');
  } catch (err) {
    console.error('Failed to clear cache:', err);
  }
});

clearHistoryBtn.addEventListener('click', async () => {
  try {
    await browser.storage.local.set({ downloadHistory: [] });
    historySection.classList.add('hidden');
  } catch (err) {
    console.error('Failed to clear history:', err);
  }
});

// Listen for progress updates and download completion from background script.
// These fire for every in-flight download, not just the one for the current
// tab's book, so activeDownloadsMap is kept current for every book at once.
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'DOWNLOAD_PROGRESS') {
    if (message.ourn === currentDownloadOurn) {
      updateProgress(message.current, message.total, message.message);
    }
    activeDownloadsMap.set(message.ourn, {
      ourn: message.ourn,
      title: message.title,
      current: message.current,
      total: message.total,
      message: message.message
    });
    renderActiveDownloads();
  }

  if (message.type === 'DOWNLOAD_COMPLETE') {
    if (message.ourn === currentDownloadOurn) {
      const data = message.data || {};
      showSuccess(data.failedFiles, data.fromCache);
      loadHistory();
      currentDownloadOurn = null;
    }
    activeDownloadsMap.delete(message.ourn);
    renderActiveDownloads();
  }

  if (message.type === 'DOWNLOAD_FAILED') {
    if (message.ourn === currentDownloadOurn) {
      showError(message.error || 'Download failed');
      currentDownloadOurn = null;
    }
    activeDownloadsMap.delete(message.ourn);
    renderActiveDownloads();
  }
});

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', init);
