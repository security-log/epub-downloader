# O'Reilly EPUB Downloader

**Browser Extension** (Firefox and Chrome) for downloading books from O'Reilly Learning Platform as EPUB files.
<img width="2522" height="1496" alt="image" src="https://github.com/user-attachments/assets/0860d54e-60ac-4510-a5c3-de114c0b85f1" />



## Quick Start

1. **Install the extension** (see [Installation](#installation))
2. **Log in** to [learning.oreilly.com](https://learning.oreilly.com)
3. **Open any book** you want to download
4. **Click the extension icon** in the toolbar
5. **Click "Download EPUB"** and wait for completion

## Requirements

- **Firefox** 115+ or **Chrome** 116+
- **O'Reilly Learning** subscription (active and logged in)

## Installation

### Download from Releases

Each [release](https://github.com/security-log/epub-downloader/releases) ships one package per browser.

**Firefox**

1. Download `oreilly-epub-downloader-vX.X.X-firefox.zip` and extract it
2. Open `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select `manifest.json` from the extracted folder

**Chrome**

1. Download `oreilly-epub-downloader-vX.X.X-chrome.zip` and extract it
2. Open `chrome://extensions` and enable "Developer mode"
3. Click "Load unpacked" and select the extracted folder

### From Source

The `extension/` folder loads as-is in Firefox. For Chrome, build the
Chrome manifest first (the same transform the release workflow applies):

```bash
rm -rf build && cp -r extension build
jq '.background = { service_worker: "sw.js" }
    | .permissions += ["offscreen"]
    | .minimum_chrome_version = "116"
    | del(.browser_specific_settings)' extension/manifest.json > build/manifest.json
```

Then load `build/` with "Load unpacked".

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
## Star History

<a href="https://www.star-history.com/?repos=security-log%2Fepub-downloader&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=security-log/epub-downloader&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=security-log/epub-downloader&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=security-log/epub-downloader&type=date&legend=top-left" />
 </picture>
</a>
