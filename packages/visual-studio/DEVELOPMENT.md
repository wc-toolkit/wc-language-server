# Visual Studio Extension Development

This guide covers how to build, run, and package the Visual Studio extension in `packages/visual-studio`.

## Prerequisites

- Visual Studio 2022 (17.x) with extension development workload
- .NET SDK installed (used for `dotnet build`)
- Node.js + pnpm (for workspace tasks)

## Build the language server binaries

The extension bundles language server binaries from `packages/language-server/bin`.

From repo root:

```bash
pnpm run build:ls
```

This generates/updates:

- `wc-language-server-windows-x64.exe`
- `wc-language-server-macos-x64`
- `wc-language-server-macos-arm64`
- `wc-language-server-linux-x64`
- `wc-language-server-linux-arm64`
- `wc-language-server.js`

## Build the extension

From `packages/visual-studio`:

```bash
dotnet build WebComponentsLanguageServer.VisualStudio.csproj -c Release
```

Output is placed under `bin/Release/net472/`.

## Run / debug in Visual Studio

1. Open `WebComponentsLanguageServer.VisualStudio.csproj` in Visual Studio.
2. Set configuration to **Debug** (or **Release** if preferred).
3. Start debugging (`F5`) to launch the Visual Studio experimental instance.
4. Open a test project/file (`.html`, `.ts`, `.js`, `.css`, `.vue`, `.astro`, etc.) and verify language features.

Useful commands in the experimental instance (Tools menu):

- `Restart Web Components Language Server`
- `Check Web Components Language Server Status`

## Package / install VSIX

Build/package on **Windows** (with Visual Studio build tools) and locate the generated `.vsix` under `packages/visual-studio/bin/**`.

If you're on macOS/Linux, use the GitHub Actions workflow `.github/workflows/release-visual-studio-vsix.yml` to produce and download the VSIX artifact.

To install locally:

1. Close Visual Studio instances.
2. Double-click the generated `.vsix`.
3. Reopen Visual Studio.

## Runtime notes

- The client resolves and prefers a native binary per OS/architecture:
  - `wc-language-server-windows-x64.exe`
  - `wc-language-server-macos-x64`
  - `wc-language-server-macos-arm64`
  - `wc-language-server-linux-x64`
  - `wc-language-server-linux-arm64`
- If no matching native binary is available (or native mode is disabled), it falls back to:
  - `node wc-language-server.js`
- Configure behavior at:
  - `Tools > Options > Web Components > Language Server`
  - `Activation Scope = AnyText` starts immediately for text content
  - `Activation Scope = WebComponentFileTypes` delays start until a supported file opens
  - `Supported File Extensions` controls that file list (comma or semicolon separated)
    - Default: `*` (allow any file extension)
    - Example custom value: `.html,.liquid,.njk,.svelte,.astro`

## CI / release

The repo includes workflow automation for VSIX builds and release artifacts in:

- `.github/workflows/release-visual-studio-vsix.yml`

To enable automatic publishing to Visual Studio Marketplace from that workflow, set this repository secret:

- `VSCODE_MARKETPLACE`
