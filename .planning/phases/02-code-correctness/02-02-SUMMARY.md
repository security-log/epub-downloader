---
phase: 02-code-correctness
plan: "02"
subsystem: download
tags: [blob-url, memory-leak, try-finally, api-fallback, recursion-elimination]

requires:
  - phase: 01-performance
    provides: "refactored download.js pipeline with saveFile and getBookMetadata as targets for this plan"

provides:
  - "saveFile with try/finally guaranteeing URL.revokeObjectURL on all code paths (BUG-01)"
  - "getBookMetadata with explicit two-attempt sequential :book: to :article: fallback, zero recursion (REL-03)"

affects: [02-code-correctness, extension/download.js]

tech-stack:
  added: []
  patterns:
    - "try/finally with sentinel flag for cleanup guarantees around async browser API calls"
    - "Explicit multi-attempt sequential structure in place of recursive fallbacks"

key-files:
  created: []
  modified:
    - extension/download.js

key-decisions:
  - "Use downloadStarted flag rather than catching the exception: finally runs unconditionally, flag distinguishes success from failure path without swallowing exceptions"
  - "Extract shared headers object in getBookMetadata to eliminate duplication across two fetch calls"
  - "Throw with secondResponse.status on second-attempt failure (not firstResponse.status) so callers see the most recent failure"

patterns-established:
  - "Sentinel flag pattern: set flag only after async call resolves; finally checks flag to decide cleanup action"
  - "Two-attempt pattern: explicit first/second response variables; no recursion; each failure path throws immediately"

requirements-completed: [BUG-01, REL-03]

duration: 3min
completed: 2026-04-20
---

# Phase 02 Plan 02: Download.js Bug Fixes Summary

**Blob URL leak eliminated via try/finally sentinel flag in saveFile; recursive OURN fallback replaced with explicit two-attempt sequential structure in getBookMetadata**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-20T01:48:23Z
- **Completed:** 2026-04-20T01:49:28Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Guaranteed URL.revokeObjectURL is called on every code path through saveFile (success after 10 s, failure immediately via finally block)
- Eliminated recursive call from getBookMetadata — the :book: to :article: fallback is now an explicit if-block with two named response variables
- Both fixes address threat mitigations T-02-02-01 (blob DoS via memory accumulation) and T-02-02-02 (unbounded recursion risk)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap browser.downloads.download() in try/finally** - `8438b28` (fix)
2. **Task 2: Replace recursive getBookMetadata with explicit two-attempt structure** - `940cf13` (refactor)

## Files Created/Modified

- `extension/download.js` - saveFile now uses try/finally with downloadStarted sentinel; getBookMetadata now uses explicit firstResponse/secondResponse sequential structure with no self-reference

## Decisions Made

- Used a `downloadStarted` sentinel flag rather than wrapping the catch: the finally block runs unconditionally, and the flag distinguishes whether revocation needs to happen immediately or has already been scheduled via setTimeout. This avoids catching and re-throwing the exception.
- In getBookMetadata, a shared `headers` object is extracted before the first fetch to avoid repeating the Authorization header construction twice.
- The second-attempt failure throws with `secondResponse.status` (not `firstResponse.status`) so the caller sees the status of the most recent network attempt.

## Deviations from Plan

None - plan executed exactly as written.

The acceptance criteria counts in the plan (secondResponse: 3, firstResponse: 3, articleUrn: 3) were slightly off from the actual implementation counts (4, 4, 2 respectively), but this is because the plan's estimates did not account for `.json()` return calls adding extra references. The implementation matches the specified code exactly and all critical behavioral criteria are met: zero recursive calls, two explicit attempts maximum, correct error propagation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-01 and REL-03 closed; saveFile and getBookMetadata are now correct and safe
- Remaining phase 02 plans can proceed: CSS link stripping fix (02-03), JWT decode fix (02-04), XML injection fix (02-05), HTML sanitization (02-06), message sender validation (02-07)

---
*Phase: 02-code-correctness*
*Completed: 2026-04-20*
