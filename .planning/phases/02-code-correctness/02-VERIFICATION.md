---
phase: 02-code-correctness
verified: 2026-04-20T12:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "rebuildOnly mode now branches at line 76, before getAllFiles() at line 108 — rebuild is network-free"
  gaps_remaining: []
  regressions: []
---

# Phase 2: Code Correctness Verification Report

**Phase Goal:** Downloads complete correctly and cleanly — no resource leaks, no encoding failures, no broken modes, no dead message handlers
**Verified:** 2026-04-20
**Status:** passed
**Re-verification:** Yes — after gap closure (rebuildOnly/getAllFiles ordering fix)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Starting and cancelling (or failing) a download does not leave orphaned blob URLs in memory | VERIFIED | `saveFile()` lines 384-403: try/finally with `downloadStarted` sentinel. `finally` block revokes immediately when `!downloadStarted`; `setTimeout(..., 10000)` handles success path. Both code paths call `URL.revokeObjectURL`. No regression. |
| 2 | A JWT cookie containing URL-encoded characters produces a correctly-formed Authorization header | VERIFIED | `getJWTToken()` lines 86-103: indexOf-based split on first `=`, `decodeURIComponent(rawValue)` inside try/catch, fallback to `rawValue` on decode error. Decoded value assigned to `bookData.jwtToken`. No regression. |
| 3 | Rebuild from Cache mode assembles the EPUB entirely from IndexedDB without making any network requests; if any expected file is missing from cache, the download fails with a clear error listing the missing files by name | VERIFIED | `if (options.rebuildOnly)` branch at line 76 executes before `getAllFiles()` at line 108. Branch loads manifest from IDB (line 79), diffs against `getCachedFilePaths()` (lines 87-93), throws with specific missing filenames if incomplete (lines 89-93), otherwise calls `buildEPUB()` and returns at line 104 — `getAllFiles()` is unreachable in rebuildOnly mode. Gap closed. |
| 4 | downloadEPUB() reports progress via a callback parameter — background.js globals are not accessed directly from download.js | VERIFIED | `downloadEPUB` signature at line 27 includes `onProgress` as third parameter. `sendProgress` is a local arrow function at lines 31-43 closing over `onProgress`. No access to `currentDownloadOurn` or `activeDownloads` anywhere in download.js. background.js supplies inline `onProgress` callback at lines 84-93, passed as third arg at line 95. No regression. |
| 5 | The dead GET_BOOK_INFO handler is absent from background.js source | VERIFIED | No `GET_BOOK_INFO` string or `return false` statement found in background.js. The live GET_BOOK_INFO handler remains in content.js (line 111), which is correct per the three-tier architecture. No regression. |

**Score:** 5/5 truths verified

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content.js` | getJWTToken() with decodeURIComponent wrapping | VERIFIED | Lines 86-103: indexOf-based split, decodeURIComponent try/catch, rawValue fallback |
| `extension/download.js` | saveFile with try/finally; downloadEPUB(bookData, options, onProgress); local sendProgress closure; rebuildOnly branch before getAllFiles | VERIFIED | All elements present and substantive. rebuildOnly branch at line 76 precedes getAllFiles() at line 108. Gap resolved. |
| `extension/cache.js` | storeFileManifest and getFileManifest on BookCache | VERIFIED | DB_VERSION=2, manifests store in onupgradeneeded (lines 29-31), storeFileManifest at line 209, getFileManifest at line 223, both exported in return object at lines 248-249 |
| `extension/background.js` | handleDownloadRequest with onProgress callback; no GET_BOOK_INFO handler | VERIFIED | onProgress defined at lines 84-93, passed as third arg at line 95; no GET_BOOK_INFO handler present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| content.js getJWTToken() | bookData.jwtToken | return value in sendResponse | WIRED | decodeURIComponent applied before assignment |
| download.js saveFile() | URL.revokeObjectURL | finally block | WIRED | Lines 397-401: finally checks !downloadStarted |
| download.js downloadEPUB() | rebuildOnly branch | if (options.rebuildOnly) at line 76 | WIRED | Branch executes before getAllFiles() at line 108; returns at line 104 |
| download.js rebuildOnly path | BookCache.getFileManifest + cachedPaths diff | manifest diff before buildEPUB | WIRED | Lines 79-93: manifest check + diff + throw; getAllFiles() not reachable |
| download.js downloadEPUB() | sendProgress local closure | const sendProgress arrow fn | WIRED | Line 31: closure over onProgress |
| download.js downloadEPUB() normal path | BookCache.storeFileManifest | called after getAllFiles | WIRED | Line 112: storeFileManifest called on non-rebuildOnly path |
| background.js handleDownloadRequest() | downloadEPUB() | third argument onProgress callback | WIRED | Line 95: downloadEPUB(bookData, options, onProgress) |
| onProgress callback | activeDownloads + browser.storage.session.set | inline callback body | WIRED | Lines 84-93: entry mutation + session write-through |
| cache.js BookCache return object | storeFileManifest / getFileManifest | exported methods | WIRED | Lines 248-249 in return object |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| download.js saveFile() | blob (input) | caller — zip.generateAsync() | Yes | FLOWING — real ZIP blob from JSZip |
| download.js rebuildOnly path | cachedPaths | BookCache.getCachedFilePaths() | Yes — IndexedDB cursor | FLOWING |
| download.js rebuildOnly path | manifest | BookCache.getFileManifest() | Yes — IndexedDB get on manifests store | FLOWING |
| background.js onProgress | activeDownloads entry | activeDownloads Map | Yes — real progress values | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (no runnable entry points — browser extension context required for IndexedDB, browser.downloads, browser.runtime.sendMessage).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BUG-01 | 02-02 | Object URLs in saveFile always revoked even on failure | SATISFIED | try/finally with downloadStarted sentinel in download.js lines 384-403 |
| BUG-03 | 02-01 | JWT cookie URL-decoded before Authorization header | SATISFIED | decodeURIComponent in getJWTToken() content.js lines 95-98 |
| BUG-04 | 02-03, 02-05 | Rebuild from Cache skips network fetches; fails with missing file names | SATISFIED | rebuildOnly branch at line 76 precedes getAllFiles() at line 108; missing-file diff throws with specific names at lines 89-93 |
| REL-02 | 02-03, 02-04 | downloadEPUB() receives progress callback instead of accessing background.js globals | SATISFIED | onProgress parameter at line 27; local sendProgress closure at line 31; background.js supplies callback at line 84 |
| REL-03 | 02-02 | OURN type fallback uses explicit two-attempt structure, no recursion | SATISFIED | getBookMetadata() lines 165-190: firstResponse/secondResponse sequential, zero self-calls |
| REL-04 | 02-04 | Dead GET_BOOK_INFO handler removed from background.js | SATISFIED | No match for GET_BOOK_INFO in background.js |

**Orphaned requirements check:** BUG-02, SEC-01, SEC-02, SEC-03 are mapped to Phase 3 (Security Hardening). No orphaned requirements for Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| extension/download.js | 354 | `content.replace(/<link[^>]*>/gi, '')` strips all link tags including stylesheets | Info | BUG-02 (preserve CSS link tags) is assigned to Phase 3. Pre-existing issue, not a Phase 2 regression. |

No TODO/FIXME/placeholder comments. No stub return values. No empty handlers. No `return null` or `return {}` in user-visible paths.

### Human Verification Required

None. All automated checks were conclusive.

### Gaps Summary

No gaps. The previously identified gap (BUG-04 partial — rebuildOnly mode made network requests) has been resolved. The `if (options.rebuildOnly)` branch is now at line 76 of download.js, executing before `getAllFiles()` at line 108. The rebuildOnly code path loads its file list from IndexedDB (`getFileManifest`), diffs against cached paths, fails with specific missing file names if incomplete, and assembles the EPUB directly — no HTTP calls are made.

All 5 must-haves are verified. Phase goal achieved.

---

_Verified: 2026-04-20_
_Verifier: Claude (gsd-verifier)_
