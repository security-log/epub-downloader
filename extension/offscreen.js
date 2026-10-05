/**
 * Offscreen document (Chrome only)
 * Provides the DOM and Blob URL APIs that the MV3 service worker lacks.
 */

const blobUrls = new Set();

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen' || sender.id !== browser.runtime.id) {
    return;
  }

  if (message.type === 'SANITIZE_HTML') {
    try {
      sendResponse({ success: true, html: stripScripts(message.html) });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return;
  }

  if (message.type === 'REVOKE_BLOB_URL') {
    if (blobUrls.delete(message.url)) {
      URL.revokeObjectURL(message.url);
    }
  }
});

// Blobs arrive from the service worker via postMessage (structured clone),
// since runtime messaging serializes to JSON and cannot carry a Blob.
navigator.serviceWorker.onmessage = (event) => {
  const { type, blob } = event.data || {};
  const [port] = event.ports;
  if (type !== 'CREATE_BLOB_URL' || !port) return;

  const url = URL.createObjectURL(blob);
  blobUrls.add(url);
  port.postMessage({ url });
};
