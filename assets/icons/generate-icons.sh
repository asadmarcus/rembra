#!/bin/bash

# Icon Generation Script for Rembra Electron App
# Requires: rsvg-convert (install via: brew install librsvg)

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ICON_DIR="$SCRIPT_DIR"
SVG_FILE="$ICON_DIR/icon.svg"

echo "🎨 Generating Rembra app icons from SVG..."

# Check if rsvg-convert is installed
if ! command -v rsvg-convert &> /dev/null; then
    echo "❌ rsvg-convert not found. Installing via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    brew install librsvg
fi

# Create PNG files for different sizes
echo "📱 Generating PNG files..."
rsvg-convert -w 16 -h 16 "$SVG_FILE" > "$ICON_DIR/icon-16.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICON_DIR/icon-32.png"
rsvg-convert -w 48 -h 48 "$SVG_FILE" > "$ICON_DIR/icon-48.png"
rsvg-convert -w 64 -h 64 "$SVG_FILE" > "$ICON_DIR/icon-64.png"
rsvg-convert -w 128 -h 128 "$SVG_FILE" > "$ICON_DIR/icon-128.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICON_DIR/icon-256.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" > "$ICON_DIR/icon-512.png"
rsvg-convert -w 1024 -h 1024 "$SVG_FILE" > "$ICON_DIR/icon-1024.png"

# Main icon file (used as fallback)
cp "$ICON_DIR/icon-512.png" "$ICON_DIR/icon.png"

echo "🍎 Generating macOS ICNS file..."
# Create iconset for macOS
mkdir -p "$ICON_DIR/icon.iconset"
cp "$ICON_DIR/icon-16.png" "$ICON_DIR/icon.iconset/icon_16x16.png"
cp "$ICON_DIR/icon-32.png" "$ICON_DIR/icon.iconset/icon_16x16@2x.png"
cp "$ICON_DIR/icon-32.png" "$ICON_DIR/icon.iconset/icon_32x32.png"
cp "$ICON_DIR/icon-64.png" "$ICON_DIR/icon.iconset/icon_32x32@2x.png"
cp "$ICON_DIR/icon-128.png" "$ICON_DIR/icon.iconset/icon_128x128.png"
cp "$ICON_DIR/icon-256.png" "$ICON_DIR/icon.iconset/icon_128x128@2x.png"
cp "$ICON_DIR/icon-256.png" "$ICON_DIR/icon.iconset/icon_256x256.png"
cp "$ICON_DIR/icon-512.png" "$ICON_DIR/icon.iconset/icon_256x256@2x.png"
cp "$ICON_DIR/icon-512.png" "$ICON_DIR/icon.iconset/icon_512x512.png"
cp "$ICON_DIR/icon-1024.png" "$ICON_DIR/icon.iconset/icon_512x512@2x.png"

# Generate ICNS file
iconutil -c icns "$ICON_DIR/icon.iconset"
rm -rf "$ICON_DIR/icon.iconset"

echo "🪟 Generating Windows ICO file..."
# For ICO file, we need to use a different approach
# First check if ImageMagick is available
if command -v magick &> /dev/null; then
    magick "$ICON_DIR/icon-16.png" "$ICON_DIR/icon-32.png" "$ICON_DIR/icon-48.png" "$ICON_DIR/icon-64.png" "$ICON_DIR/icon-128.png" "$ICON_DIR/icon-256.png" "$ICON_DIR/icon.ico"
    echo "✅ ICO file generated with ImageMagick"
elif command -v convert &> /dev/null; then
    convert "$ICON_DIR/icon-16.png" "$ICON_DIR/icon-32.png" "$ICON_DIR/icon-48.png" "$ICON_DIR/icon-64.png" "$ICON_DIR/icon-128.png" "$ICON_DIR/icon-256.png" "$ICON_DIR/icon.ico"
    echo "✅ ICO file generated with ImageMagick convert"
else
    echo "⚠️  ImageMagick not found. ICO file will be created using online tool."
    echo "   Install ImageMagick: brew install imagemagick"
    echo "   Or use online converter: https://convertio.co/png-ico/"
    echo "   Upload icon-256.png and download as icon.ico"
fi

echo ""
echo "✅ Icon generation complete!"
echo "📁 Generated files:"
ls -la "$ICON_DIR"/*.png "$ICON_DIR"/*.icns "$ICON_DIR"/*.ico 2>/dev/null || true
echo ""
echo "📋 Next steps:"
echo "1. Update package.json build configuration to use these icons"
echo "2. Test builds on both macOS and Windows"
echo "3. Verify icon appears correctly in system menus and taskbars"
