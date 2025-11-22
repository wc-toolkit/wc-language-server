#!/usr/bin/env bash

# Build script for Web Components Zed Extension

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Web Components Zed Extension...${NC}"

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: Rust/Cargo is not installed.${NC}"
    echo -e "${YELLOW}Please install Rust from https://rustup.rs${NC}"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    echo -e "${RED}Error: Cargo.toml not found.${NC}"
    echo -e "${YELLOW}Please run this script from the packages/zed directory${NC}"
    exit 1
fi

# Build the extension
echo -e "${GREEN}Compiling Rust extension...${NC}"
cargo build --release

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful!${NC}"
    echo ""
    echo "Extension binary located at: target/release/libweb_components.dylib (or .so/.dll depending on OS)"
    echo ""
    echo "To install as a dev extension in Zed:"
    echo "1. Open Zed"
    echo "2. Press cmd-shift-p (or ctrl-shift-p)"
    echo "3. Type 'zed: install dev extension'"
    echo "4. Select this directory: $(pwd)"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Check for language server
echo ""
echo -e "${GREEN}Checking for language server...${NC}"

if [ -d "../../language-server" ]; then
    echo -e "${GREEN}✓ Language server found in workspace${NC}"
else
    echo -e "${YELLOW}⚠ Language server not found in workspace${NC}"
    echo "Make sure to install @wc-toolkit/language-server"
fi

echo ""
echo -e "${GREEN}Build complete!${NC}"
