# Web Components Language Server — Neovim Plugin

First-class Neovim support for the Web Components Language Server. The plugin wires the server into Neovim’s built-in LSP client so you get completions, hovers, and diagnostics for any project that ships a `custom-elements.json` file.

## Highlights

- 🔌 Zero-config attach for HTML, Astro, Vue, Svelte, JSX/TSX, and Markdown files
- 🧠 Tag, attribute, and attribute-value completions sourced from your Custom Elements Manifest
- 🛡️ Diagnostics for unknown tags, invalid attribute values, duplicates, and deprecated APIs
- ♻️ Automatic restart when `wc.config.*`, `custom-elements.json`, `package.json`, or `node_modules` change
- 🗂️ Commands to restart/stop/start the server plus an API (`require("wc_language_server").restart()`)

## Prerequisites

1. **Neovim 0.9 or newer** (0.10+ recommended)
2. **Node.js 16+** available on `$PATH`
3. A project that exposes a `custom-elements.json` (directly or via dependencies)

## Installation

### lazy.nvim

```lua
{
  "wc-toolkit/wc-language-server",
  dir = "/path/to/wc-language-server",
  ft = { "html", "javascriptreact", "typescriptreact", "astro", "svelte", "vue", "markdown", "mdx" },
  config = function()
    require("wc_language_server").setup()
  end,
}
```

### packer.nvim

```lua
use({
  "wc-toolkit/wc-language-server",
  as = "wc-language-server",
  config = function()
    require("wc_language_server").setup()
  end,
})
```

> ℹ️ If you clone to a different path, make sure Neovim’s `runtimepath` includes `packages/neovim`.

## Quick Start

```lua
require("wc_language_server").setup({
  autostart = true,
  filetypes = { "html", "astro", "vue" },
  root_dir_patterns = { "wc.config.js", "package.json", ".git" },
  tsdk = vim.fn.getcwd() .. "/node_modules/typescript/lib",
})
```

1. Open an HTML (or supported) file.
2. Trigger completion with `<C-x><C-o>` (or your completion plugin) to see `<sl-…>` tags.
3. Hover with `K` to see docs + diagnostics.
4. Use `:WcLanguageServerRestart` if you edit `wc.config.*` or add libraries.

Hover popups are rendered as Markdown automatically (bold, code fences, tables, etc.). Set `hover.markdown_highlighting = false` if you want the legacy plain-text view.

### Project Configuration (`wc.config.js`)

The language server reads settings from `wc.config.js` (or `.ts/.mjs/.cjs`) at the project root. Use it to point the server at the right manifest, scope files, and override diagnostics.

```js
// wc.config.js
export default {
  /** Fetch a manifest from a custom path or URL */
  manifestSrc: "./dist/custom-elements.json",
  /** Narrow which files opt into the language server */
  include: ["src/**/*.ts", "src/**/*.html"],
  /** Optional: skip specific globs */
  exclude: ["**/*.stories.ts"],
  /** Per-library overrides */
  libraries: {
    "@your/pkg": {
      manifestSrc: "https://cdn.example.com/custom-elements.json",
      /** Adjust tag names before validation */
      tagFormatter: (tag) => tag.replace(/^x-/, "my-")
    }
  },
  /** Silence/relax certain diagnostics */
  diagnosticSeverity: {
    duplicateAttribute: "warning",
    unknownElement: "info",
  },
};
```

Key fields:
- `manifestSrc`: local path or remote URL when `custom-elements.json` is not at the repo root.
- `include`/`exclude`: glob arrays to scope which files trigger the language server.
- `libraries`: per-package overrides for monorepos or vendor bundles.
- `diagnosticSeverity`: tune error levels (`error`, `warning`, `info`, `hint`, `off`).
- `tagFormatter`/`typeSrc` and other advanced options match the [VS Code integration docs](../vscode/README.md#configuration).

Every time you change `wc.config.*` the Neovim plugin automatically restarts the server, so edits apply on your next hover/completion.

## Plugin Configuration

| Option                         | Type                  | Default                                                                      | Description                                                                                                                                        |
| ------------------------------ | --------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autostart`                    | boolean               | `true`                                                                       | Attach automatically when a matching filetype opens.                                                                                               |
| `filetypes`                    | string[]              | HTML + popular templating filetypes                                          | Customize the attach list.                                                                                                                         |
| `root_dir_patterns`            | string[]              | `{ "wc.config.js", "package.json", ".git" }`                                 | Upward search markers for workspace detection.                                                                                                     |
| `cmd`                          | string[] or fun(root) | auto-detected                                                                | Override the server command. Defaults to the bundled binary, then `wc-language-server` on `$PATH`.                                                 |
| `tsdk`                         | string                | auto-detected                                                                | Path to `node_modules/typescript/lib`. If omitted a best-effort search runs.                                                                       |
| `watch_patterns`/`watch_files` | string[]              | important config names                                                       | Control which files trigger automatic restarts.                                                                                                    |
| `debounce_ms`                  | number                | `350`                                                                        | Debounce before restarting after file system events.                                                                                               |
| `settings`                     | table                 | `{}`                                                                         | Passed to the language server via `initializationOptions`.                                                                                         |
| `capabilities`                 | table                 | `nil`                                                                        | Override reported LSP capabilities.                                                                                                                |
| `on_attach`                    | function              | `nil`                                                                        | Called after the client attaches. Use this for formatting, keymaps, etc.                                                                           |
| `diagnostics`                  | table/false           | see defaults                                                                 | Configure `vim.diagnostic` (virtual text is off by default).                                                                                       |
| `hover`                        | table/false           | `{ keymap = "K", include_diagnostics = true, markdown_highlighting = true }` | Customize the combined hover/diagnostic popup, keybinding, and whether markdown syntax/Tree-sitter highlighting is applied to the floating window. |
| `completion.set_omnifunc`      | boolean               | `true`                                                                       | Set `omnifunc = v:lua.vim.lsp.omnifunc` so `<C-x><C-o>` uses the language server.                                                                  |

## Commands & Keybinds

| Command                    | Description                                   |
| -------------------------- | --------------------------------------------- |
| `:WcLanguageServerStart`   | Attach the client for the current buffer.     |
| `:WcLanguageServerStop`    | Stop the client for the current project root. |
| `:WcLanguageServerRestart` | Restart the client and reload manifests.      |

- `K` (configurable) shows hover text plus any diagnostics on the current line.
- `<C-x><C-o>` triggers LSP completion; use your completion framework (e.g., nvim-cmp) if preferred.

## Troubleshooting

- **No completions or hover** – run `:LspInfo` to ensure `wc-language-server` is attached. If not, verify the filetype is listed in `filetypes` and that the root dir was detected correctly.
- **“Unable to locate wc-language-server binary”** – build the server with `pnpm build:ls` or set `cmd` to a global installation.
- **Diagnostics missing** – check `:lua vim.diagnostic.open_float()` at the cursor; if nothing shows, ensure `custom-elements.json` exists and watch for errors in `:messages`.
- **Watching doesn’t restart** – confirm the files you edit match `watch_patterns` or add your own (e.g., for monorepo manifests).
- **Too many completion entries** – limit completion sources (buffer/snippet) or use `completion.set_omnifunc = false` and delegate to your completion plugin for filtering.

If you need to reproduce an issue quickly, run `pnpm dev` from the repo root. It launches Neovim with this plugin preloaded, opens `demos/html/test.html`, and prints all plugin logs to `:messages`.
