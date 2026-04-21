# Milestones

## v1.0 — Hardening

**Shipped:** 2026-04-20
**Phases:** 1–3 | **Plans:** 10 | **Tasks:** ~22

**Delivered:** Full hardening of the O'Reilly EPUB downloader — memory-bounded downloads, worker restart recovery, 6 bug fixes, and 3 security hardening changes.

**Key Accomplishments:**
1. Bounded memory: files streamed one-at-a-time into ZIP via JSZip async generation — no full-book load into memory
2. Pre-compressed images (JPEG, PNG, GIF) stored with STORE mode — smaller EPUBs, faster assembly
3. Single IndexedDB cursor pass replaces double scan (cache check + fetch merged)
4. Worker restart recovery via `browser.storage.session` — in-flight downloads survive MV3 service worker restarts
5. All 6 code-correctness bugs fixed: JWT URL-decoding, blob URL leak, Rebuild mode, sendProgress decoupling, non-recursive OURN fallback, dead handler removal
6. Security hardening: sender.id message guard, DOMParser HTML sanitization (preserves link tags), XML injection escaping, ZIP path traversal sanitization

**Requirements:** 14/14 v1 requirements complete

**Known deferred items at close:** 2 (see STATE.md Deferred Items — human verification requiring live Firefox session)

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`
