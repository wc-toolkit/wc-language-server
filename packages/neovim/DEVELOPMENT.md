# Neovim Plugin Development Guide

Everything you need to iterate on the Neovim integration that lives in `packages/neovim`.

## Prerequisites

- **Node.js 18+** and **pnpm 9+**
- **Neovim 0.9+** installed locally
- macOS (recommended) or any platform with `node`, `pnpm`, and Neovim
- Familiarity with Lua and Neovim LSP APIs

## Repository Setup

```bash
# clone once
git clone https://github.com/wc-toolkit/wc-language-server.git
cd wc-language-server

# install dependencies
pnpm install

# build the language server output used by the plugin
pnpm build:ls
```

The language server build step produces `packages/language-server/bin/wc-language-server`. The Neovim plugin prefers this local binary but can also call a globally installed `wc-language-server` if you skip the build. Keeping the local build up to date ensures you are testing the same code that ships with the plugin.

## Dev Profile (`pnpm dev`)

Run the included dev profile to work on the plugin without touching your personal Neovim configuration:

```bash
pnpm dev
```

What it does:

1. Sets `NVIM_APPNAME=wc-ls-dev` so Neovim uses an isolated config directory.
2. Adds `packages/neovim` to `runtimepath`/`packpath`.
3. `cd`s into `demos/html`, opens `test.html`, enables syntax highlighting, and applies the `habamax` colorscheme.
4. Starts the Web Components language server and enables file watchers/logging.

On macOS the script launches a new Terminal window via `osascript`; on other platforms it falls back to running Neovim in the current shell. Edit `packages/neovim/dev/init.lua` if you want to point the profile at a different project or add plugins (e.g., LazyVim) while developing.

## Iterating on the Plugin

- Source code lives in `packages/neovim/lua/wc_language_server/`.
- The entry point is `init.lua`; export any additional modules from the same folder if you split the codebase.
- Use `:so %` inside Neovim to reload the buffer you are editing, then restart the server with `:WcLanguageServerRestart` to pick up changes.
- Logs go to `:messages`. You can also inspect the LSP log via `:lua vim.cmd('edit '..vim.lsp.get_log_path())`.
- The plugin exposes `require("wc_language_server").status()` which returns active client IDs per root to help verify attach/detach.

## Debugging Checklist

| Symptom | Steps |
| --- | --- |
| Client never attaches | Run `:LspInfo`. If the server is absent, check `filetype`, `root_dir_patterns`, and make sure `cmd` resolves (logs will show "Unable to locate wc-language-server"). |
| Hover errors | `K` calls `build_hover_with_diagnostics`. Check `:messages` for stack traces; these originate from `packages/neovim/lua/wc_language_server/init.lua`. |
| File watchers not firing | The plugin watches `wc.config.*`, `custom-elements.json`, `package.json`, and `node_modules` by default. Edit `watch_patterns`/`watch_files` in the config to cover additional paths, then restart the client. |
| Completion polluted by buffer words | Limit completion sources via your completion plugin or set `completion.set_omnifunc = false` and manage `omnifunc` yourself. |

## Running Tests

There are currently no automated tests for the Neovim package. Manual testing via `pnpm dev` is the primary workflow. When adding new features, consider scripting reproducible scenarios in `demos/html` to keep QA straightforward.

## Releasing Changes

1. Ensure `pnpm build:ls` succeeds.
2. Bundle the language server into the plugin for distribution:

	```bash
	pnpm build:ls
	pnpm --filter @wc-toolkit/neovim run bundle
	```

	This produces a single-file build at `packages/neovim/server/bin/wc-language-server` (ignored by git) so you can ship the plugin with a self-contained server.
3. Verify the plugin works in the dev profile and in a clean Neovim session (preferably with only the bundled server available).
4. Update `CHANGELOG.md` at the repo root or include a Changeset if you are publishing a release.
5. Commit only the Lua/docs changes you touched—do **not** check in generated `server/` artifacts.

For deeper integration tips (e.g., hooking into LazyVim), keep the README focused on end-users and document advanced workflows here.
