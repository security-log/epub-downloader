---
phase: 02-code-correctness
plan: "05"
subsystem: cache
tags: [indexeddb, cache, manifest, bug-fix]
dependency_graph:
  requires: []
  provides: [BookCache.storeFileManifest, BookCache.getFileManifest, manifests-store]
  affects: [extension/cache.js]
tech_stack:
  added: []
  patterns: [IndexedDB schema versioning with onupgradeneeded guards]
key_files:
  created: []
  modified:
    - extension/cache.js
decisions:
  - "DB_VERSION bumped to 2 with backward-compatible onupgradeneeded guard to avoid breaking existing 'books' and 'files' stores"
  - "manifests store uses keyPath: 'ourn' matching the existing BookCache keying convention"
  - "storedAt timestamp included in manifest record for future cache eviction use"
metrics:
  duration: "~2 min"
  completed: "2026-04-20"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 02 Plan 05: File Manifest Storage for BookCache Summary

**One-liner:** IndexedDB 'manifests' store (DB_VERSION 2) with storeFileManifest/getFileManifest methods on BookCache singleton, enabling rebuildOnly diff logic in plan 02-03.

## What Was Built

Added a new `manifests` IndexedDB object store and two new methods to the `BookCache` singleton in `extension/cache.js`:

- `storeFileManifest(ourn, fileUrlArray)` — persists `{ ourn, urls: fileUrlArray, storedAt: Date.now() }` to the `manifests` store
- `getFileManifest(ourn)` — reads by ourn key; returns the `urls` array or `null` if no record exists

The DB schema was upgraded from version 1 to version 2 with a guarded `onupgradeneeded` handler that creates the `manifests` store only if it does not already exist, leaving the `books` and `files` stores untouched.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add 'manifests' object store, bump DB_VERSION to 2, add storeFileManifest/getFileManifest | 4173349 |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both methods are fully implemented and write/read real IndexedDB records. The persistence layer is complete; wiring into download.js rebuildOnly mode is handled by plan 02-03.

## Threat Flags

No new security-relevant surface beyond what was declared in the plan's threat model. The `manifests` store is extension-scoped IndexedDB and cannot be accessed cross-origin.

## Self-Check: PASSED

- `extension/cache.js` modified: FOUND
- Commit `4173349` exists: FOUND (git log confirms)
- `DB_VERSION = 2`: present at line 8
- `'manifests'` store creation: present at lines 29-31
- `storeFileManifest` function: defined at line 209, exported at line 248
- `getFileManifest` function: defined at line 223, exported at line 249
