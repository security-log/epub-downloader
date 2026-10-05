#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
target="${1:?Usage: bash scripts/build-extension.sh <firefox|chrome> [version]}"
case "$target" in
  firefox|chrome) ;;
  *) echo "Unknown browser: $target" >&2; exit 1 ;;
esac
version="${2:-v$(jq -r '.version' extension/manifest.json)}"
if [[ ! "$version" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Invalid package version: $version" >&2
  exit 1
fi

rm -rf build
cp -r extension build
rm -f build/test-*.html build/README.md
if [[ "$target" == firefox ]]; then
  rm -f build/sw.js build/offscreen.html build/offscreen.js
else
  jq '.background = { service_worker: "sw.js" }
      | .permissions += ["offscreen"]
      | .minimum_chrome_version = "116"
      | del(.browser_specific_settings)' \
    extension/manifest.json > build/manifest.json
fi

package="oreilly-epub-downloader-${version}-${target}.zip"
rm -f "$package"
(cd build && zip -qr -X "../$package" . -x '.DS_Store')
sha256sum "$package" > "$package.sha256"
printf '%s\n' "$package"
