---
phase: 01-performance-worker-reliability
plan: 02
subsystem: download
tags: [epub, jszip, indexeddb, session-storage, firefox-extension, performance]

# Dependency graph
requires:
  - phase: 01-performance-worker-reliability
    plan: 01
    provides: "BookCache.getCachedFiles(ourn) — single-pass IDB cursor returning Map<fullPath, {content, mediaType, kind}>"
provides:
  - "downloadAllFiles writes directly to JSZip instance — no accumulated Map"
  - "buildEPUB(zip, ourn) receives pre-populated zip, adds cached files, calls generateAsync"
  - "PRE_COMPRESSED_TYPES STORE compression for jpeg/png/gif/webp"
  - "sendProgress fire-and-forget browser.storage.session.set write-through"
affects:
  - 01-03
  - extension/background.js (reads activeDownloads from session storage restored by this write-through)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSZip threading: single zip instance created in downloadEPUB, passed through downloadAllFiles and buildEPUB"
    - "Per-file STORE compression: zipOptions(mediaType) helper returns STORE for PRE_COMPRESSED_TYPES"
    - "Fire-and-forget session sync: browser.storage.session.set in sendProgress with .catch() only"
    - "Single IDB pass: getCachedFilePaths for filter, getCachedFiles inside buildEPUB for content"

key-files:
  created: []
  modified:
    - extension/download.js

key-decisions:
  - "getCachedFilePaths retained in downloadEPUB for the filesToDownload filter; getCachedFiles called inside buildEPUB for cached file content — the two operations are disjoint and serve different purposes"
  - "mimetype entry added to zip before pool.run() — EPUB spec requires it first; STORE compression mandatory"
  - "container.xml uses STORE compression (application/oebps-package+xml detection in both downloadAllFiles and buildEPUB)"

patterns-established:
  - "zipOptions(mediaType) helper centralizes compression decision — extend PRE_COMPRESSED_TYPES Set to add new image types"

requirements-completed:
  - PERF-01
  - PERF-02
  - PERF-03

# Metrics
duration: 2min
completed: 2026-04-19
---

# Phase 01 Plan 02: Refactor download.js for JSZip threading, per-file compression, and session write-through Summary

**JSZip instance threaded through downloadAllFiles and buildEPUB eliminating the downloaded Map; STORE compression for pre-compressed image types; fire-and-forget session write-through in sendProgress**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-19T20:51:15Z
- **Completed:** 2026-04-19T20:53:15Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `PRE_COMPRESSED_TYPES` Set (`image/jpeg`, `image/png`, `image/gif`, `image/webp`) at module level
- Added `zipOptions(mediaType)` helper returning `{ compression: 'STORE' }` for pre-compressed types
- Refactored `downloadAllFiles` to accept `zip` as first parameter; writes directly to zip via `zip.file()` in onComplete; returns only `{ failedFiles }` — no accumulated Map
- `mimetype` entry added to zip before `pool.run()` with `STORE` compression (EPUB spec requirement, T-02-03 mitigated)
- Refactored `buildEPUB` to accept `(zip, ourn)`; calls `BookCache.getCachedFiles(ourn)` to add cached files to the pre-populated zip; calls `generateAsync` — no new JSZip construction
- Updated `downloadEPUB` to construct `const zip = new JSZip()` and pass it to both `downloadAllFiles` and `buildEPUB`
- Removed the old `cachedFiles = new Map()` accumulation and `getFiles` two-call pattern from `downloadEPUB`
- Added fire-and-forget `browser.storage.session.set({ activeDownloads: Object.fromEntries(activeDownloads) })` in `sendProgress` after Map mutation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PRE_COMPRESSED_TYPES, zipOptions, refactor downloadAllFiles and buildEPUB signatures** - `32b1379` (feat)
2. **Task 2: Update downloadEPUB call sites and add sendProgress session write-through** - `23ab86d` (feat)

## Files Created/Modified

- `extension/download.js` - Refactored download pipeline: PRE_COMPRESSED_TYPES constant, zipOptions helper, downloadAllFiles with zip parameter, buildEPUB with (zip, ourn) signature, downloadEPUB with single JSZip instance, sendProgress with session write-through

## Decisions Made

- `getCachedFilePaths` is retained in `downloadEPUB` for the filesToDownload filter (single path set needed for set subtraction); `getCachedFiles` is called inside `buildEPUB` to load content for cached files into zip — the two operations serve different purposes and the PERF-03 goal (eliminate the old `getFiles` two-call) is achieved
- `container.xml` entry uses `{ compression: 'STORE' }` in both `downloadAllFiles` and `buildEPUB` — XML metadata files that EPUB readers must parse quickly benefit from uncompressed access

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

T-02-03 mitigation confirmed: `mimetype` is added to zip via `zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })` before `pool.run()` — ordering preserved. No new trust boundaries introduced.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (worker restart recovery) depends on the `sendProgress` session write-through added here — that write-through is now in place
- `buildEPUB(zip, ourn)` signature is stable for any future callers
- No blockers

## Self-Check

- `extension/download.js` exists: checked
- Task 1 commit `32b1379`: checked
- Task 2 commit `23ab86d`: checked
- `grep -c "PRE_COMPRESSED_TYPES" extension/download.js` = 2: verified
- `grep -c "downloaded = new Map" extension/download.js` = 0: verified
- `grep -c "downloaded\.set\|downloaded\.has" extension/download.js` = 0: verified
- `grep -c "getCachedFiles" extension/download.js` = 1: verified
- `grep -c "zip\.file(" extension/download.js` = 6: verified
- `grep -c "compression.*STORE" extension/download.js` = 4: verified
- `grep "async function buildEPUB" extension/download.js` = `(zip, ourn)`: verified
- `grep "async function downloadAllFiles" extension/download.js` = `(zip,`: verified
- `grep -c "storage\.session\.set" extension/download.js` = 1: verified
- No stubs found: verified

## Self-Check: PASSED

---
*Phase: 01-performance-worker-reliability*
*Completed: 2026-04-19*
