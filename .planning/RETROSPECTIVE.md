# Retrospective

Living document — updated at each milestone close.

---

## Milestone: v1.0 — Hardening

**Shipped:** 2026-04-20
**Phases:** 3 | **Plans:** 10

### What Was Built

- Memory-bounded ZIP assembly (stream from IDB, not full-book load)
- Per-file compression mode: STORE for images, DEFLATE for text
- Single IDB cursor pass (merged cache check + fetch)
- Worker restart recovery via browser.storage.session
- JWT URL-decoding fix (BUG-03)
- Blob URL leak fix with try/finally (BUG-01)
- Rebuild from Cache mode wired correctly (BUG-04)
- sendProgress decoupled from background.js globals (REL-02)
- Non-recursive OURN type fallback (REL-03)
- Dead GET_BOOK_INFO handler removed (REL-04)
- sender.id guard on all onMessage handlers (SEC-01)
- DOMParser-based cleanHTML preserving link tags (SEC-02, BUG-02)
- escapeXml() helper for XML injection points (SEC-03)
- sanitizeZipPath() for ZIP path traversal (code review WR-01)
- Pagination next URL host validation (code review WR-02)
- activeDownloads.set(undefined) guard (code review WR-03)

### What Worked

- **Phase ordering by user priority** — Performance first, then correctness, then security. Each phase had clear scope and no ambiguity about what belonged where.
- **Parallel worktree execution** — Plans 03-01 and 03-02 ran simultaneously in isolated worktrees with no conflicts (different files: background.js vs download.js).
- **Code review gate** — Caught 3 real security issues (WR-01 path traversal, WR-02 URL validation, WR-03 undefined key) that the plans didn't cover. All fixed before milestone close.
- **must_haves in plans** — Concrete truth statements made verification fast and unambiguous (7/7 verified instantly).

### What Was Inefficient

- **REQUIREMENTS.md kept all checkboxes unchecked** — tracking was purely in ROADMAP.md; REQUIREMENTS.md could have been kept in sync at each phase transition.
- **Human verification items not exercised** — Phase 1 has 2 items (memory bounds, worker restart) that need a live Firefox session. These could have been tested during the execution window but weren't scheduled.
- **Pending Todos not resolved** — 2 items from Phase 2 (popup state after restart, missing .catch()) carried to milestone close without being addressed.

### Patterns Established

- **Guard-first message validation** — validate source before any routing logic executes
- **Reject with bare return** — no sendResponse on rejection; attacker gets no data
- **escapeXml replaces & first** — prevents double-escaping
- **sanitizeZipPath** — strip ../ and normalize before ZIP entry construction

### Key Lessons

1. Code review catches what plans miss — run it after every phase, not just at milestone close
2. Split human-testable items into a separate checklist early so they don't carry as deferred debt
3. Parallel worktrees work well when plans target different files; check files_modified for overlap before spawning
4. Phase 2 had 5 plans in 1 wave — consider splitting large waves into two if plans are unrelated

### Cost Observations

- Sessions: ~4 (planning + 3 execution sessions)
- All phases executed with gsd-executor agents via worktree isolation
- Notable: Phase 3 had the fastest ratio — 2 security plans, both simple targeted changes, completed in ~3 minutes combined

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 3 |
| Plans | 10 |
| Requirements | 14/14 |
| Avg plans/phase | 3.3 |
| Code review findings | 6 (0 critical, 3 warning, 3 info) |
| Findings fixed | 3/3 warnings fixed |
