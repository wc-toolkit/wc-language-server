# Quick Reference - JetBrains Plugin

## Essential Commands

```bash
# From packages/jetbrains directory

# Build the plugin
./gradlew buildPlugin

# Run in sandbox WebStorm (BEST for testing)
./gradlew runIde

# Run tests
./gradlew test

# Clean build
./gradlew clean

# Verify plugin
./gradlew verifyPlugin
```

## From Repository Root

```bash
# Build everything (run this first!)
pnpm build

# Build just the language server
pnpm build:ls

# Build JetBrains plugin
pnpm jetbrains:build

# Run in sandbox
pnpm jetbrains:run

# Test JetBrains plugin
pnpm jetbrains:test
```

## Testing in 3 Steps

```bash
# 1. Build the language server
pnpm build

# 2. Run plugin in sandbox WebStorm
cd packages/jetbrains && ./gradlew runIde

# 3. In sandbox WebStorm: Open demos/html folder
```

## Plugin Output

After `./gradlew buildPlugin`:
- **Location**: `build/distributions/wc-language-server-jetbrains-0.0.1.zip`
- **Install**: Settings → Plugins → ⚙️ → Install Plugin from Disk

## Settings in IDE

`Settings → Tools → Web Components Language Server`

- Node.js Path: (auto-detected)
- Enable MCP Server: ☐
- MCP Transport: http
- MCP Port: 3000
- MCP Host: localhost

## IDE Actions

- `Tools → Restart Web Components Language Server`
- `Tools → Check Web Components MCP Server Status`

## File Watchers (Auto-restart triggers)

- `wc.config.js` (or .cjs, .mjs, .ts, .json)
- `custom-elements.json`
- `package.json`
- `node_modules/` (create/delete)

## Supported File Types

- `.html`, `.htm`, `.xhtml`
- `.vue`
- `.svelte`
- `.jsx`, `.tsx`
- `.astro`
- `.mdx`
- `.cshtml`
- `.twig`

## Troubleshooting

**Language server won't start?**
```bash
# Rebuild language server
cd ../.. && pnpm build
```

**Can't find Node.js?**
- Add to PATH or set in Settings

**Plugin won't load?**
```bash
# Clean and rebuild
./gradlew clean buildPlugin
```

**MCP Server port in use?**
- Change port in Settings
- Or kill process: `lsof -i :3000` (Mac/Linux)

## Testing Features

### Autocomplete
```html
<sl-[CTRL+SPACE]
```

### Hover
```html
<sl-button>  <!-- Hover here -->
```

### Diagnostics
```html
<sl-button invalid-attr="test">  <!-- Should show error -->
```

## Logs

**Mac**: `~/Library/Logs/JetBrains/WebStorm2023.2/idea.log`
**IDE**: `Help → Show Log in Finder/Explorer`

## Gradle Tasks

| Task | Description |
|------|-------------|
| `buildPlugin` | Build the plugin ZIP |
| `runIde` | Run in sandbox IDE |
| `test` | Run tests |
| `verifyPlugin` | Verify plugin structure |
| `clean` | Clean build artifacts |
| `prepareSandbox` | Prepare plugin sandbox |

## NPM Scripts (from root)

| Script | Command |
|--------|---------|
| `pnpm jetbrains:build` | Build plugin |
| `pnpm jetbrains:run` | Run sandbox |
| `pnpm jetbrains:test` | Run tests |

## Demo Projects

**HTML Demo**: `demos/html` - Shoelace components
**NPM Demo**: `demos/npm` - Package-based components

## Key Files

| File | Purpose |
|------|---------|
| `build.gradle.kts` | Gradle config |
| `plugin.xml` | Plugin metadata |
| `WCLanguageServerProvider.kt` | LSP integration |
| `WCSettings.kt` | Settings |
| `MCPServerService.kt` | MCP server |
| `WCFileWatcherService.kt` | File watchers |

## Minimum Requirements

- JDK 17+
- Node.js 16+
- WebStorm/IntelliJ 2023.2+
- Gradle 8.5+ (included via wrapper)

## Documentation

- **README.md** - Main documentation
- **TESTING.md** - Testing guide
- **DEVELOPMENT.md** - Development summary
- **CHANGELOG.md** - Version history
