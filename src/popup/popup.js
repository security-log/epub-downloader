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
const downloadEpubBtn = document.getElementById('download-epub-btn');
const printBtn = document.getElementById('print-btn');
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
let currentDownloadOurn = null;

/**
 * Check if a URL is an O'Reilly book page (landing page or chapter page).
 */
function isBookPageUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Check for /library/view/ path — works for both landing pages and chapter pages
    if (!parsed.pathname.includes('/library/view/')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize popup
 */
async function init() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (!currentTab.url || !isBookPageUrl(currentTab.url)) {
      showStatus('Please navigate to a book page on O\'Reilly Learning');
      loadHistory();
      return;
    }

    console.debug('URL matches book pattern, attempting to get book info...');

    // Try to get book info with retries
    let response = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await browser.tabs.sendMessage(currentTab.id, { type: 'GET_BOOK_INFO' });
        break; // Success
      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${attempt} failed:`, err.message);
        if (attempt < 3) {
          // Wait before retrying (100ms, 200ms, 300ms)
          await new Promise(resolve => setTimeout(resolve, attempt * 100));
        }
      }
    }

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
            downloadEpubBtn.disabled = true;
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
      const msg = response?.error || lastError?.message || 'Could not detect book information. Please refresh the page.';
      console.debug('Failed to get book info after retries:', msg);
      showStatus(msg);
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
  downloadEpubBtn.disabled = false;
}

/**
 * Show success with optional warnings
 */
function showSuccess(failedFiles, fromCache) {
  successSection.classList.remove('hidden');
  progressSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  downloadEpubBtn.disabled = false;

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

  currentDownloadOurn = currentBookData.ourn || currentBookData.isbn;

  try {
    errorSection.classList.add('hidden');
    successSection.classList.add('hidden');
    warningSection.classList.add('hidden');
    downloadSection.classList.add('hidden');
    cacheSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    downloadEpubBtn.disabled = true;

    updateProgress(0, 100, 'Starting download...');

    browser.runtime.sendMessage({
      type: 'DOWNLOAD_EPUB',
      data: { ...currentBookData, downloadOptions }
    }).catch(err => {
      console.error('Failed to send DOWNLOAD_EPUB message:', err);
      showError('Failed to start download: ' + err.message);
      currentDownloadOurn = null;
    });

  } catch (error) {
    console.error('Download error:', error);
    showError('Download failed: ' + error.message);
    currentDownloadOurn = null;
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

downloadEpubBtn.addEventListener('click', () => {
  startDownload({ useCache: true, forceRefresh: false });
});

downloadCachedBtn.addEventListener('click', () => {
  startDownload({ useCache: true, forceRefresh: false });
});

forceDownloadBtn.addEventListener('click', () => {
  startDownload({ useCache: false, forceRefresh: true });
});

printBtn.addEventListener('click', () => {
  openPrintView();
});

/**
 * Open the book in a new tab for printing / save as PDF
 * Builds a combined printable view from the cached EPUB content
 */
async function openPrintView() {
  if (!currentBookData) {
    showError('No book data available');
    return;
  }

  try {
    errorSection.classList.add('hidden');
    successSection.classList.add('hidden');
    warningSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    printBtn.disabled = true;

    updateProgress(10, 100, 'Building printable view...');

    browser.runtime.sendMessage({
      type: 'PRINT_BOOK',
      data: { ...currentBookData }
    }).catch(err => {
      console.error('Failed to send PRINT_BOOK message:', err);
      showError('Failed to open print view: ' + err.message);
      printBtn.disabled = false;
    });

    // The print view success/failure will come via messages
  } catch (error) {
    console.error('Print error:', error);
    showError('Failed to open print view: ' + error.message);
    printBtn.disabled = false;
  }
}

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

// Listen for progress updates and download completion from background script
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'DOWNLOAD_PROGRESS') {
    updateProgress(message.current, message.total, message.message);
  }

  if (message.type === 'DOWNLOAD_COMPLETE' && message.ourn === currentDownloadOurn) {
    const data = message.data || {};
    showSuccess(data.failedFiles, data.fromCache);
    loadHistory();
    currentDownloadOurn = null;
  }

  if (message.type === 'DOWNLOAD_FAILED' && message.ourn === currentDownloadOurn) {
    showError(message.error || 'Download failed');
    currentDownloadOurn = null;
  }

  if (message.type === 'PRINT_FAILED' && message.ourn === currentDownloadOurn) {
    showError(message.error || 'Failed to open print view');
    currentDownloadOurn = null;
    printBtn.disabled = false;
  }
});

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', init);