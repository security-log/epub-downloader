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

let currentBookData = null;

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
    } else {
      showStatus('Could not detect book information. Please refresh the page.');
    }

    loadHistory();

  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize extension: ' + error.message);
  }
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
 * Start download with given options
 */
async function startDownload(downloadOptions = {}) {
  if (!currentBookData) {
    showError('No book data available');
    return;
  }

  try {
    errorSection.classList.add('hidden');
    successSection.classList.add('hidden');
    warningSection.classList.add('hidden');
    downloadSection.classList.add('hidden');
    cacheSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    downloadBtn.disabled = true;

    updateProgress(0, 100, 'Starting download...');

    const response = await browser.runtime.sendMessage({
      type: 'DOWNLOAD_EPUB',
      data: { ...currentBookData, downloadOptions }
    });

    if (response.success) {
      const data = response.data || {};
      showSuccess(data.failedFiles, data.fromCache);
      loadHistory();
    } else {
      showError(response.error || 'Download failed');
    }

  } catch (error) {
    console.error('Download error:', error);
    showError('Download failed: ' + error.message);
  }
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

// Listen for progress updates from background script
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'DOWNLOAD_PROGRESS') {
    updateProgress(message.current, message.total, message.message);
  }
});

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', init);
