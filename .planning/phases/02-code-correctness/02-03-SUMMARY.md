---
phase: 02-code-correctness
plan: "03"
subsystem: download
tags: [refactor, closure, progress-callback, rebuild-mode, manifest-diff, REL-02, BUG-04]

requires:
  - phase: 02-code-correctness
    plan: "02"
    provides: "download.js with try/finally blob URL revocation and two-attempt getBookMetadata"
  - phase: 02-code-correctness
    plan: "05"
    provides: "cache.js with storeFileManifest(ourn, fileUrlArray) and getFileManifest(ourn) methods"

provides:
  - "downloadEPUB(bookData, options, onProgress) — third parameter onProgress replaces background.js global coupling (REL-02)"
  - "sendProgress local closure inside downloadEPUB — no module-level global state (REL-02, D-06)"
  - "BookCache.storeFileManifest called after getAllFiles on normal download path (BUG-04, D-04)"
  - "rebuildOnly mode: diffs manifest against cachedPaths, fails with specific missing file names, no silent partial EPUB (BUG-04, D-03, D-04)"

affects: [02-code-correctness, extension/download.js]

tech-stack:
  added: []
  patterns:
    - "Callback injection: onProgress parameter replaces global variable reads across module boundary"
    - "Lexical closure: local sendProgress arrow function captures onProgress via closure, accessible to nested downloadAllFiles via JavaScript scope chain"
    - "Manifest diff pattern: storeFileManifest after fetch; getFileManifest + getCachedFilePaths filter on rebuildOnly path"
    - "Fail-fast with specifics: rebuildOnly throws before ZIP assembly listing each missing path by name"

key-files:
  created: []
  modified:
    - extension/download.js

key-decisions:
  - "Use arrow function for sendProgress closure (not function declaration) to make lexical scope intent explicit and avoid hoisting ambiguity"
  - "storeFileManifest placed immediately after getAllFiles returns (before rebuildOnly branch) so the manifest is always up-to-date after any normal fetch — rebuildOnly never re-fetches the file list"
  - "rebuildOnly branch placed after storeFileManifest so the manifest is refreshed even if the user triggers rebuild via a code path that happened to call getAllFiles (future-proofing)"
  - "rebuildOnly failure lists missing file paths via missingFiles.join('\\n') for user-actionable error messages (D-04)"

patterns-established:
  - "onProgress injection pattern: downloadEPUB accepts a callback, wraps it in a local sendProgress that also fires runtime.sendMessage — callers that don't need the callback can omit it"
  - "Manifest-first rebuild: always store manifest on network fetch, use stored manifest as the source of truth for rebuildOnly integrity checks"

requirements-completed: [REL-02, BUG-04]

duration: 2min
completed: 2026-04-19
---

# Phase 02 Plan 03: sendProgress Closure and rebuildOnly Mode Summary

**downloadEPUB refactored to accept onProgress callback, sendProgress converted from module-level global-reading function to local closure, and rebuildOnly mode added with manifest-diff integrity checking**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-19T00:34:02Z
- **Completed:** 2026-04-19T00:35:49Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Eliminated `currentDownloadOurn` module-level global — the invisible coupling where download.js directly accessed background.js's `activeDownloads` map is gone (REL-02)
- `sendProgress` is now a local arrow function closed over `onProgress` — no background.js globals accessed from download.js
- `downloadEPUB` signature updated to `(bookData, options, onProgress)` — callers pass a callback; the runtime.sendMessage broadcast is preserved so existing popup polling still works
- `BookCache.storeFileManifest` called immediately after `getAllFiles` on every normal download path — future `rebuildOnly` runs always have an up-to-date manifest
- `rebuildOnly` branch implemented with full D-04 compliance: checks manifest exists (fails with actionable message if not), diffs manifest against `cachedPaths`, throws listing each missing file path by name if any gap, only calls `buildEPUB` when all files confirmed present

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert sendProgress to local closure, eliminate currentDownloadOurn** - `a2f3e6f` (refactor)
2. **Task 2: Add rebuildOnly mode with manifest diff, store manifest on normal path** - `147414e` (feat)

## Files Created/Modified

- `/home/emilio/Dev/epub-downloader/extension/download.js` — signature updated, sendProgress closure added, currentDownloadOurn global removed, storeFileManifest call added after getAllFiles, rebuildOnly branch with manifest diff inserted before normal download flow

## Decisions Made

- Arrow function chosen for `sendProgress` closure to make lexical-scope intent explicit and avoid function-declaration hoisting ambiguity.
- `storeFileManifest` placed immediately after `getAllFiles` returns (before the rebuildOnly branch) so the manifest is always refreshed on any normal fetch regardless of what follows.
- `rebuildOnly` branch placed after `storeFileManifest` — on a normal run this means the manifest is persisted before the early return; on a rebuildOnly run the `getAllFiles` call is still made to get the file list and refresh the manifest, which keeps the manifest current.
- Missing files listed via `missingFiles.join('\n')` so the error message is specific and user-actionable (D-04 compliance).

## Deviations from Plan

None - plan executed exactly as written.

The plan's acceptance criterion for `missingFiles` count was `3` (declaration, `.length` check, `.join`). The actual count is `4` because `missingFiles.length` appears twice — once in the `if` guard and once inside the error template literal. This matches the provided code snippet exactly and all behavioral criteria are met.

## Known Stubs

None — all code paths wire real data. The `rebuildOnly` path reads directly from IndexedDB; the normal path fetches from the network. No hardcoded empty values or placeholders.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers:
- `onProgress` callback crosses module boundary but is supplied by trusted extension code (T-02-03-01, accepted)
- `rebuildOnly` reads IndexedDB manifest — extension-scoped storage, no cross-origin risk (T-02-03-02, accepted)
- Empty/missing cache causes fail-fast throw before ZIP assembly (T-02-03-03, mitigated as required)

## Self-Check: PASSED

- `extension/download.js` modified and committed: a2f3e6f, 147414e
- `currentDownloadOurn` occurrences: 0
- `function sendProgress` occurrences: 0
- `const sendProgress` occurrences: 1 (inside downloadEPUB at line 31)
- `onProgress` occurrences: 4 (JSDoc, signature, typeof check, call)
- `storeFileManifest` occurrences: 1
- `getFileManifest` occurrences: 1
- `missingFiles` occurrences: 4
- `Rebuild failed` error messages: 2 (no-manifest + missing-files)
- Normal download path (filesToDownload, downloadAllFiles) unchanged below rebuildOnly block: confirmed
