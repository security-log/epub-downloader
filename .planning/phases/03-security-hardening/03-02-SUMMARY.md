---
phase: 03-security-hardening
plan: 02
subsystem: download
tags: [security, bug-fix, dom-parser, xml-escape]
dependency_graph:
  requires: []
  provides: [DOMParser-based cleanHTML, escapeXml helper]
  affects: [extension/download.js]
tech_stack:
  added: [DOMParser Web API]
  patterns: [structural HTML sanitization, XML character escaping]
key_files:
  created: []
  modified:
    - extension/download.js
decisions:
  - "Use documentElement.outerHTML after DOMParser to retain full <html>/<head>/<body> structure for O'Reilly chapter files which are full documents"
  - "escapeXml replaces & first (before <, >, \") to prevent double-escaping"
metrics:
  duration: "~1 min"
  completed: "2026-04-21"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 3 Plan 02: HTML Sanitization and XML Injection Fixes Summary

DOMParser-based script removal in cleanHTML (SEC-02, BUG-02) and escapeXml helper applied to generateContainerXml (SEC-03).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite cleanHTML with DOMParser | 5ef94b7 | extension/download.js |
| 2 | Add escapeXml helper and apply in generateContainerXml | 0caf628 | extension/download.js |

## What Was Built

### Task 1: DOMParser-based cleanHTML (SEC-02 + BUG-02)

Replaced two regex-based stripping lines in `cleanHTML` with a structural DOMParser approach:

- **Before:** Two lines — one regex to strip `<script>` elements, one regex to strip `<link>` elements (which incorrectly removed stylesheets — BUG-02)
- **After:** `DOMParser.parseFromString(content, 'text/html')` + `querySelectorAll('script').forEach(el => el.remove())` + `doc.documentElement.outerHTML`

The `<link>` elements (stylesheet references) are now preserved. All existing string-level regex fixups (API path removal, relative prefix calculation, self-closing tag normalization, image href fixing) run unchanged on the re-serialized output.

### Task 2: escapeXml Helper + generateContainerXml Hardening (SEC-03)

- Added module-level `escapeXml(str)` function after `sanitizeFilename`, escaping `&`, `<`, `>`, `"` in that order (& first to prevent double-escaping)
- Updated `generateContainerXml` to use `${escapeXml(opfPath)}` instead of bare `${opfPath}` in the XML template literal, preventing XML injection via a crafted OPF path

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

- Use `doc.documentElement.outerHTML` (not `doc.body.innerHTML`) since O'Reilly chapter files are full HTML documents that need the `<html>`, `<head>`, and `<body>` structure preserved for valid EPUB content.
- `&` replacement in `escapeXml` is ordered first to avoid double-escaping (e.g., `<` becoming `&amp;lt;` if `&` were escaped after `<`).

## Threat Model Coverage

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-03-04 | Mitigated | DOMParser structural script removal prevents regex bypass via malformed script tags |
| T-03-05 | Mitigated | `<link>` elements preserved; BUG-02 resolved |
| T-03-06 | Mitigated | `escapeXml()` encodes `&`, `<`, `>`, `"` before XML embedding |
| T-03-07 | Accepted | `documentElement.outerHTML` may add browser-normalized attributes; no PII exposure |

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- extension/download.js modified and committed: FOUND (commits 5ef94b7, 0caf628)
- DOMParser present: FOUND (line 361)
- querySelectorAll('script') present: FOUND (line 362)
- escapeXml function defined: FOUND (line 449)
- escapeXml(opfPath) in generateContainerXml: FOUND (line 316)
- Old regex script strip absent: CONFIRMED (no match)
- Old regex link strip absent: CONFIRMED (no match)
- Bare ${opfPath} in XML template absent: CONFIRMED (no match)
