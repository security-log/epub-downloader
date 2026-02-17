/**
 * Content script for O'Reilly EPUB Downloader
 * Runs on O'Reilly book pages to extract book information
 */

console.log('O\'Reilly EPUB Downloader - Content script loaded');

/**
 * Extract book information from the page
 */
function extractBookInfo() {
  try {
    const scripts = document.querySelectorAll('script');
    let bookData = null;

    for (const script of scripts) {
      const content = script.textContent;
      if (content.includes('initialStoreData')) {
        const match = content.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s) ||
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
      const url = window.location.pathname;
      const matches = url.match(/\/library\/view\/([^\/]+)\/([^\/]+)\/?/);
      
      if (matches) {
        bookData = {
          title: document.title.replace(' [Book]', '').replace(' - O\'Reilly Media', '').trim(),
          isbn: matches[2],
          archive_id: matches[2],
          url: window.location.href
        };
      }
    }

    if (bookData) {
      if (!bookData.ourn && bookData.isbn) {
        bookData.ourn = `urn:orm:book:${bookData.isbn}`;
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
 * Get JWT token from cookies
 */
function getJWTToken() {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'orm-jwt') {
      return value;
    }
  }
  return null;
}

/**
 * Listen for messages from popup
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  if (message.type === 'GET_BOOK_INFO') {
    const bookData = extractBookInfo();
    const jwtToken = getJWTToken();

    if (bookData && jwtToken) {
      bookData.jwtToken = jwtToken;
      sendResponse({ success: true, data: bookData });
    } else {
      sendResponse({ 
        success: false, 
        error: !bookData ? 'Could not extract book info' : 'JWT token not found. Please log in.'
      });
    }
    return true;
  }
});

// Auto-detect book when page loads
window.addEventListener('load', () => {
  const bookData = extractBookInfo();
  if (bookData) {
    console.log('Book detected:', bookData.title);
  }
});
