---
phase: 02-code-correctness
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - extension/background.js
  - extension/cache.js
  - extension/content.js
  - extension/download.js
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files were reviewed at standard depth. The changes under review introduce an `onProgress` callback pattern, a `rebuildOnly` mode, a new `manifests` IndexedDB store, and a reworked cookie parser.

The cookie-parsing rewrite in `content.js` is correct. The `saveFile` try/finally blob-URL revocation in `download.js` is correct. The `getBookMetadata` two-attempt structure is correct.

Three significant issues were found:

1. `sendProgress` is referenced inside `downloadAllFiles` as a free variable, but it is defined only within `downloadEPUB`'s closure. This is a scoping bug that causes a `ReferenceError` at runtime whenever any file download completes.
2. The `rebuildOnly` path skips `downloadAllFiles` (which is the only place `mimetype` is added to the ZIP), producing an invalid EPUB that fails validation.
3. `deleteBook` in `cache.js` does not include the `manifests` store in its transaction, leaving a stale manifest entry that causes `rebuildOnly` to incorrectly report the book as fully cached after deletion.

---

## Critical Issues

### CR-01: `sendProgress` is not in scope inside `downloadAllFiles` — `ReferenceError` at runtime

**File:** `extension/download.js:244`

**Issue:** `sendProgress` is defined as a local closure inside `downloadEPUB` (lines 31-43). `downloadAllFiles` is a top-level function at module scope; it receives `zip, files, jwtToken, metadata, bookOurn, totalFileCount, fromCache` as parameters but not `sendProgress`. The references to `sendProgress` on lines 244 and 269 resolve to an unbound identifier in the global scope. In a service worker context (where there is no matching global) this throws `ReferenceError: sendProgress is not defined` the first time any file's `onComplete` callback fires — aborting the entire download.

**Fix:** Pass `sendProgress` as an explicit parameter to `downloadAllFiles`:

```javascript
// In downloadEPUB, update the call:
const { failedFiles } = await downloadAllFiles(
  zip, filesToDownload, bookData.jwtToken, metadata, bookOurn,
  files.length, fromCache, sendProgress   // <-- add sendProgress
);

// Update the function signature:
async function downloadAllFiles(zip, files, jwtToken, metadata, bookOurn, totalFileCount, fromCache, sendProgress) {
  // sendProgress is now a proper parameter; existing usages on lines 244/269 work as-is
  ...
}
```

---

## Warnings

### WR-01: `rebuildOnly` produces an invalid EPUB — `mimetype` entry is never added

**File:** `extension/download.js:98`

**Issue:** The EPUB specification requires that the `mimetype` file be the first entry in the ZIP archive, stored uncompressed. In the normal download path, `mimetype` is added by `downloadAllFiles` (line 229: `zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })`). The `rebuildOnly` branch short-circuits before `downloadAllFiles` is called, and `buildEPUB` never adds `mimetype`. The resulting ZIP file is missing this required entry, causing EPUB readers and validators to reject it.

**Fix:** Add `mimetype` before calling `buildEPUB` in the `rebuildOnly` branch:

```javascript
// In the rebuildOnly block, before the buildEPUB call (around line 97):
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
const epubBlob = await buildEPUB(zip, bookOurn);
```

Alternatively, move the `mimetype` insertion into `buildEPUB` itself so it is always present regardless of code path.

---

### WR-02: `deleteBook` leaves an orphaned manifest record — `rebuildOnly` reports false success after deletion

**File:** `extension/cache.js:96`

**Issue:** `deleteBook` opens a transaction on `['books', 'files']` (line 96) but does not include the `'manifests'` store. When a user deletes a cached book, the manifest record (stored by `storeFileManifest`) remains in IndexedDB. If the user then attempts a `rebuildOnly` download for that book, `getFileManifest` returns the stale manifest, `getCachedFilePaths` returns an empty set (files were deleted), and the rebuild throws "N file(s) missing from cache" — confusingly citing the old file list. More critically, if the user then re-downloads the book and partially fills the cache before deleting again, `rebuildOnly` may silently treat partially-cached state as complete.

**Fix:** Include `'manifests'` in the `deleteBook` transaction and delete the manifest record:

```javascript
async function deleteBook(ourn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['books', 'files', 'manifests'], 'readwrite');

    tx.objectStore('books').delete(ourn);
    tx.objectStore('manifests').delete(ourn);   // <-- add this line

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
```

---

### WR-03: `downloadFileWithRetry` does not check `response.ok` — failed fetches silently corrupt the EPUB

**File:** `extension/download.js:287`

**Issue:** `downloadFileWithRetry` calls `fetchWithRetry` and proceeds unconditionally to read the response body (lines 295-300). `fetchWithRetry` retries on 429 and 5xx, but if retries are exhausted it returns the final non-OK response rather than throwing. A 404 or persistent 403 response results in the error HTML/JSON body being treated as file content and added to the ZIP under the expected EPUB path. The resulting EPUB will contain corrupted files (e.g., an HTML error page stored as CSS or an XHTML chapter). Failures are not surfaced to `failedFiles`, so the user receives no warning.

**Fix:** Check `response.ok` and throw on failure so the error propagates to `onComplete`'s error branch, which does record the failure in `failedFiles`:

```javascript
async function downloadFileWithRetry(url, jwtToken) {
  const response = await fetchWithRetry(url, {
    headers: {
      'Accept': '*/*',
      'Authorization': `Bearer ${jwtToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text') || contentType.includes('xml') || contentType.includes('json')) {
    return await response.text();
  }
  return await response.arrayBuffer();
}
```

---

## Info

### IN-01: `buildEPUB` loads all cached files including those just added to `zip` — redundant writes in normal path

**File:** `extension/download.js:327`

**Issue:** In the normal (non-`rebuildOnly`) path, `downloadAllFiles` adds freshly-downloaded files to both `zip` and the IndexedDB cache (via `BookCache.saveFile`). Then `buildEPUB` is called on the same `zip` instance and calls `BookCache.getCachedFiles`, which returns all cached files for the book — including the ones just written. This causes duplicate `zip.file()` calls for every newly-downloaded file. JSZip silently replaces duplicate entries, so the output is functionally correct, but each freshly-downloaded file is written to the ZIP twice per download session.

This is a structural note rather than a bug. The duplication is bounded by the number of files in the book and does not affect correctness. A follow-up refactor could either skip `buildEPUB`'s cache-loading step in the normal path (since `zip` is already populated), or split `buildEPUB` into two functions — one that assembles from in-memory state and one that assembles from cache (the `rebuildOnly` case).

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
