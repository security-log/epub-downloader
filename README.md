# O'Reilly EPUB Downloader

Read the books you already have access to, on the devices and in the apps where
you prefer to read them.

O'Reilly EPUB Downloader is a browser extension that turns an O'Reilly Learning
book page into a local EPUB file for personal, offline reading. It uses your active
O'Reilly session to collect the book's content, images, styles, fonts, and metadata,
then creates an EPUB 3 file that works with Calibre and common e-readers.

<img width="2522" height="1496" alt="O'Reilly EPUB Downloader popup" src="https://github.com/user-attachments/assets/0860d54e-60ac-4510-a5c3-de114c0b85f1" />

## Why this exists

Some titles are available for purchase through their publishers or retailers. This
project is an experimental local EPUB workflow for material you are permitted to
access and download; it does not grant rights to content or replace official purchase
and distribution channels.

It is deliberately local-first: there is no separate account, service, or server
operated by this project. The extension uses the O'Reilly session already open in
your browser and should only be used in accordance with the applicable terms and
rights for the material.

## What it does

- Extracts the current book from an O'Reilly Learning page.
- Uses the active browser session to request authorized content.
- Downloads chapters, images, stylesheets, fonts, and book metadata.
- Builds a standards-compliant EPUB 3 archive with the original reading order.
- Shows progress, keeps a local download history, and warns before concurrent
  downloads.
- Caches downloaded files in the browser so a book can be rebuilt without fetching
  everything again.

```text
O'Reilly book page → browser extension → authorized O'Reilly content → local EPUB
```

## Availability

| Browser | Status | Minimum version |
| --- | --- | --- |
| Firefox | Supported | 115 |

The extension is currently packaged as an unsigned Firefox add-on. It must be loaded
temporarily during development; a browser restart requires loading it again.

## Get started

1. Open the [latest release](https://github.com/security-log/epub-downloader/releases/latest).
2. Follow the installation and integrity-verification instructions in that release.
3. Sign in to [O'Reilly Learning](https://learning.oreilly.com).
4. Open a book page and select the extension in the browser toolbar.
5. Choose **Download EPUB**. The finished file is saved through your browser's
   normal downloads flow.

Release pages are the source of truth for installation because they name the exact
package, checksum, and browser-specific steps for that version.

## Permissions and privacy

The extension requests only the permissions needed for its job:

| Permission | Why it is needed |
| --- | --- |
| `downloads` | Saves the generated EPUB to your device. |
| `storage` | Keeps download state, history, and the local content cache. |
| O'Reilly host access | Reads the active book page and requests content permitted by your signed-in O'Reilly session. |

Your O'Reilly session is used only to communicate with O'Reilly. This project does
not provide a remote backend or require a separate account.

## Development

To run the extension from source in Firefox:

1. Clone this repository.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Choose `extension/manifest.json`.

The code is organized around a small set of browser components:

- `content.js` identifies the current book and obtains the active session context.
- `background.js` coordinates downloads and maintains their state.
- `download.js` retrieves files and builds the EPUB archive.
- `cache.js` stores downloaded content in IndexedDB for reuse.
- `popup.js` provides progress, history, and download controls.

## Limitations

- An active O'Reilly Learning subscription and signed-in browser session are required.
- O'Reilly changes can require updates to the extension.
- Some failures may leave individual book files unavailable; the popup reports them
  with the completed download.
- The Firefox installation is temporary until the add-on is signed and distributed.

## Releases

Every PR merged into `main` creates a GitHub release with generated changelog notes.
Use one of these optional labels to select the semantic-version increment; without a
label, the release is a patch release.

- `release:major` — incompatible change (`X.0.0`)
- `release:minor` — backwards-compatible functionality (`x.Y.0`)
- `release:patch` — backwards-compatible fix (`x.y.Z`)

The `develop` → `main` PR receives a replaceable release candidate for testing.
Apply `skip-changelog` to omit a PR from the generated release notes.

## Contributing

Contributions are welcome. Please open an issue or pull request with a clear
description of the reader problem you are solving, how to reproduce it, and how you
verified the change. The validation workflow runs for pull requests to `develop` and
`main`.

## Responsible use

This tool is intended for personal, offline access to content you are authorized to
read. Do not redistribute downloaded material or use it in ways that violate
O'Reilly's terms or the rights of authors and publishers.

## License

[MIT](LICENSE)

## Project history

<a href="https://www.star-history.com/?repos=security-log%2Fepub-downloader&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=security-log/epub-downloader&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=security-log/epub-downloader&type=date&legend=top-left" />
   <img alt="Star history chart" src="https://api.star-history.com/chart?repos=security-log/epub-downloader&type=date&legend=top-left" />
 </picture>
</a>
