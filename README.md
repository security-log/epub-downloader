# O'Reilly EPUB Downloader

**Firefox Extension** for downloading books from O'Reilly Learning Platform as EPUB files.

## Quick Start

1. **Install the extension** (see [Installation](#installation))
2. **Log in** to [learning.oreilly.com](https://learning.oreilly.com)
3. **Open any book** you want to download
4. **Click the extension icon** in the toolbar
5. **Click "Download EPUB"** and wait for completion

## Requirements

- **Firefox** browser
- **O'Reilly Learning** subscription (active and logged in)

## Installation

### Method 1: Development Mode (Temporary)

1. Clone this repository:
   ```bash
   git clone https://github.com/security-log/epub-downloader.git
   cd epub-downloader
   ```

2. Generate icons (requires ImageMagick):
   ```bash
   cd extension/icons
   ./generate-icons.sh
   ```

3. Load in Firefox:
   - Open `about:debugging`
   - Click "This Firefox" → "Load Temporary Add-on"
   - Select `extension/manifest.json`

### Method 2: Download from Releases

1. Go to [Releases](https://github.com/security-log/epub-downloader/releases)
2. Download the latest `oreilly-epub-downloader-vX.X.X.zip`
3. Extract the ZIP file
4. Load in Firefox:
   - Open `about:debugging`
   - Click "This Firefox" → "Load Temporary Add-on"
   - Select `manifest.json` from extracted folder

### Method 3: Firefox Add-ons Store (Coming Soon)

Will be published to the official Firefox Add-ons store.

## 📖 Usage Guide

### Basic Download

1. Navigate to any book on O'Reilly:
   ```
   https://learning.oreilly.com/library/view/{book-title}/{isbn}/
   ```

2. Click the extension icon in the toolbar

3. The popup will show:
   - Book title
   - ISBN
   - Download button

4. Click "📥 Download EPUB"

6. EPUB will be saved to your Downloads folder

### Troubleshooting

**"Could not detect book information"**
- Refresh the book page
- Make sure you're on a book page URL: `https://learning.oreilly.com/library/view/{title}/{isbn}/`

**"JWT token not found"**
- Log in to O'Reilly Learning
- Refresh the page and try again

**Extension icon doesn't appear**
- Run `generate-icons.sh` in the `extension/icons/` directory
- Reload the extension in `about:debugging`

## Current Known Issues

- Icons are placeholders (need to run generate-icons.sh)
- Some debug logging still active
- No browser notification on completion

## 🗺️ Roadmap

### v1.0 
- [x] Basic extension structure
- [x] Book detection from page
- [x] Download UI with progress tracking
- [x] Complete EPUB building with JSZip
- [x] HTML cleaning (remove scripts, fix paths)
- [x] Proper EPUB validation (Calibre-compatible)
- [x] Original metadata preservation
- [x] Image and asset support

### v1.1 (curretn)
- [ ] Generate proper icons (currently using placeholder)
- [ ] Better error handling and retry logic
- [ ] Download queue for multiple books
- [ ] Success/failure notifications
- [ ] Cleanup debug logging

### Ideas
- [ ] Settings page (rate limiting, compression level)
- [ ] Download history
- [ ] Custom filename patterns
- [ ] Chrome support (same Manifest V3)
- [ ] Cover image preview in popup
- [ ] Bulk download from library page
- [ ] Search and download integration
- [ ] Format conversion options
- [ ] Progress persistence across browser restarts

## 🚀 Creating a Release

The project uses GitHub Actions to automatically build and publish releases.

### For Maintainers:

1. **Update version** in `extension/manifest.json`:
   ```json
   {
     "version": "1.1.0"
   }
   ```

2. **Commit changes**:
   ```bash
   git add extension/manifest.json
   git commit -m "Bump version to 1.1.0"
   ```

3. **Create and push tag**:
   ```bash
   git tag v1.1.0
   git push origin main --tags
   ```

4. **Automatic release**: GitHub Actions will automatically:
   - Build the extension package
   - Generate checksums
   - Create a GitHub Release
   - Attach the ZIP file

### Manual Build (if needed):

```bash
cd extension
zip -r ../oreilly-epub-downloader-v1.0.0.zip . \
  -x "*.git*" \
  -x "test-*.html" \
  -x "README.md"
cd ..
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details

## ️Disclaimer

This tool is for **personal use only**. 

- Download books you have legitimate access to
- Use downloads for personal reading and study
- Do not redistribute downloaded content
- Do not violate O'Reilly's Terms of Service
- Do not use for commercial purposes

**Use responsibly and respect content creators.**

**⭐ Star this repo** if you find it useful!