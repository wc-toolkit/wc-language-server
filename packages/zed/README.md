# Zed integration for the Web Components Language Server

This package bundles the Web Components language server and exposes it as a Zed
extension so you can use framework-aware diagnostics, completions, and tooling
in HTML, TypeScript, and single-file component templates.

## Contents

- `extension.toml` &mdash; Extension manifest that registers the language server
  for the relevant languages.
- `Cargo.toml` / `src/lib.rs` &mdash; Rust entry point that wires the extension to
  a local Node.js bundle of the language server.
- `scripts/bundle-language-server.mjs` &mdash; Copies the JavaScript bundle that is
  produced by `@wc-toolkit/language-server` into this package.
- `scripts/dev.mjs` &mdash; Developer workflow used by `pnpm dev`.

## Development workflow

```bash
# Install workspace dependencies first
pnpm install

# Bundle the language server, build the WebAssembly artifact, link the dev
# extension into Zed's data directory, and finally start `zed --foreground`.
pnpm dev
```

`pnpm dev` performs the following steps:

1. Runs the bundler script so the latest `wc-language-server.bundle.cjs` is
   copied into `packages/zed/server/bin`.
2. Ensures `rustup target add wasm32-wasip2` is installed and compiles
   `extension.wasm` via `cargo build --release --target wasm32-wasip2`.
3. Copies the optimized artifact from `target/wasm32-wasip2/release/*.wasm`
  to `extension.wasm`, which is what Zed loads at runtime.
4. Symlinks the extension directory into
  `~/Library/Application Support/Zed/extensions/dev/wc-language-server`
  (or the Linux equivalent under `${XDG_DATA_HOME:-~/.local/share}/zed`).
5. Launches `zed --foreground` with `demos/html` when it exists (or a custom
  directory) so you can see log output from the extension in the terminal
  immediately.

If the Zed CLI is not on your `PATH`, install it via the `cli: install` command
inside Zed before running `pnpm dev`.

## Manual commands

- `pnpm --filter @wc-toolkit/zed run bundle` &mdash; only copy the language server
  bundle without touching Zed.
- `pnpm --filter @wc-toolkit/zed run build` &mdash; bundle the language server,
  build the WebAssembly payload, and emit `extension.wasm` without launching Zed.
- `cargo build --release --target wasm32-wasip2` from `packages/zed` &mdash; rebuild
  the extension WebAssembly payload manually if you are iterating on
  `src/lib.rs`.

## Environment variables

- `WC_LANGUAGE_SERVER_BINARY` &mdash; absolute path to a custom language server
  executable/script. When set, the Rust extension will run that command instead
  of the bundled Node.js file.
- `WC_LANGUAGE_SERVER_NODE` &mdash; override the Node.js binary used to start the
  bundled language server.
- `ZED_EXTENSIONS_DIR` &mdash; override the location where the dev script creates
  the symlink (defaults to the "dev" directory inside Zed's data dir).
- `ZED_BIN` &mdash; full path to the Zed executable if it is not discoverable via
  your `PATH`.
- `ZED_WORKSPACE_DIR` &mdash; absolute path of the workspace directory to open in
  Zed. Defaults to `demos/html` when it exists, otherwise falls back to the
  repository root.
