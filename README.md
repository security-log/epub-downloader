# O'Reilly EPUB Downloader TUI

A Go TUI (Terminal User Interface) for downloading books from O'Reilly Learning Platform in EPUB format.

## Requirements

- Go 1.26+
- Active O'Reilly Learning subscription
- Browser session cookies (SSO)

## Installation

```bash
go install github.com/tuusuario/epub-downloader@latest (PENDING)
```

Or compile from source:

```bash
git clone https://github.com/tuusuario/epub-downloader
cd epub-downloader
go build -o epub-downloader ./cmd
```

## Usage

```bash
# Start the TUI
./epub-downloader

# Or with cookies from file
./epub-downloader --cookies ~/.config/epub-downloader/cookies.json
```

### Getting Cookies

1. Log in to [learning.oreilly.com](https://learning.oreilly.com)
2. Open DevTools (F12) > Application > Cookies
3. Copy the cookies in JSON format
4. Paste them in the TUI or save them to a file

## Features

| Feature | Status |
|---------|--------|
| SSO Authentication | Pending |
| Book Search | Pending |
| Personal Library | Pending |
| Book Download | Pending |
| EPUB Generation | Pending |
| History | Pending |

## License

MIT

## Legal Notice

This tool is for personal use with content you already have access to through your subscription. Respect O'Reilly's terms of service.