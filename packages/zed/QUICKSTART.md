# Quick Start - Web Components Zed Extension

## For Users

### Installation

**Option 1: From Zed Extensions (when published)**
1. Open Zed
2. Press `cmd-shift-p` (Mac) or `ctrl-shift-p` (Windows/Linux)
3. Type "zed: extensions"
4. Search "Web Components"
5. Click Install

**Option 2: Development Installation**
```bash
# Clone the repository
git clone https://github.com/wc-toolkit/wc-language-server.git
cd wc-language-server

# Install dependencies and build language server
pnpm install
pnpm run build:ls

# Build the extension
cd packages/zed
./build.sh

# Install in Zed
# 1. Open Zed
# 2. Press cmd-shift-p
# 3. Run "zed: install dev extension"
# 4. Select packages/zed directory
```

### Setup Your Project

1. **Install a web component library:**
   ```bash
   npm install @shoelace-style/shoelace
   # or
   npm install @material/web
   ```

2. **Verify Custom Elements Manifest:**
   Most libraries include `custom-elements.json`. Check:
   ```bash
   ls node_modules/@shoelace-style/shoelace/dist/custom-elements.json
   ```

3. **Create a config file (optional):**
   ```javascript
   // wc.config.js
   export default {
     manifests: [
       './custom-elements.json',
       './node_modules/@shoelace-style/shoelace/dist/custom-elements.json'
     ]
   };
   ```

### Using the Extension

1. **Auto-completion:**
   ```html
   <sl-button
   <!-- Type space here to see attributes -->
   ```

2. **Hover Documentation:**
   ```html
   <sl-button>
   <!-- Hover over 'sl-button' to see docs -->
   </sl-button>
   ```

3. **Go to Definition:**
   - Hold `cmd` (Mac) or `ctrl` (Windows/Linux)
   - Click on a component name
   - Opens Custom Elements Manifest entry

## For Developers

### Prerequisites

- Rust (via rustup)
- Node.js & pnpm
- Zed IDE

### Quick Build

```bash
cd packages/zed
./build.sh
```

### Development Workflow

1. Make changes to `src/lib.rs`
2. Run `cargo build --release`
3. In Zed, run "zed: reload extensions"
4. Test changes

### Running with Logs

```bash
zed --foreground
```

## Supported Languages

- HTML
- JavaScript (JSX)
- TypeScript (TSX)
- Vue
- Svelte
- Astro
- MDX
- PHP
- Twig
- CSS/SCSS

## Troubleshooting

**No completions?**
- Ensure language server is built: `pnpm run build:ls`
- Check for `custom-elements.json` in your project
- Restart Zed
- Run `zed --foreground` to see logs

**Language server not found?**
```bash
# Build the language server
cd /path/to/wc-language-server2
pnpm run build:ls

# Verify it exists
ls packages/language-server/bin/wc-language-server.js
```

**Extension not loading?**
- Verify Rust is installed via rustup
- Check `cargo build --release` succeeds
- Look for errors in terminal output

## Resources

- [Full Documentation](./README.md)
- [Development Guide](./DEVELOPMENT.md)
- [GitHub Issues](https://github.com/wc-toolkit/wc-language-server/issues)
