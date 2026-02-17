# O'Reilly EPUB Downloader - Firefox Extension

Download books from O'Reilly Learning Platform as EPUB files directly in your browser.

## Features

- Download complete EPUB files from O'Reilly Learning
- Works directly in the browser (bypasses API restrictions)
- Automatic metadata extraction
- Real-time progress tracking
- **Download cache** — files are cached in IndexedDB so re-downloading a book is near-instant
- **Auto-resume** — interrupted downloads pick up where they left off
- **Retry with backoff** — transient failures (429, 5xx, network errors) are retried up to 3 times
- **Graceful degradation** — failed files don't abort the entire download; they're reported at the end
- **Concurrency pool** — smarter parallel downloads that fill slots as they open (no rigid batching)
- **Download history** — see previously downloaded books in the popup
- Clean and simple UI

## Prerequisites

- Firefox browser
- Active O'Reilly Learning subscription
- Logged in to https://learning.oreilly.com

## Installation

### Development Mode

1. Clone this repository:
   ```bash
   git clone https://github.com/security-log/epub-downloader.git
   cd epub-downloader
   ```

2. Open Firefox and navigate to `about:debugging`

3. Click "This Firefox" → "Load Temporary Add-on"

4. Navigate to `extension/` folder and select `manifest.json`

### Production (when published)

Install from Firefox Add-ons store (coming soon)

## Usage

1. Navigate to any book on O'Reilly Learning:
   ```
   https://learning.oreilly.com/library/view/{book-title}/{isbn}/
   ```

2. Click the extension icon in the toolbar

3. Click "Download EPUB" button

4. Wait for the download to complete

5. The EPUB file will be saved to your downloads folder

### Cache & Re-downloads

When you download a book, all files are cached locally in IndexedDB. If you download the same book again:

- **Download EPUB** — uses cached files, only fetches what's missing
- **Rebuild from Cache** — builds the EPUB entirely from cached files (no network requests)
- **Force Re-download** — ignores cache and fetches everything fresh
- **Clear Cache** — removes cached files for the current book

The popup also shows your **download history** with dates.

## Project Structure

```
extension/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Background service worker
├── content.js             # Content script (runs on O'Reilly pages)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── download.js            # EPUB download logic
├── cache.js               # IndexedDB cache layer
├── pool.js                # Retry + concurrency pool utilities
├── styles/
│   └── popup.css          # Popup styles
├── lib/
│   └── jszip.min.js       # ZIP compression library
└── icons/
    ├── icon-16.png        # Toolbar icon (16x16)
    ├── icon-48.png        # Extension icon (48x48)
    └── icon-128.png       # Store icon (128x128)
```

## Authentication

The extension automatically uses your browser's session cookies:
- `orm-jwt` - JWT authentication token
- Works seamlessly if you're logged in to O'Reilly

No need to manually extract cookies!

## Development

### Testing

1. Load the extension in Firefox (see Installation above)
2. Open browser console (F12) → "Console" tab
3. Navigate to an O'Reilly book page
4. Check console for "Content script loaded" message
5. Click extension icon and test download

### Debugging

- **Background script logs**: `about:debugging` → "Inspect" on the extension
- **Content script logs**: Regular browser console (F12)
- **Popup logs**: Right-click popup → "Inspect Element"
- **Cache inspection**: Background script devtools → "Storage" → "IndexedDB" → `epub-downloader-cache`

## How It Works

### 1. Book Detection (content.js)
- Runs on all O'Reilly book pages
- Extracts book metadata (title, ISBN, OURN)
- Gets JWT token from cookies
- Sends data to popup when requested

### 2. Download Process (download.js)
- **Metadata**: Fetch book info from `/api/v2/epubs/{ourn}/`
- **Cache check**: Look up already-cached files in IndexedDB, skip re-downloading them
- **File List**: Get all files from `/api/v2/epubs/{ourn}/files/`
- **Download**: Fetch missing files via concurrency pool (10 parallel, auto-retry on failure)
- **Cache write**: Each file is saved to IndexedDB immediately after download
- **Build**: Create EPUB ZIP with proper structure using JSZip
- **Save**: Use browser downloads API
- **History**: Record the download in browser.storage.local

### 3. EPUB Structure
```
book.epub (ZIP file)
├── mimetype                 [uncompressed]
├── META-INF/
│   ├── container.xml
│   └── com.apple.ibooks.display-options.xml
└── OEBPS/
    ├── content.opf
    ├── toc.ncx
    ├── *.xhtml              [chapters]
    ├── *.css                [styles]
    └── images/
        └── *.png
```

## API Endpoints Used

Based on extensive research (see [docs/RESEARCH-SUMMARY.md](../docs/RESEARCH-SUMMARY.md)):

```
GET /api/v2/epubs/{ourn}/                    # Book metadata
GET /api/v2/epubs/{ourn}/files/?limit=100    # File list
GET /api/v2/epubs/{ourn}/files/{filename}    # Individual file
```

## Known Issues

- [ ] Icons are placeholders (TODO: create proper icons)
- [ ] No settings page yet

## Roadmap

- [ ] Settings page (downloads folder, rate limiting, filename patterns)
- [ ] Download queue for multiple books
- [ ] Chrome compatibility (Manifest V3)
- [ ] Publish to Firefox Add-ons

## Research

This extension was built after extensive research of the O'Reilly API. See:
- [RESEARCH-SUMMARY.md](../docs/RESEARCH-SUMMARY.md) - Complete research documentation
- [EPUB-DOWNLOAD-API.md](../docs/EPUB-DOWNLOAD-API.md) - API documentation

### Why Extension vs CLI?

The O'Reilly API only serves **full content** when accessed from an **active browser session**. Direct API calls (even with valid authentication) only receive 3.5% of content (snippets).

The extension approach:
- Runs in browser context with active session
- Gets full content automatically
- Bypasses all API restrictions
- Simple user experience

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](../LICENSE)

## Disclaimer

This tool is for **personal use only**. Respect O'Reilly's Terms of Service:
- Only download books you have access to
- Do not redistribute downloaded content
- Use responsibly

## Author

**security-log**
