---
phase: 01-performance-worker-reliability
plan: 01
subsystem: database
tags: [indexeddb, cache, epub, firefox-extension]

# Dependency graph
requires: []
provides:
  - "BookCache.getCachedFiles(ourn) — single-pass IDB cursor returning Map<fullPath, {content, mediaType, kind}>"
affects:
  - 01-02
  - download.js buildEPUB (Plan 02 consumes getCachedFiles)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IDB cursor walk resolves on tx.oncomplete (not inside onsuccess null-cursor branch)"
    - "Map<string, {content, mediaType, kind}> as cache projection type for EPUB assembly"

key-files:
  created: []
  modified:
    - extension/cache.js

key-decisions:
  - "Resolve on tx.oncomplete not in onsuccess null-cursor branch — matches getCachedFilePaths and deleteBook pattern; ensures all cursor entries are committed before resolve"
  - "Project only {content, mediaType, kind} into Map values — fullPath used as key; cachedAt and ourn excluded as not needed by buildEPUB"

patterns-established:
  - "Cursor-based IDB reads resolve on tx.oncomplete, not on the null-cursor check in onsuccess"

requirements-completed:
  - PERF-03

# Metrics
duration: 5min
completed: 2026-04-19
---

# Phase 01 Plan 01: Add getCachedFiles to BookCache Summary

**Single-pass IndexedDB cursor method getCachedFiles(ourn) returning Map<fullPath, {content, mediaType, kind}> to eliminate the double-scan pattern in the download path**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-19T20:41:00Z
- **Completed:** 2026-04-19T20:46:28Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `getCachedFiles(ourn)` to the `BookCache` IIFE in `extension/cache.js`
- Function walks the `byBook` IDB index via a cursor in a single transaction, collecting all cached files for a book into a `Map<fullPath, {content, mediaType, kind}>`
- Resolves on `tx.oncomplete` (not inside onsuccess null-cursor branch), matching the established pattern from `getCachedFilePaths` and `deleteBook`
- All existing methods (`getCachedFilePaths`, `getFiles`, etc.) remain unchanged and available

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getCachedFiles(ourn) to BookCache** - `27ecbfc` (feat)

## Files Created/Modified
- `extension/cache.js` - Added `getCachedFiles` function (lines 160-183) and exported it in the IIFE return object

## Decisions Made
- Resolve on `tx.oncomplete` not in the onsuccess null-cursor branch — consistent with all other cursor-based methods in this file
- Destructure only `{ fullPath, content, mediaType, kind }` from `cursor.value` — `cachedAt` and `ourn` are not needed by the consumer (`buildEPUB`)

## Deviations from Plan

None - plan executed exactly as written.

Note: The acceptance criterion states `grep -c "getCachedFiles" extension/cache.js` outputs 3, but the function has 2 occurrences (declaration + return object entry) since there are no internal uses. This is correct — the "3" in the plan comment was a conservative estimate including "any internal uses" which do not apply here.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `BookCache.getCachedFiles(ourn)` is now available for Plan 02 (`download.js` buildEPUB refactor) to call as a single IDB transaction replacing the two-call `getCachedFilePaths` + `getFiles` pattern
- No blockers

---
*Phase: 01-performance-worker-reliability*
*Completed: 2026-04-19*
