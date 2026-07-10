/**
 * Content script for O'Reilly EPUB Downloader
 * Runs on ALL pages but only extracts info from O'Reilly book pages.
 */

console.log("O'Reilly EPUB Downloader - Content script loaded");

/**
 * Check if the current page is an O'Reilly book page (landing or chapter).
 */
function isOReillyBookPage() {
  const url = window.location.href;
  if (!url.includes('/library/view/')) return false;
  return true;
}

/**
 * Extract book information from the page.
 * Works on both landing pages (__INITIAL_STATE__) and chapter pages (URL-based).
 */
function extractBookInfo() {
  try {
    // Try the full initial state data first (landing page)
    const scripts = document.querySelectorAll('script');
    let bookData = null;

    for (const script of scripts) {
      const content = script.textContent;
      if (content.includes('initialStoreData')) {
        const match = content.match(/window.__INITIAL_STATE__\s*=\s*({.+?});/s) ||
                     content.match(/initialStoreData\s*=\s*({.+?});/s);

        if (match) {
          try {
            const data = JSON.parse(match[1]);

            if (data.book) {
              bookData = data.book;
            } else if (data.epub) {
              bookData = data.epub;
            } else if (data.archive_id || data.archiveId) {
              bookData = {
                archive_id: data.archive_id || data.archiveId,
                isbn: data.isbn,
                title: data.title,
                ourn: data.ourn
              };
            }
          } catch (e) {
            console.error('Failed to parse initial state:', e);
          }
        }
      }
    }

    if (!bookData) {
      // Fallback: extract ISBN from URL — works on chapter pages too
      // URL format: /library/view/{slug}/{isbn}/{filename}.xhtml
      // or: /library/view/{slug}/{isbn}/
      const url = window.location.pathname;
      const matches = url.match(/\/library\/view\/([^/]+)\/([^/]+?)(?:\/|\.\w+)?$/);

      if (matches) {
        bookData = {
          title: document.title
            .replace(/ \[Book\]/, '')
            .replace(/ - O'Reilly Media/, '')
            .replace(/ - O'Reilly Learning/, '')
            .trim(),
          isbn: matches[2],
          archive_id: matches[2],
          url: window.location.href
        };
      }
    }

    if (bookData) {
      if (!bookData.ourn && bookData.isbn) {
        bookData.ourn = 'urn:orm:book:' + bookData.isbn;
      }

      if (!bookData.title) {
        const h1 = document.querySelector('h1');
        if (h1) {
          bookData.title = h1.textContent.trim();
        }
      }

      console.log('Extracted book info:', bookData);
      return bookData;
    }

    return null;

  } catch (error) {
    console.error('Error extracting book info:', error);
    return null;
  }
}

/**
 * Get JWT token from cookies or page state
 */
function getJWTToken(bookData) {
  // 1. Try the standard orm-jwt cookie
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const name = trimmed.slice(0, eqIdx);
    const rawValue = trimmed.slice(eqIdx + 1);
    if (name === 'orm-jwt') {
      try {
        return decodeURIComponent(rawValue);
      } catch (_) {
        return rawValue;
      }
    }
  }

  // 2. Try extracting from the page state (proxy domains often embed it)
  if (bookData && bookData.jwtToken) return bookData.jwtToken;
  if (bookData && bookData.access_token) return bookData.access_token;
  if (bookData && bookData.token) return bookData.token;

  // 3. Last resort: look for JWT in all script content
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent;
    const jwtMatch = content.match(/"access_token"\s*:\s*"([^"]+)"/);
    if (jwtMatch) return jwtMatch[1];
  }

  return null;
}

/**
 * Listen for messages from popup
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  if (message.type === 'GET_BOOK_INFO') {
    // Only try to extract from O'Reilly book landing pages
    if (!isOReillyBookPage()) {
      sendResponse({ success: false, error: "Not on an O'Reilly book page." });
      return true;
    }

    const bookData = extractBookInfo();
    const jwtToken = getJWTToken(bookData);

    if (bookData && jwtToken) {
      bookData.jwtToken = jwtToken;
      sendResponse({ success: true, data: bookData });
    } else if (bookData && !jwtToken) {
      sendResponse({ success: false, error: "JWT token not found. Please log in to O'Reilly Learning." });
    } else {
      sendResponse({ success: false, error: 'Could not extract book info. Please refresh the page.' });
    }
    return true;
  }

  if (message.type === 'TEST_API') {
    // Test that the API is accessible and returns full content
    const ourn = message.ourn || '';
    const apiBase = message.apiBase || 'https://learning.oreilly.com';
    const jwtToken = message.jwtToken || '';

    if (!ourn || !jwtToken) {
      sendResponse({ success: false, error: 'Missing ourn or jwtToken.' });
      return true;
    }

    fetch(apiBase + '/api/v2/epubs/' + ourn + '/', {
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + jwtToken
      }
    }).then(function(response) {
      if (!response.ok) {
        sendResponse({ success: false, error: 'API returned ' + response.status });
        return;
      }
      return response.json();
    }).then(function(data) {
      if (!data) return;
      if (data.title) {
        sendResponse({ success: true, data: { title: data.title, hasFiles: !!data.files, apiBase: apiBase } });
      } else {
        sendResponse({ success: false, error: 'API returned unexpected data.' });
      }
    }).catch(function(err) {
      sendResponse({ success: false, error: err.message });
    });

    return true; // async response
  }
});

// Auto-detect book when page loads (only on O'Reilly pages)
window.addEventListener('load', function() {
  if (!isOReillyBookPage()) return;
  var bookData = extractBookInfo();
  if (bookData) {
    console.log('Book detected:', bookData.title);
  }
});