# Current Status

⚠️ **IMPORTANT: This extension is currently non-functional due to Zed platform limitations**

## The Issue

Zed v0.213.3 does not support adding supplementary language servers to languages that already have a primary language server defined.

### What We've Tried

1. ✅ Extension compiles and loads successfully (shows "loading 3" in logs)
2. ✅ Language server binary works when run manually  
3. ✅ Extension WASM (265KB) is correctly built and symlinked
4. ✅ Language server files are properly bundled
5. ❌ **Zed never invokes `language_server_command()` from the extension**

### Technical Details

- The HTML language already has `vscode-html-language-server` from the built-in `html` extension
- Our extension declares `web-components-language-server` with:
  ```toml
  [language_servers.web-components-language-server]
  name = "Web Components Language Server"
  language = "HTML"
  languages = []
  ```
- User settings.json configuration doesn't activate it:
  ```json
  {
    "languages": {
      "HTML": {
        "language_servers": ["web-components-language-server", "vscode-html-language-server"]
      }
    }
  }
  ```
- Logs show only `vscode-html-language-server` and `tailwindcss-language-server` starting
- **No errors** - the extension just isn't being asked to provide its language server

### Root Cause

Zed's extension API (`zed_extension_api` v0.2.0) and the Zed IDE itself (v0.213.3) don't yet have the infrastructure to:
1. Recognize language servers declared by extensions that don't own the language definition
2. Activate multiple language servers for a single language based on user configuration
3. Merge language server arrays from settings with extension-provided servers

This is an architectural limitation, not a bug in our implementation.

## Workaround

Users CAN manually configure the language server using the `lsp` section in project-level `.zed/settings.json`:

```json
{
  "lsp": {
    "web-components-language-server": {
      "binary": {
        "path": "/path/to/node",
        "arguments": [
          "/path/to/wc-language-server.js",
          "--stdio"
        ]
      }
    }
  },
  "languages": {
    "HTML": {
      "language_servers": ["web-components-language-server", "vscode-html-language-server"]
    }
  }
}
```

However, this:
- Requires manual path configuration
- Loses the benefit of the extension's automatic setup  
- Must be done per-project
- Doesn't use the extension at all

## Next Steps

### For Zed to Support This

Zed needs to implement one of:
1. **Extension-contributed language servers** that can be referenced in settings without owning the language
2. **Multi-language-server support** where extensions can register as supplementary servers
3. **Language server middleware** allowing extensions to augment existing language servers

### For This Extension

**Option A: Wait for Zed platform maturity** (Recommended)
- Monitor Zed releases for multi-language-server support
- Update extension when the feature becomes available
- This is likely coming as Zed's extension system is actively developed

**Option B: Make it the primary HTML server**
- Remove `language = "HTML"` and have it replace vscode-html-language-server entirely
- Would lose built-in HTML features unless we proxy to vscode-html-language-server
- Not recommended

**Option C: Create a different language**
- Define a `.wc.html` or similar file extension
- Make web-components-language-server the primary (and only) server for that language
- Users would need to rename their HTML files
- Very poor UX

## Comparison to Other IDEs

| IDE | Multi-Language-Server Support | Status |
|-----|------------------------------|--------|
| VS Code | ✅ Full support via `contributes.languages` | ✅ Working |
| JetBrains | ✅ Full support via LSP4IJ | ✅ Working |  
| Zed | ❌ Not yet supported (v0.213.3) | ❌ Blocked |

## Timeline

- **Short term**: Extension builds but doesn't function
- **Medium term**: Wait for Zed platform updates (likely in next few releases)
- **Long term**: Full functionality when Zed supports extension-contributed supplementary language servers

## Files Status

| Component | Status | Notes |
|-----------|--------|-------|
| extension.toml | ✅ Correct | Properly declares language server |
| extension.wasm | ✅ Compiles | 265KB, loads successfully |
| src/lib.rs | ✅ Correct | `language_server_command()` never called by Zed |
| language-server/ | ✅ Bundled | All files present and working |
| Dev workflow | ✅ Works | `pnpm dev` builds, installs, and reloads correctly |

Last updated: 2024-11-22
Zed version tested: 0.213.3
