---
phase: 03-security-hardening
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - extension/background.js
  - extension/download.js
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Both files are well-structured and show evidence of prior security hardening (XML escaping in `generateContainerXml`, `DOMParser`-based script stripping in `cleanHTML`, sender-ID validation in the message listener). No critical vulnerabilities were found.

Three warnings were identified: zip-path traversal via API-supplied `full_path` values (present in two separate code paths), unvalidated pagination URLs from the API, and an undefined `ourn` key collision when both `ourn` and `isbn` fields are absent from book data. Three informational issues cover debug `console.log` statements, a silently-swallowed catch, and the `self-closing tag` regex over-matching.

---

## Warnings

### WR-01: ZIP Path Traversal via API-Supplied `full_path`

**File:** `extension/download.js:251` and `extension/download.js:335`

**Issue:** Two separate code paths prepend `OEBPS/` to a file path that comes directly from the O'Reilly API response without sanitization:

```js
// downloadAllFiles — line 251
const fullPath = `OEBPS/${file.full_path}`;
zip.file(fullPath, processedContent, ...);

// buildEPUB — line 335 (cached path, originally from same API field)
const zipPath = `OEBPS/${fullPath}`;
zip.file(zipPath, fileData.content, ...);
```

If the API (or a compromised network response) returns a `full_path` containing `../`, the resulting ZIP entry path would be `OEBPS/../META-INF/some-file`. JSZip stores paths literally without normalization. EPUB readers that do not canonicalize paths before extraction would write the file outside the `OEBPS/` subtree, potentially overwriting `META-INF/container.xml` or `mimetype`. While exploitation requires a server-side compromise or a MitM on the O'Reilly API, the defense should not depend on that assumption.

**Fix:** Strip leading `../` sequences (and equivalent) from `full_path` before constructing the zip path:

```js
function sanitizeZipPath(p) {
  // Normalize slashes, remove any ../ traversal segments
  return p.replace(/\\/g, '/').split('/').filter(seg => seg !== '..' && seg !== '.').join('/');
}

// Then:
const fullPath = `OEBPS/${sanitizeZipPath(file.full_path)}`;
```

Apply the same helper in `buildEPUB` at line 335 when constructing `zipPath` from the cached `fullPath` key.

---

### WR-02: Unvalidated Pagination URL from API Response

**File:** `extension/download.js:215`

**Issue:** The `next` field from the paginated files API is used directly as the URL for the subsequent request with no validation:

```js
const data = await response.json();
allFiles = allFiles.concat(data.results);
nextUrl = data.next;  // used verbatim in next loop iteration
```

If `data.next` is `null` or `undefined` the loop terminates correctly. However, if it is a non-null, non-string value (e.g., a number or object from a malformed API response), `fetchWithRetry` will receive a non-string URL and throw a `TypeError` with a confusing message. More importantly, there is no check that `next` stays within `*.oreilly.com`; while browser `host_permissions` will enforce domain restrictions at the network level, a fetch to an unexpected origin will surface as an opaque network error rather than a clear domain-mismatch error, making debugging difficult and masking potential API anomalies.

**Fix:** Validate `data.next` before assigning:

```js
const rawNext = data.next;
if (rawNext != null) {
  if (typeof rawNext !== 'string') {
    throw new Error(`Unexpected pagination URL type: ${typeof rawNext}`);
  }
  const nextOrigin = new URL(rawNext).hostname;
  if (!nextOrigin.endsWith('.oreilly.com') && nextOrigin !== 'learning.oreilly.com') {
    throw new Error(`Pagination URL left oreilly.com domain: ${rawNext}`);
  }
}
nextUrl = rawNext ?? null;
```

---

### WR-03: Undefined `ourn` Key Causes Silent Map Collision

**File:** `extension/background.js:30-36`

**Issue:** When both `message.data.ourn` and `message.data.isbn` are falsy, `ourn` evaluates to `undefined`:

```js
const ourn = message.data.ourn || message.data.isbn;
// ...
activeDownloads.set(ourn, { status: 'running', ... });
```

`activeDownloads.set(undefined, ...)` is valid JavaScript but any subsequent download request with missing identifiers will match the same `undefined` key and be reported as "already running" even if it is a different book. This can suppress legitimate download attempts and make the download appear stuck.

**Fix:** Validate early in the handler:

```js
const ourn = message.data.ourn || message.data.isbn;
if (!ourn) {
  sendResponse({ success: false, error: 'Missing book identifier (ourn or isbn)' });
  return true;
}
```

---

## Info

### IN-01: Debug `console.log` Statements in Hot Path

**File:** `extension/download.js:6`, `extension/download.js:28`, `extension/download.js:62`, `extension/background.js:6`, `extension/background.js:17`, `extension/background.js:86`, `extension/background.js:102`

**Issue:** Multiple `console.log` calls exist in production code paths including the per-download metadata log (`console.log('Metadata:', metadata)` at line 62 of `download.js`). The metadata object contains the book's OURN, title, ISBN, and file URLs. Logging this to the browser console means any other extension or devtools observer can read it.

**Fix:** Remove or gate behind a `DEBUG` flag. At minimum, remove `console.log('Metadata:', metadata)` at `download.js:62` since it logs a full API object including file URLs.

---

### IN-02: Empty `catch` Block Silently Discards Download Errors

**File:** `extension/background.js:38`

**Issue:** The download task is fired with an intentionally empty catch:

```js
handleDownloadRequest(message.data, ourn).catch(() => {});
```

Errors ARE handled inside `handleDownloadRequest` (stored to `activeDownloads` and broadcast via `DOWNLOAD_FAILED`), but if `handleDownloadRequest` itself throws before reaching the internal `catch` (e.g., a programming error), the error is discarded without any logging. The re-thrown error on line 115 is what this outer `.catch` swallows.

**Fix:** Log the re-thrown error even if it is not actionable:

```js
handleDownloadRequest(message.data, ourn).catch(err => {
  console.warn('Unhandled error escaping handleDownloadRequest:', err);
});
```

---

### IN-03: Self-Closing Tag Regex Matches Inside Attribute Values

**File:** `extension/download.js:374-383`

**Issue:** The regex for self-closing tags:

```js
const regex = new RegExp(`<${tag}([^>]*[^/])>`, 'gi');
```

`[^>]*` in the character class means "any character except `>`". An attribute value containing `>` (which is valid HTML inside a quoted attribute) would cause the regex to stop early, producing a partial match. Since the HTML has already been serialized by `DOMParser`/`outerHTML`, attribute values with unescaped `>` should have been entity-encoded — but this depends on browser serialization behavior. If a browser serializes `>` inside an attribute literally (which is allowed by the HTML5 spec), the regex breaks on that tag.

**Fix:** This is low priority given that the HTML was just round-tripped through `DOMParser` which will encode `>` in attribute values. Document the assumption explicitly with a comment, or use the DOM API to manipulate `src` attributes directly before calling `outerHTML` instead of post-processing the serialized string.

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
