---
phase: 03-security-hardening
fixed_at: 2026-04-20T00:00:00Z
review_path: .planning/phases/03-security-hardening/03-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-20
**Source review:** .planning/phases/03-security-hardening/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: ZIP Path Traversal via API-Supplied `full_path`

**Files modified:** `extension/download.js`
**Commit:** b0fe32b
**Applied fix:** Added `sanitizeZipPath(p)` helper at the bottom of download.js that normalizes backslashes, then filters out `.`, `..`, and empty segments. Applied the helper at both use sites: `downloadAllFiles` (line 261) where `file.full_path` is used to construct `fullPath`, and `buildEPUB` (line 345) where the cached `fullPath` key is used to construct `zipPath`.

---

### WR-02: Unvalidated Pagination URL from API Response

**Files modified:** `extension/download.js`
**Commit:** b0fe32b
**Applied fix:** In `getAllFiles`, replaced the direct `nextUrl = data.next` assignment with a guarded block that (1) checks the value is a string when non-null, throwing a descriptive error if not, and (2) parses the URL and verifies the hostname ends with `.oreilly.com`, throwing if it does not. The final assignment uses `rawNext ?? null` so `undefined` is treated as `null` (loop termination).

---

### WR-03: Undefined `ourn` Key Causes Silent Map Collision

**Files modified:** `extension/background.js`
**Commit:** 6612e16
**Applied fix:** Added an early `if (!ourn)` guard immediately after `const ourn = message.data.ourn || message.data.isbn` in the `DOWNLOAD_EPUB` handler. When the identifier is falsy the handler returns `{ success: false, error: 'Missing book identifier (ourn or isbn)' }` and exits without touching `activeDownloads`, preventing the `undefined` key collision.

---

_Fixed: 2026-04-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
