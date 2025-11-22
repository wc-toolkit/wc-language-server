# Development Guide - Web Components Zed Extension

## Prerequisites

1. **Rust** - Install from [rustup.rs](https://rustup.rs)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Zed IDE** - Download from [zed.dev](https://zed.dev)

3. **Node.js & pnpm** - For building the language server
   ```bash
   npm install -g pnpm
   ```

**Important:** The extension loads the language server from the local monorepo. You must build it first:
```bash
cd /path/to/wc-language-server2
pnpm install
pnpm run build:ls
```

## Project Structure

```
packages/zed/
├── extension.toml          # Extension metadata and configuration
├── Cargo.toml             # Rust dependencies
├── src/
│   └── lib.rs            # Main extension code
├── package.json          # NPM dependencies (language server)
├── README.md             # User documentation
├── CHANGELOG.md          # Version history
├── LICENSE               # MIT license
├── build.sh              # Build script
└── .gitignore           # Git ignore rules
```

## Building the Extension

### Quick Build

```bash
cd packages/zed
./build.sh
```

### Manual Build

```bash
# First, build the language server
cd ../language-server
pnpm run build

# Then build the Rust extension
cd ../zed
cargo build --release
```

## Installing as Dev Extension

1. Open Zed
2. Press `cmd-shift-p` (Mac) or `ctrl-shift-p` (Windows/Linux)
3. Type "zed: install dev extension"
4. Select the `packages/zed` directory

The extension will be compiled and installed. You should see "Web Components Language Server" in your extensions list.

## Testing the Extension

### 1. Create a Test Project

```bash
cd /tmp
mkdir web-components-test
cd web-components-test
npm init -y
npm install @shoelace-style/shoelace
```

### 2. Create Test Files

**index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/@shoelace-style/shoelace/dist/themes/light.css">
  <script type="module" src="node_modules/@shoelace-style/shoelace/dist/shoelace.js"></script>
</head>
<body>
  <sl-button>
    <!-- Try typing attributes here - you should see completions -->
  </sl-button>
</body>
</html>
```

### 3. Open in Zed

```bash
zed .
```

### 4. Test Features

- **Auto-completion**: Type `<sl-` and you should see Shoelace components
- **Attributes**: Inside `<sl-button`, type a space and see attribute suggestions
- **Hover**: Hover over `sl-button` to see documentation
- **Go to Definition**: Cmd+click on a component name

## Debugging

### Viewing Logs

Run Zed from the terminal to see debug output:

```bash
zed --foreground
```

This will show:
- Extension loading messages
- Language server startup
- Any errors or warnings

### Common Issues

**Extension doesn't load:**
- Check that Rust is installed via rustup (not homebrew)
- Verify `cargo build --release` succeeds
- Look for errors in `zed --foreground` output

**Language server not found:**
- Ensure `@wc-toolkit/language-server` is in workspace `node_modules`
- Or install globally: `npm install -g @wc-toolkit/language-server`
- Check that `wc-language-server` is in your PATH

**No completions:**
- Verify `custom-elements.json` exists in project
- Check language server logs with `zed --foreground`
- Try restarting Zed

## Code Structure

### src/lib.rs

The main extension code is organized into:

1. **WebComponentsExtension struct**
   - Manages extension state
   - Caches language server binary path

2. **Extension trait implementation**
   - `new()` - Initialize extension
   - `language_server_command()` - Provide language server executable
   - `language_server_workspace_configuration()` - Send workspace config
   - `language_server_initialization_options()` - Send init options
   - `label_for_completion()` - Enhance completion display
   - `label_for_symbol()` - Enhance symbol display

### Key Features

**Language Server Path:**
```rust
fn get_language_server_path() -> Result<PathBuf>
```
The extension loads the language server from the local monorepo:
- Path: `{worktree}/packages/language-server/bin/wc-language-server.js`
- This allows for immediate testing of language server changes
- No need to publish or download packages during development

**Configuration:**
```rust
fn language_server_workspace_configuration() -> Result<Option<Value>>
```
Reads Zed settings and forwards to language server.

**Enhanced Labels:**
```rust
fn label_for_completion() -> Option<CodeLabel>
```
Adds visual distinction for web components (tags with hyphens).

## Testing Changes

1. Make code changes
2. Run `./build.sh` or `cargo build --release`
3. In Zed, run "zed: reload extensions"
4. Test the changes in a project

## Publishing

To publish the extension:

1. Update version in `extension.toml`, `Cargo.toml`, and `package.json`
2. Update `CHANGELOG.md`
3. Commit changes
4. Fork [zed-industries/extensions](https://github.com/zed-industries/extensions)
5. Add as submodule:
   ```bash
   git submodule add https://github.com/wc-toolkit/wc-language-server.git extensions/web-components
   ```
6. Update `extensions.toml`:
   ```toml
   [web-components]
   submodule = "extensions/web-components"
   version = "0.0.31"
   path = "packages/zed"
   ```
7. Run `pnpm sort-extensions`
8. Create PR

## Continuous Integration

The extension is automatically built and tested when:
- PRs are opened to the main repository
- Commits are pushed to the Zed extensions repository

## Resources

- [Zed Extension API Docs](https://docs.rs/zed_extension_api)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [Custom Elements Manifest](https://custom-elements-manifest.open-wc.org/)
- [Zed Extensions Guide](https://zed.dev/docs/extensions)

## Support

- [GitHub Issues](https://github.com/wc-toolkit/wc-language-server/issues)
- [Discussions](https://github.com/wc-toolkit/wc-language-server/discussions)
