/**
 * IndexedDB Cache Layer for EPUB Downloader
 * Caches downloaded book files to avoid re-downloading
 */

const BookCache = (() => {
  const DB_NAME = 'epub-downloader-cache';
  const DB_VERSION = 1;
  let dbInstance = null;

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'ourn' });
        }

        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: ['ourn', 'fullPath'] });
          fileStore.createIndex('byBook', 'ourn', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        dbInstance.onclose = () => { dbInstance = null; };
        resolve(dbInstance);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async function getBookMeta(ourn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readonly');
      const request = tx.objectStore('books').get(ourn);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveBookMeta(ourn, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite');
      tx.objectStore('books').put({
        ourn,
        title: data.title,
        isbn: data.isbn,
        metadata: data,
        fileCount: data.fileCount || 0,
        cachedFileCount: data.cachedFileCount || 0,
        complete: data.complete || false,
        cachedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function listCachedBooks() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readonly');
      const request = tx.objectStore('books').getAll();
      request.onsuccess = () => {
        resolve(request.result.map(b => ({
          ourn: b.ourn,
          title: b.title,
          isbn: b.isbn,
          fileCount: b.fileCount,
          cachedFileCount: b.cachedFileCount,
          complete: b.complete,
          cachedAt: b.cachedAt
        })));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteBook(ourn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['books', 'files'], 'readwrite');

      tx.objectStore('books').delete(ourn);

      const fileStore = tx.objectStore('files');
      const index = fileStore.index('byBook');
      const request = index.openCursor(IDBKeyRange.only(ourn));
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getFile(ourn, fullPath) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const request = tx.objectStore('files').get([ourn, fullPath]);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveFile(ourn, fullPath, data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put({
        ourn,
        fullPath,
        content: data.content,
        mediaType: data.mediaType,
        kind: data.kind,
        cachedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getCachedFilePaths(ourn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const paths = new Set();
      const tx = db.transaction('files', 'readonly');
      const index = tx.objectStore('files').index('byBook');
      const request = index.openCursor(IDBKeyRange.only(ourn));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          paths.add(cursor.value.fullPath);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(paths);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getFiles(ourn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const index = tx.objectStore('files').index('byBook');
      const request = index.getAll(IDBKeyRange.only(ourn));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function clearAll() {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  return {
    openDB,
    getBookMeta,
    saveBookMeta,
    listCachedBooks,
    deleteBook,
    getFile,
    saveFile,
    getCachedFilePaths,
    getFiles,
    clearAll
  };
})();
