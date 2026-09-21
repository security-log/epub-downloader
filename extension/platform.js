/**
 * Platform adapter for DOM- and Blob-URL-dependent operations
 * Firefox runs background scripts in a document, so these run in place.
 * Chrome runs a service worker without DOMParser or URL.createObjectURL,
 * so they are delegated to an offscreen document.
 */

const HAS_DOM = typeof DOMParser !== 'undefined';
const HAS_BLOB_URLS = typeof URL.createObjectURL === 'function';
const OFFSCREEN_PATH = 'offscreen.html';
const OFFSCREEN_REPLY_TIMEOUT_MS = 30000;

let creatingOffscreen = null;

/**
 * Remove script elements structurally (SEC-02)
 * Stylesheet <link> elements must survive (BUG-02).
 */
function stripScripts(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script').forEach(el => el.remove());
  return doc.documentElement.outerHTML;
}

async function ensureOffscreen() {
  const contexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [browser.runtime.getURL(OFFSCREEN_PATH)]
  });
  if (contexts.length > 0) return;

  // Only one offscreen document may exist; share a single in-flight creation
  if (!creatingOffscreen) {
    creatingOffscreen = browser.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['DOM_PARSER', 'BLOBS'],
      justification: 'Sanitize book HTML and create a blob URL for the generated EPUB'
    }).finally(() => { creatingOffscreen = null; });
  }
  await creatingOffscreen;
}

/**
 * Sanitize an HTML document, returning its serialized markup
 */
async function sanitizeHTML(html) {
  if (HAS_DOM) return stripScripts(html);

  await ensureOffscreen();
  const response = await browser.runtime.sendMessage({ target: 'offscreen', type: 'SANITIZE_HTML', html });
  if (!response?.success) {
    throw new Error(response?.error || 'Offscreen HTML sanitization failed');
  }
  return response.html;
}

/**
 * Hand a Blob to the offscreen document and get back a blob URL for it
 */
async function createOffscreenBlobUrl(blob) {
  await ensureOffscreen();
  const offscreenUrl = browser.runtime.getURL(OFFSCREEN_PATH);
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  const client = clients.find(c => c.url === offscreenUrl);
  if (!client) throw new Error('Offscreen document not reachable');

  return new Promise((resolve, reject) => {
    const { port1, port2 } = new MessageChannel();
    const timer = setTimeout(() => {
      port1.close();
      reject(new Error('Offscreen document did not respond'));
    }, OFFSCREEN_REPLY_TIMEOUT_MS);

    port1.onmessage = (event) => {
      clearTimeout(timer);
      port1.close();
      resolve(event.data.url);
    };
    client.postMessage({ type: 'CREATE_BLOB_URL', blob }, [port2]);
  });
}

function revokeOffscreenBlobUrl(url) {
  browser.runtime.sendMessage({ target: 'offscreen', type: 'REVOKE_BLOB_URL', url })
    .catch(err => console.warn('Failed to revoke offscreen blob URL:', err));
}

/**
 * Save a Blob to disk using the browser downloads API
 */
async function downloadBlob(blob, filename) {
  if (HAS_BLOB_URLS) {
    const url = URL.createObjectURL(blob);
    let downloadStarted = false;

    try {
      await browser.downloads.download({ url, filename, saveAs: true });
      downloadStarted = true;
      // Browser download manager needs the URL alive briefly; revoke after 10 s
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      if (!downloadStarted) {
        // Exception thrown before or during download — revoke immediately
        URL.revokeObjectURL(url);
      }
    }
    return;
  }

  const url = await createOffscreenBlobUrl(blob);
  let downloadId;
  try {
    downloadId = await browser.downloads.download({ url, filename, saveAs: true });
  } catch (err) {
    revokeOffscreenBlobUrl(url);
    throw err;
  }

  // The blob URL must outlive the save dialog and the transfer itself
  const isFinished = (state) => state === 'complete' || state === 'interrupted';
  const release = () => {
    browser.downloads.onChanged.removeListener(onChanged);
    revokeOffscreenBlobUrl(url);
  };
  const onChanged = (delta) => {
    if (delta.id === downloadId && isFinished(delta.state?.current)) release();
  };
  browser.downloads.onChanged.addListener(onChanged);

  // Covers a download that finished before the listener was attached
  const [item] = await browser.downloads.search({ id: downloadId });
  if (!item || isFinished(item.state)) release();
}
