# Upstreaming the Web Components Language Server

This document collects the artifacts we need when proposing first-class support upstream in the Neovim ecosystem. It contains a ready-to-copy `nvim-lspconfig` template plus notes for publishing an npm package that Mason can install.

## nvim-lspconfig template

Place the following file at `lua/lspconfig/server_configurations/wc_language_server.lua` inside the `nvim-lspconfig` repository and add an entry to `doc/server_configurations.md`.

```lua
local util = require("lspconfig.util")

return {
  default_config = {
    cmd = { "wc-language-server", "--stdio" },
    filetypes = {
      "html",
      "handlebars",
      "htmldjango",
      "javascript",
      "javascriptreact",
      "typescript",
      "typescriptreact",
      "vue",
      "svelte",
      "astro",
      "twig",
      "css",
      "scss",
      "less",
      "markdown",
      "mdx",
    },
    root_dir = util.root_pattern(
      "wc.config.js",
      "wc.config.ts",
      "custom-elements.json",
      "package.json",
      ".git"
    ),
    settings = {},
  },
  docs = {
    description = [[
Language server for Web Components and custom elements. Point the server at a
`wc.config.js` (or compatible config file) that resolves your
`custom-elements.json` manifests for best completions and diagnostics.
    ]],
    default_config = {
      root_dir = [[root_pattern("wc.config.js", "custom-elements.json", "package.json", ".git")]],
    },
  },
}
```

Doc blurb (append to `doc/server_configurations.md`):

```
## wc_language_server

Project repository: https://github.com/wc-toolkit/wc-language-server

The server surfaces Web Components completions, hovers, and diagnostics derived
from `custom-elements.json`. Add a `wc.config.js` file to your workspace to
point at manifests (local paths or remote URLs) and adjust diagnostics per
library.

### Installation

Use `npm install -g @wc-toolkit/language-server` or `:MasonInstall wc-language-server`.

### Configuration

```lua
require('lspconfig').wc_language_server.setup({
  -- settings = {},
})
```

- `root_dir` defaults to the first directory containing `wc.config.js`,
  `custom-elements.json`, `package.json`, or `.git`.
- Customize diagnostics/libraries via `wc.config.js` (see the upstream README).
```

## Mason registry plan (npm)

We will publish an npm package that Mason can download directly, avoiding custom tarballs. Steps:

1. **Publish `@wc-toolkit/language-server`**
   - Source: `packages/language-server`.
   - Ensure `package.json` has:
     ```json
     {
       "name": "@wc-toolkit/language-server",
       "version": "0.1.0",
       "bin": {
         "wc-language-server": "./bin/wc-language-server.js"
       },
       "type": "module",
       "files": ["bin", "dist", "README.md"],
       "engines": { "node": ">=18" }
     }
     ```
   - `bin/wc-language-server.js` should be an executable that runs `node ./bin/wc-language-server.js --stdio` when no args are provided.
   - Publish via `pnpm publish --filter @wc-toolkit/language-server --access public` whenever you tag releases.

2. **Add a Mason package spec**
   - File: `mason-registry/packages/wc-language-server.json`.
   - Example contents:
     ```json
     {
       "name": "wc-language-server",
       "description": "Web Components language server",
       "homepage": "https://github.com/wc-toolkit/wc-language-server",
       "licenses": ["MIT"],
       "languages": ["HTML", "JavaScript", "TypeScript", "Vue", "Svelte", "Astro"],
       "categories": ["LSP"],
       "source": {
         "npm": "@wc-toolkit/language-server"
       },
       "bins": ["wc-language-server"],
       "shareddirs": [],
       "install": [
         "npm",
         "install",
         "--prefix",
         "${MASON_PACKAGE_INSTALL_PREFIX}",
         "@wc-toolkit/language-server"
       ],
       "post_install": [
         "ln",
         "-sf",
         "${MASON_PACKAGE_INSTALL_PREFIX}/bin/wc-language-server",
         "${MASON_PACKAGE_BIN}/wc-language-server"
       ]
     }
     ```
   - Mason automatically injects `npm` into the PATH; no extra script is required as long as the package reports a `bin` field.

3. **Document the workflow**
   - Update this repository’s `packages/neovim/README.md` with a short note: “Install the language server globally via `npm i -g @wc-toolkit/language-server` or `:MasonInstall wc-language-server`”.
   - Mention Node 18+ is required.

4. **Release flow**
   - Version bump `packages/language-server` → publish to npm → tag the repo (`vX.Y.Z`).
   - Mason’s `registry.yaml` will pick up the new npm version automatically; no extra artifact upload is needed.

With the npm package published and the Mason entry merged, `:MasonInstall wc-language-server` will place the binary on Neovim’s PATH, and users can enable the server by calling `require('lspconfig').wc_language_server.setup({})`.
