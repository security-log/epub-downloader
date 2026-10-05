# O'Reilly EPUB Downloader — Firefox and Chrome

Download a book from O'Reilly Learning as an EPUB using your signed-in browser
session. Requires an active subscription, Firefox 115+ or Chrome 116+.

## Installation

Download the ZIP for your browser from the [latest release](https://github.com/security-log/epub-downloader/releases/latest)
and follow its installation and checksum instructions.

For Firefox development, open `about:debugging#/runtime/this-firefox`, select
**Load Temporary Add-on**, and choose `extension/manifest.json`. This installation
must be loaded again after restarting Firefox.

For local builds, run from the repository root (requires Bash, `jq`, `zip`, and
`sha256sum`):

```bash
bash scripts/build-extension.sh firefox
bash scripts/build-extension.sh chrome
```

The shared CI/local command replaces `build/` with the selected browser's files
and creates a ZIP and SHA-256 checksum in the repository root. An optional second
argument changes the package filename's version label, not the manifest version.
After the Chrome build, open `chrome://extensions`, enable Developer mode, and
select **Load unpacked** for `build/`.

## Usage and cache

1. Sign in to [O'Reilly Learning](https://learning.oreilly.com).
2. Open a book page under `/library/view/{title}/{isbn}/`.
3. Open the extension popup and select **Download EPUB**.
4. Follow the browser's save dialog; check the popup for failed-file warnings.

The popup provides these controls:

- **Download EPUB** reuses cached files and requests missing files.
- **Re-download from source** requests all book files again. The current build
  still merges cached content when assembling the EPUB; use **Clear cache** first
  if you need to exclude previously stored content.
- **Clear cache** deletes the current book's cached metadata, manifest, and files.
- **Clear history** removes the local download history.

Re-download and cache controls appear when the current book has cached files.
The popup asks for confirmation before starting a different book concurrently.
Interrupted jobs are not automatically resumed; restarting a download can reuse
files already persisted in IndexedDB. There is no dedicated cache-only rebuild
button in the popup.

## Code structure

| File | Responsibility |
| --- | --- |
| `manifest.json` | Firefox manifest and source for the Chrome build transform. |
| `compat.js` | Shares the `browser` namespace between Firefox and Chrome. |
| `background.js` | Handles requests, download state, and session persistence. |
| `content.js` | Extracts book information and the session token from the page. |
| `download.js` | Retrieves book files, cleans HTML, constructs the EPUB, and records history. |
| `cache.js` | Stores book metadata, expected file paths, and content in IndexedDB. |
| `pool.js` | Limits concurrent tasks and retries transient fetch failures. |
| `platform.js` | Adapts HTML parsing and blob URLs to each browser. |
| `sw.js` | Loads shared background scripts in Chrome's service worker. |
| `offscreen.html`, `offscreen.js` | Provide DOM parsing and blob URLs for Chrome. |
| `popup.html`, `popup.js`, `styles/popup.css` | Popup controls, progress, warnings, and history. |
| `lib/jszip.min.js` | Bundled ZIP library. |

Cached content is loaded into a `Map` before ZIP generation; this is not a streaming
EPUB builder. The concurrency pool delivers each completion to its callback without
collecting file contents in a results array. Memory usage has not been benchmarked.

Shared automation lives in `../scripts/build-extension.sh` and
`../scripts/bump-version.py`. See the [project README](../README.md#releases) for
release labels and publication behavior.

## Verification and debugging

Run the release checks from the repository root:

```bash
python3 .github/check-releases.py
```

These use temporary repositories to check version labels, release retries,
changelog updates, browser selection, and local/CI packages and checksums.
Open `../tests/pool.html` in a browser to check task concurrency and completion.

For browser testing, load the extension, download a book, reopen the popup during
the download, and check cached re-downloads, forced re-downloads, history, and
failed-file warnings. Automated checks do not replace a signed-in browser download
test.

- **Firefox background logs:** `about:debugging` → extension → **Inspect**.
- **Chrome background logs:** `chrome://extensions` → extension → service worker inspector.
- **Content logs:** the O'Reilly page's developer console.
- **Popup logs:** inspect the extension popup.
- **Cache:** background developer tools → IndexedDB → `epub-downloader-cache`.

## Authentication and API flow

`content.js` reads the `orm-jwt` cookie and passes the token with book information
to the background. Requests use the O'Reilly API metadata endpoint
`/api/v2/epubs/{ourn}/`, its paginated file listing, and the returned file URLs.
The project has no remote backend.

Use downloaded content only as permitted by its applicable terms and rights.
See the [project README](../README.md) and [MIT license](../LICENSE).
