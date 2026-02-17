# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Generate proper extension icons (currently using placeholders)
- Better error handling with retry logic
- Download queue for multiple books
- Browser notifications on completion
- Settings page for customization

## [1.0.0] - 2026-02-17

### Added
- ✨ Complete Firefox extension for downloading O'Reilly books as EPUB
- 📚 One-click download from O'Reilly book pages
- 🔐 Automatic authentication using browser session (JWT token)
- 📦 Full EPUB generation with JSZip library
- 🖼️ Support for all book assets (chapters, images, CSS, fonts)
- 🧹 HTML cleaning (removes scripts, fixes relative paths)
- 📊 Real-time progress tracking
- ✅ Valid EPUB 3.0 files compatible with Calibre and other readers
- 📝 Complete documentation (README, API research, architecture)
- 🔄 GitHub Actions for automated releases
- ✔️ Validation workflow for extension integrity

### Technical Details
- Uses O'Reilly's official API endpoints
- Batch downloading (10 files/batch) with rate limiting
- Preserves original book metadata (title, authors, ISBN)
- Uses original `content.opf` from O'Reilly (manifest + spine)
- Proper EPUB structure with container.xml and metadata
- Apple iBooks compatibility

### Known Issues
- Extension icons are placeholders (SVG instead of PNG)
- No retry logic on failed downloads
- Debug logging still active in console
- No browser notifications

## [0.1.0] - Development Phase

### Removed
- Deleted all Go CLI code (API returned only snippets)
- Removed planned TUI interface

### Research
- Extensive O'Reilly API documentation
- Discovered session-based content protection
- Documented complete download workflow

---

## Version History

- **1.0.0** - First working release with complete EPUB downloads
- **0.1.0** - Initial development and research phase

[Unreleased]: https://github.com/rubacava/epub-downloader/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rubacava/epub-downloader/releases/tag/v1.0.0
