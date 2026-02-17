#!/bin/bash

# Script to generate PNG icons from SVG
# Requires: imagemagick (install with: sudo apt install imagemagick)

SVG_FILE="icon.svg"
OUTPUT_DIR="."

if [ ! -f "$SVG_FILE" ]; then
    echo "Error: $SVG_FILE not found"
    exit 1
fi

echo "Generating PNG icons from $SVG_FILE..."

# Generate 16x16 icon
convert -background none -resize 16x16 "$SVG_FILE" "$OUTPUT_DIR/icon-16.png"
echo "✓ Generated icon-16.png"

# Generate 48x48 icon
convert -background none -resize 48x48 "$SVG_FILE" "$OUTPUT_DIR/icon-48.png"
echo "✓ Generated icon-48.png"

# Generate 128x128 icon
convert -background none -resize 128x128 "$SVG_FILE" "$OUTPUT_DIR/icon-128.png"
echo "✓ Generated icon-128.png"

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "Icons created:"
ls -lh icon-*.png
