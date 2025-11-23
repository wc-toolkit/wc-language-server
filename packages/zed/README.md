# Web Components Zed Extension

This package contains the experimental Zed extension that wires the `@wc-toolkit/language-server` into the editor. It mirrors the VS Code and JetBrains integrations, but keeps the surface intentionally small while we iterate on the workflow.

## Features

- Launches the `wc-language-server` for HTML/JS/TS oriented files
- Reuses your existing Node.js version or installs a local copy of the npm package when needed
- Shares the same manifest service endpoint that powers our VS Code integration

## Prerequisites

- Rust installed via [`rustup`](https://www.rust-lang.org/tools/install) with the WebAssembly target: `rustup target add wasm32-wasip1`
- [`cargo-component`](https://github.com/bytecodealliance/cargo-component) for building WebAssembly *components*: the scripts auto-install it if missing, but you can install manually with `cargo install cargo-component`
- `pnpm` (v9+) for running the provided scripts
- `npm` (ships with Node.js) for installing server dependencies inside the bundled copy
- The Zed CLI (`zed`) available on your `PATH` — install Zed from [zed.dev](https://zed.dev/download) and either symlink the binary or set `ZED_BIN=/Applications/Zed.app/Contents/MacOS/zed`

## Project layout

```
packages/zed/
├── Cargo.toml            # Rust crate for the WebAssembly extension
├── extension.toml        # Zed manifest declaration
├── package.json          # Developer scripts for iterating locally
├── README.md             # You are here
└── src/
    └── lib.rs            # Minimal implementation that spawns the language server
```

## Building

```bash
cd packages/zed
pnpm install
pnpm run build
```

The `build` script first vendors a copy of `@wc-toolkit/language-server` into `packages/zed/language-server/` (bin, dist, and a production `node_modules` tree), ensures `cargo-component` is available (installing it on demand), then runs `cargo component build --target wasm32-wasip1 --release` to emit a WebAssembly *component* at `target/wasm32-wasip1/release/wc_zed_extension.wasm`, finally copying it to `extension.wasm`. The resulting artifact can be packaged with the [`zed-extension` CLI](https://github.com/zed-industries/zed/tree/main/zed-extension) or installed locally as a dev extension.

Need to refresh the bundled language server without triggering a full build? Run:

```bash
pnpm run sync-language-server
```

This mirrors the JetBrains workflow: the extension always ships with a known-good copy of the language server so Zed never needs to `npm install` at runtime.

## Developing locally

Need to iterate quickly inside Zed? Use the new `pnpm dev` workflow:

```bash
cd packages/zed
pnpm dev
```

The script automatically refreshes the bundled language server (same as `pnpm run sync-language-server`) before compiling the wasm artifact.

The script does the following:

1. Builds the WebAssembly crate in debug mode (faster incremental compiles) and refreshes `extension.wasm`.
2. Attempts to locate the `zed` binary (checks `$ZED_BIN`, your `PATH`, and `/Applications/Zed.app/Contents/MacOS/zed`).
3. Launches Zed in the foreground (default workspace: `demos/html`, overridable via `ZED_WORKSPACE_PATH`). Follow Zed's documented steps—open the command palette and run **`Install Dev Extension`**, then select `packages/zed`.

If the CLI is missing, the script prints the extension path so you can manually run `zed: install dev extension` from Zed instead.

## Next steps

- Flesh out documentation (see repository-level ROADMAP.md)
- Sync version numbers with the npm language server as we cut releases
- Automate packaging + validation once the wasm surface stabilizes
