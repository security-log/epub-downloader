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

### Download from Releases

1. Go to [Releases](https://github.com/security-log/epub-downloader/releases)
2. Download the latest `oreilly-epub-downloader-vX.X.X.zip`
3. Extract the ZIP file
4. Load in Firefox:
   - Open `about:debugging`
   - Click "This Firefox" → "Load Temporary Add-on"
   - Select `manifest.json` from extracted folder

## Usage Guide

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

## Current Known Issues

- Icons are placeholders (need to run generate-icons.sh)
- Some debug logging still active
- No browser notification on completion

## Contributing

Contributions are welcome! Especially with the front, as it's not my strength (the current version is AI-generated)

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
