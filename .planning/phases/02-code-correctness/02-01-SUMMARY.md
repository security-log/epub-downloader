---
phase: 02-code-correctness
plan: 01
subsystem: auth
tags: [jwt, cookies, decodeURIComponent, content-script]

# Dependency graph
requires: []
provides:
  - "getJWTToken() safely decodes URL-encoded JWT cookie values before use in Authorization header"
affects: [download, background]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Safe cookie value parsing: indexOf-based split + decodeURIComponent try/catch fallback"]

key-files:
  created: []
  modified: [extension/content.js]

key-decisions:
  - "Use indexOf('=') instead of split('=') to handle base64 JWT padding characters correctly"
  - "Wrap decodeURIComponent in try/catch and fall back to rawValue to handle malformed percent-encoding gracefully"

patterns-established:
  - "Cookie value parsing: always split on first '=' only to preserve base64-padded values"
  - "Percent-decode external values with try/catch fallback for resilience"

requirements-completed: [BUG-03]

# Metrics
duration: 1min
completed: 2026-04-20
---

# Phase 02 Plan 01: JWT Cookie URL-Decode Fix Summary

**Safe decoding of percent-encoded JWT cookie values via decodeURIComponent with rawValue fallback and indexOf-based cookie split**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-20T01:48:21Z
- **Completed:** 2026-04-20T01:48:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed BUG-03: JWT cookies containing `%2F`, `%2B`, `%3D`, and other percent-encoded characters are now decoded before being passed as the Authorization Bearer token
- Fixed secondary issue: split on first `=` only (using `indexOf`) so JWT values with base64 padding (`=`) are not truncated
- Malformed/unencodable cookie values fall back to the raw string — no crash, no broken auth flow

## Task Commits

Each task was committed atomically:

1. **Task 1: URL-decode JWT cookie value in getJWTToken (BUG-03, D-02)** - `4e0f77d` (fix)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `extension/content.js` - `getJWTToken()` rewritten with indexOf-based split and decodeURIComponent try/catch

## Decisions Made
- Chose `indexOf('=')` over `split('=', 2)` because the latter still splits on all `=` before joining — `indexOf` is explicit and correct.
- Kept try/catch fallback to rawValue rather than returning null on decode error, to preserve auth flow for edge-case tokens.

## Deviations from Plan

None - plan executed exactly as written.

Note: The acceptance criterion `grep -c "try {" extension/content.js` outputs `2` was slightly inaccurate — the file already had 2 try blocks in `extractBookInfo` (outer + inner JSON parse), so the post-fix count is 3. The new try block in `getJWTToken` is correctly placed at line 95.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BUG-03 resolved; JWT auth flow now handles all standard O'Reilly cookie formats
- Remaining Phase 2 plans (02-02 through 02-05) proceed independently

---
*Phase: 02-code-correctness*
*Completed: 2026-04-20*
