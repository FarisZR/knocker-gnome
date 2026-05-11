#!/bin/bash
# Install the Knocker GNOME extension

set -e

EXTENSION_NAME="Knocker@fariszr.com"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_NAME"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Installing Knocker GNOME Extension${NC}"

# Check if extension directory exists
if [ -d "$EXTENSION_DIR" ]; then
    echo -e "${YELLOW}Extension already installed. Removing old version...${NC}"
    rm -rf "$EXTENSION_DIR"
fi

# Create extension directory
echo "Creating extension directory..."
mkdir -p "$EXTENSION_DIR"

# Copy files
echo "Copying extension files..."
cp extension.js "$EXTENSION_DIR/"
cp knockerService.js "$EXTENSION_DIR/"
cp knockerMonitor.js "$EXTENSION_DIR/"
cp knockerQuickSettings.js "$EXTENSION_DIR/"
cp prefs.js "$EXTENSION_DIR/"
cp metadata.json "$EXTENSION_DIR/"

# Copy icons
echo "Copying icons..."
mkdir -p "$EXTENSION_DIR/icons"
cp icons/*.svg "$EXTENSION_DIR/icons/"

# Copy schemas
echo "Copying schemas..."
mkdir -p "$EXTENSION_DIR/schemas"
cp schemas/*.xml "$EXTENSION_DIR/schemas/"

# Compile schemas
echo "Compiling schemas..."
glib-compile-schemas "$EXTENSION_DIR/schemas/"

echo -e "${GREEN}✓ Extension installed successfully!${NC}"
echo ""
echo "To enable the extension:"
echo -e "  ${BLUE}gnome-extensions enable $EXTENSION_NAME${NC}"
echo ""
echo "Then restart GNOME Shell:"
echo "  - X11: Press Alt+F2, type 'r', press Enter"
echo "  - Wayland: Log out and log back in"
echo ""
echo "To configure:"
echo -e "  ${BLUE}gnome-extensions prefs $EXTENSION_NAME${NC}"
