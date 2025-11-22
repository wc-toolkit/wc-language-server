# Pre-Flight Checklist - Zed Extension

## Before Building

### System Requirements

- [ ] **Rust installed via rustup**
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
  
- [ ] **Verify Rust installation**
  ```bash
  cargo --version
  rustc --version
  ```

- [ ] **Node.js and pnpm**
  ```bash
  node --version
  pnpm --version
  ```

- [ ] **Zed IDE installed**
  - Download from https://zed.dev

### Project Setup

- [ ] **Install dependencies**
  ```bash
  cd /path/to/wc-language-server2
  pnpm install
  ```

- [ ] **Build language server**
  ```bash
  pnpm run build:ls
  ```

## Building the Extension

### Option 1: Use Build Script
```bash
cd packages/zed
./build.sh
```

### Option 2: Manual Build
```bash
cd packages/zed
cargo build --release
```

## Installation in Zed

1. **Open Zed**

2. **Install Dev Extension**
   - Press `cmd-shift-p` (Mac) or `ctrl-shift-p` (Windows/Linux)
   - Type "zed: install dev extension"
   - Navigate to `packages/zed` directory
   - Select it

3. **Verify Installation**
   - Open Extensions panel
   - Look for "Web Components Language Server"
   - Should show "Overridden by dev extension"

## Testing

### 1. Create Test Project

```bash
mkdir /tmp/web-components-test
cd /tmp/web-components-test
npm init -y
npm install @shoelace-style/shoelace
```

### 2. Create Test File

Create `index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/@shoelace-style/shoelace/dist/themes/light.css">
  <script type="module" src="node_modules/@shoelace-style/shoelace/dist/shoelace.js"></script>
</head>
<body>
  <sl-button variant="primary" size="large">
    Click Me
  </sl-button>
</body>
</html>
```

### 3. Test Features

Open the test project in Zed:
```bash
zed .
```

**Test Checklist:**

- [ ] **Auto-completion**
  - Type `<sl-` 
  - Should see Shoelace component suggestions
  
- [ ] **Attribute completion**
  - Inside `<sl-button `, type space
  - Should see attribute suggestions (variant, size, disabled, etc.)
  
- [ ] **Hover documentation**
  - Hover over `sl-button`
  - Should see component documentation
  
- [ ] **Go to definition**
  - Hold `cmd` (Mac) or `ctrl` (Windows/Linux)
  - Click on `sl-button`
  - Should navigate to definition

## Troubleshooting

### Build Issues

**"command not found: cargo"**
- Rust not installed via rustup
- Install from: https://rustup.rs

**Build fails with linker errors**
- Check Rust installation is complete
- Try: `rustup update`

**"could not find Cargo.toml"**
- Ensure you're in `packages/zed` directory
- Check file exists

### Installation Issues

**Extension doesn't appear**
- Check build succeeded
- Look for `target/release/libweb_components.*` file
- Try running Zed from terminal: `zed --foreground`

**"Failed to load extension"**
- Check extension.toml syntax
- Verify Cargo.toml matches extension.toml version
- Look for errors in terminal output

### Runtime Issues

**No completions**
- Verify `custom-elements.json` exists in project
- Check language server is installed:
  ```bash
  npm list @wc-toolkit/language-server
  ```
- Restart Zed

**Language server not starting**
- Check language server binary exists:
  ```bash
  which wc-language-server
  ```
- Install if missing:
  ```bash
  npm install -g @wc-toolkit/language-server
  ```
- Check logs with: `zed --foreground`

## Publishing Checklist

Before publishing to Zed extensions marketplace:

- [ ] All features tested
- [ ] Documentation complete
- [ ] License file present (MIT)
- [ ] Version numbers match across:
  - extension.toml
  - Cargo.toml
  - package.json
  - CHANGELOG.md
- [ ] README.md accurate
- [ ] No debug code or console.logs
- [ ] Extension builds successfully
- [ ] Tested on real projects

### Publishing Steps

1. [ ] Fork https://github.com/zed-industries/extensions
2. [ ] Add submodule:
   ```bash
   git submodule add https://github.com/wc-toolkit/wc-language-server.git extensions/web-components
   ```
3. [ ] Update extensions.toml:
   ```toml
   [web-components]
   submodule = "extensions/web-components"
   path = "packages/zed"
   version = "0.0.31"
   ```
4. [ ] Run `pnpm sort-extensions`
5. [ ] Create pull request
6. [ ] Wait for CI to pass
7. [ ] Address review feedback
8. [ ] Merge and publish

## Verification Commands

```bash
# Check file structure
ls -la packages/zed/

# Expected files:
# - extension.toml
# - Cargo.toml
# - package.json
# - src/lib.rs
# - README.md
# - LICENSE
# - CHANGELOG.md
# - DEVELOPMENT.md
# - build.sh

# Verify Rust syntax
cd packages/zed
cargo check

# Build extension
cargo build --release

# Check binary created
ls -lh target/release/libweb_components.*

# Verify extension.toml
cat extension.toml

# Check version consistency
grep version extension.toml
grep version Cargo.toml
grep version package.json
```

## Success Criteria

✅ Extension compiles without errors  
✅ Extension loads in Zed  
✅ Language server starts  
✅ Auto-completion works  
✅ Hover documentation appears  
✅ Go to definition functions  
✅ Works across multiple file types  
✅ Configuration is respected  
✅ No errors in logs  

## Next Steps After Success

1. Test with multiple web component libraries:
   - Shoelace
   - Material Web Components
   - Lion
   - FAST

2. Test in various file types:
   - HTML
   - JSX/TSX
   - Vue
   - Svelte
   - Astro

3. Test edge cases:
   - Large projects
   - Multiple workspaces
   - No custom-elements.json
   - Invalid configuration

4. Gather user feedback

5. Plan enhancements:
   - Slash commands
   - Code snippets
   - Additional diagnostics
