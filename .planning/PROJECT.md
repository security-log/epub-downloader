# epub-downloader — Project

## What This Is

A Firefox WebExtension (Manifest V3) that downloads O'Reilly Learning Platform books as EPUB files. The extension scrapes book metadata from live O'Reilly pages, fetches all EPUB files via the O'Reilly API using the user's JWT session cookie, assembles them into a valid EPUB ZIP, and saves the result via the browser downloads API.

**v1.0 Shipped:** Full hardening milestone complete — memory-bounded downloads, worker restart recovery, 6 bug fixes, and security hardening (sender validation, DOMParser sanitization, XML escaping).

## Core Value

Users can reliably download any O'Reilly book as a well-formed EPUB, even for large books, without the extension leaking memory, exposing the JWT token, or corrupting the output.

## Requirements

### Validated

- ✓ Download O'Reilly books as EPUB via extension popup — existing
- ✓ Cache downloaded files in IndexedDB to skip re-fetching — existing
- ✓ Concurrent file fetching with retry logic (10 parallel, exponential backoff) — existing
- ✓ Download history tracked in browser.storage.local — existing
- ✓ Three download modes: Normal, Rebuild from Cache, Force Re-download — v1.0
- ✓ Memory usage stays bounded during ZIP assembly (stream files one-at-a-time) — v1.0
- ✓ Pre-compressed image files stored without re-compression (STORE mode) — v1.0
- ✓ Single IndexedDB cursor pass (cache check + fetch merged) — v1.0
- ✓ Worker restart recovery via browser.storage.session — v1.0
- ✓ Object URLs always revoked after download (no leaks) — v1.0
- ✓ JWT cookie URL-decoded before Authorization header — v1.0
- ✓ Rebuild from Cache mode skips network entirely — v1.0
- ✓ sendProgress decoupled from background.js globals — v1.0
- ✓ sender.id validated in all onMessage handlers — v1.0
- ✓ DOMParser-based HTML sanitization (not regex) — v1.0
- ✓ XML injection points escaped (escapeXml helper) — v1.0
- ✓ ZIP path traversal sanitized (sanitizeZipPath) — v1.0

### Active

- [ ] Download cancellation message type (REL-v2-01)
- [ ] IndexedDB LRU eviction based on cachedAt timestamp (REL-v2-02)
- [ ] Unit tests for core functions: cleanHTML, fetchWithRetry, ConcurrencyPool, getBookMetadata (TEST-v2-01)
- [ ] JSZip version pinned and hash-validated in CI (SEC-v2-02)

### Out of Scope

| Feature | Reason |
|---------|--------|
| New content types (video, learning paths) | Future milestone — requires OURN type expansion |
| OAuth / token refresh | Not needed; JWT TTL is sufficient for session use |
| New user-facing UI features | Hardening milestone only |
| Build tooling / bundler | No-build constraint maintained |
| DOMParser edge cases for malformed EPUB content | Deferred to v2 (SEC-v2-01) |

## Context

- **v1.0 shipped 2026-04-20**: 3 phases, 10 plans, 14/14 v1 requirements complete
- Extension JS: ~1,413 lines across 6 core files + vendored JSZip
- No build step; plain ES2020+ JS running directly in Firefox
- Only external dependency: vendored `lib/jszip.min.js` (version untracked — pin in v2)
- CI validates manifest JSON syntax and file existence only
- No automated tests — all validation is manual (TEST-v2-01 deferred)
- Known deferred: human verification of memory bounds and worker restart in live Firefox session

## Constraints

- **Compatibility**: Must stay Manifest V3; no Node.js or bundler introduced
- **Dependencies**: No new external libraries — use Web APIs (DOMParser, TextEncoder, etc.)
- **Scope**: New user-facing features deferred until hardening is verified in production use

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Performance before security | User-prioritized; memory issues are more immediately impactful | ✓ Good — phased approach kept each phase focused |
| Include known bugs alongside hardening | Bugs and hardening are interleaved; fixing together more efficient | ✓ Good — all 6 bugs resolved in Phase 2 |
| DOMParser over regex for HTML sanitization | DOMParser is available in service workers and is structurally sound | ✓ Good — structural removal, link tags preserved |
| browser.storage.session for activeDownloads persistence | MV3 session storage survives brief worker restarts without persisting across browser restarts | ✓ Good — worker restart recovery working |
| Bare return on message rejection (no sendResponse) | Attacker receives no data on rejection — minimizes information disclosure | ✓ Good — T-03-02 mitigated |
| escapeXml replaces & first | Prevents double-escaping when applied to strings with & already | ✓ Good — correct escaping order |

---
*Last updated: 2026-04-20 after v1.0 milestone*
