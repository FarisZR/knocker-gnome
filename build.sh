#!/bin/bash
# Build and package the Knocker GNOME extension

set -e

EXTENSION_NAME="Knocker@fariszr.com"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_NAME"
BUILD_DIR="build"
ZIP_NAME="$EXTENSION_NAME.shell-extension.zip"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Building Knocker GNOME Extension${NC}"

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
    echo "Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

# Create build directory
mkdir -p "$BUILD_DIR"

# Copy files
echo "Copying extension files..."
cp extension.js "$BUILD_DIR/"
cp knockerService.js "$BUILD_DIR/"
cp knockerMonitor.js "$BUILD_DIR/"
cp knockerQuickSettings.js "$BUILD_DIR/"
cp prefs.js "$BUILD_DIR/"
cp metadata.json "$BUILD_DIR/"
cp stylesheet.css "$BUILD_DIR/"

# Copy icons
echo "Copying icons..."
mkdir -p "$BUILD_DIR/icons"
cp icons/*.svg "$BUILD_DIR/icons/"

# Copy schemas
echo "Copying schemas..."
mkdir -p "$BUILD_DIR/schemas"
cp schemas/*.xml "$BUILD_DIR/schemas/"

# Compile schemas
echo "Compiling schemas..."
glib-compile-schemas "$BUILD_DIR/schemas/"

# Create zip file
echo "Creating package..."
cd "$BUILD_DIR"
zip -r "../$ZIP_NAME" ./*
cd ..

echo -e "${GREEN}✓ Extension built successfully!${NC}"
echo -e "Package: ${BLUE}$ZIP_NAME${NC}"
echo ""
echo "To install:"
echo "  gnome-extensions install $ZIP_NAME"
echo ""
echo "Or to install directly:"
echo "  ./install.sh"
