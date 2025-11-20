# JetBrains Plugin Development Summary

## What Was Created

A complete JetBrains plugin for Web Components Language Server with feature parity to the VS Code extension.

## Project Structure

```
packages/jetbrains/
├── build.gradle.kts                           # Gradle build configuration
├── settings.gradle.kts                        # Gradle settings
├── gradle.properties                          # Plugin properties
├── package.json                               # NPM scripts for convenience
├── README.md                                  # Comprehensive documentation
├── TESTING.md                                 # Testing guide
├── CHANGELOG.md                               # Version history
├── LICENSE                                    # MIT License
├── .gitignore                                 # Git ignore rules
├── gradle/wrapper/
│   └── gradle-wrapper.properties             # Gradle wrapper config
├── .run/
│   └── runConfigurations.xml                 # IDE run configurations
└── src/main/
    ├── kotlin/com/wctoolkit/webcomponents/
    │   ├── WCLanguageServerProvider.kt       # LSP integration
    │   ├── WCLanguageServerService.kt        # Server lifecycle management
    │   ├── WCFileWatcherService.kt           # File watchers for auto-restart
    │   ├── WCProjectListener.kt              # Project lifecycle events
    │   ├── settings/
    │   │   ├── WCSettings.kt                 # Settings persistence
    │   │   └── WCSettingsConfigurable.kt     # Settings UI
    │   ├── actions/
    │   │   ├── RestartLanguageServerAction.kt
    │   │   └── CheckMCPStatusAction.kt
    │   └── mcp/
    │       └── MCPServerService.kt           # MCP server management
    └── resources/
        └── META-INF/
            └── plugin.xml                     # Plugin configuration
```

## Features Implemented

### Core Features (Matching VS Code Extension)

✅ **Language Server Integration**
- Full LSP support via IntelliJ Platform's LSP framework
- Automatic server startup for relevant file types (HTML, Vue, JSX, etc.)
- Node.js detection from PATH or custom configuration

✅ **HTML Diagnostics**
- Custom element validation
- Attribute type checking (boolean, number, enum, string)
- Deprecated element/attribute warnings
- Duplicate attribute detection

✅ **Editor Features**
- Smart autocomplete for custom elements
- Hover documentation
- Go-to-definition
- CSS custom property support

✅ **File Watchers with Auto-Restart**
- Watches `wc.config.js`, `wc.config.cjs`, `wc.config.mjs`, `wc.config.ts`, `wc.config.json`
- Watches `custom-elements.json`
- Watches `package.json`
- Watches `node_modules` directory changes
- Debounced restart (300ms) to avoid excessive restarts

✅ **Model Context Protocol (MCP) Server**
- HTTP and stdio transport modes
- Configurable host and port
- Component documentation serving
- Health check endpoint
- Status checking action

✅ **Settings UI**
- Application-level settings
- Node.js path configuration
- MCP server enable/disable
- Transport mode selection
- Port and host configuration

✅ **Actions**
- Restart Language Server
- Check MCP Server Status

### JetBrains-Specific Features

✅ **IDE Integration**
- Proper notification groups
- Gradle-based build system
- Run configurations for development
- Plugin verification
- Compatible with WebStorm 2023.2+ and IntelliJ IDEA 2023.2+

✅ **Project Lifecycle**
- Automatic service initialization on project open
- Clean shutdown on project close
- Resource cleanup

## How to Test Locally in WebStorm

### Quick Start

```bash
# 1. Build the language server (from repository root)
pnpm build

# 2. Run the plugin in a sandbox WebStorm
cd packages/jetbrains
./gradlew runIde
```

This will:
1. Launch a separate WebStorm instance
2. Pre-install the plugin
3. Use an isolated sandbox environment
4. Allow live development

### Open a Demo Project

In the sandbox WebStorm:
1. `File → Open`
2. Navigate to `[repository]/demos/html`
3. Open `test.html`
4. Test autocomplete, hover, and diagnostics

### Detailed Testing Guide

See [`packages/jetbrains/TESTING.md`](TESTING.md) for:
- Step-by-step testing instructions
- Debugging setup
- Troubleshooting common issues
- Alternative installation methods

## Key Differences from VS Code Extension

### Architecture

| Aspect | VS Code | JetBrains |
|--------|---------|-----------|
| Language | TypeScript | Kotlin |
| LSP Framework | @volar/vscode | IntelliJ Platform LSP |
| Build System | esbuild/npm | Gradle |
| Settings | VS Code Settings API | IntelliJ Settings API |
| Chat Integration | Chat Participant + LM Tool | Not applicable (yet) |

### What's NOT Included (VS Code-Specific)

❌ **Chat Participant** - VS Code-specific API, no equivalent in JetBrains
❌ **Language Model Tool** - Copilot/Cursor integration, VS Code-specific
❌ **Query Parser UI** - Chat-based features not applicable

These features depend on VS Code's AI/chat APIs which don't have JetBrains equivalents yet.

### What IS Included (Full Parity)

✅ Language Server Protocol integration
✅ All HTML diagnostics and validation
✅ Autocomplete, hover, go-to-definition
✅ File watchers with auto-restart
✅ MCP Server (HTTP and stdio modes)
✅ Settings UI
✅ Status checking and restart actions

## Building and Distribution

### Build Plugin

```bash
./gradlew buildPlugin
```

Output: `build/distributions/wc-language-server-jetbrains-0.0.1.zip`

### Run in Sandbox

```bash
./gradlew runIde
```

### Run Tests

```bash
./gradlew test
```

### Verify Plugin

```bash
./gradlew verifyPlugin
```

## Installation Methods

### For End Users (Future)

1. **From JetBrains Marketplace** (when published)
   - Settings → Plugins → Marketplace
   - Search "Web Components Language Server"
   - Install

### For Developers/Testing

1. **Install from Disk**
   - Build the plugin: `./gradlew buildPlugin`
   - Settings → Plugins → ⚙️ → Install Plugin from Disk
   - Select the ZIP from `build/distributions/`

2. **Run in Sandbox** (Recommended for development)
   - `./gradlew runIde`
   - Opens separate WebStorm with plugin pre-installed

## Configuration

### Settings Location

`Settings → Tools → Web Components Language Server`

### Available Settings

- **Node.js Path**: Override automatic Node.js detection
- **Enable MCP Server**: Toggle MCP server on/off
- **MCP Transport**: Choose between `http` or `stdio`
- **MCP Port**: Port number for HTTP mode (default: 3000)
- **MCP Host**: Host address for HTTP mode (default: localhost)

### Project Configuration

Create `wc.config.js` in project root:

```javascript
export default {
  customElementsManifest: './custom-elements.json',
  diagnostics: {
    unknownElement: 'warning',
    unknownAttribute: 'warning',
    deprecatedElement: 'error',
    deprecatedAttribute: 'warning',
    duplicateAttribute: 'error'
  }
};
```

## Setting Up Development Environment

### Prerequisites

**Required:**
- **JDK 17 or 21** (NOT Java 25) - The Kotlin compiler and IntelliJ Gradle plugin don't support Java 25 yet
- **Node.js 16+** - For running the language server
- **Gradle 8.10.2+** - Included via wrapper

**Recommended:**
- **IntelliJ IDEA** - For developing the plugin itself

### Step 1: Install JDK 17

The project requires JDK 17 or 21. If you have Java 25 or another version, install JDK 17:

**macOS (using Homebrew):**
```bash
brew install --cask temurin17
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt install openjdk-17-jdk

# Fedora
sudo dnf install java-17-openjdk-devel
```

**Windows:**
Download from [Adoptium](https://adoptium.net/temurin/releases/?version=17)

**Verify installation:**
```bash
/usr/libexec/java_home -V  # macOS
java -version              # All platforms
```

### Step 2: Build the Language Server

Before building the plugin, you must build the language server:

```bash
# From repository root
cd /Users/burtonsmith/Documents/Projects/wc-toolkit/wc-language-server2
pnpm install
pnpm build
```

This creates:
- `packages/language-server/dist/` - Language server files
- `packages/vscode/dist/` - MCP server and utilities

### Step 3: Verify Java Toolchain

The project is configured to use Java 17 automatically via Gradle's toolchain feature. Verify it works:

```bash
cd packages/jetbrains
./gradlew --version
```

You should see Gradle 8.10.2 and it will use Java 17 for compilation even if your JAVA_HOME points to a different version.

### Step 4: Build the Plugin

```bash
cd packages/jetbrains
./gradlew buildPlugin
```

If you get an error like `25.0.1` or `java.lang.IllegalArgumentException`, see the **Troubleshooting** section below.

### Step 5: Test in Sandbox

```bash
./gradlew runIde
```

This launches a sandbox WebStorm instance with the plugin pre-installed.

## Development Workflow

### Making Changes

1. Edit Kotlin files in `src/main/kotlin/`
2. Rebuild: `./gradlew buildPlugin`
3. Test: `./gradlew runIde`
4. The sandbox IDE will launch with your changes

### Debugging

**Option 1: Using IntelliJ IDEA**
1. Open `packages/jetbrains` as a project in IntelliJ IDEA
2. Import the Gradle project when prompted
3. Set breakpoints in Kotlin source files
4. Use Gradle tool window: `Tasks → intellij → runIde`
5. Right-click on `runIde` → Debug
6. The sandbox IDE will start, and breakpoints will be hit

**Option 2: Using Command Line**
```bash
./gradlew runIde --debug-jvm
```

Then attach your IDE's debugger to port 5005.

### Hot Reload

The Gradle IntelliJ Plugin doesn't support hot reload. You need to:
1. Stop the sandbox IDE
2. Rebuild: `./gradlew buildPlugin`
3. Restart: `./gradlew runIde`

## Troubleshooting

### Build Errors

**Error: `25.0.1` or `java.lang.IllegalArgumentException`**

This means you're using Java 25, which isn't supported yet. Install JDK 17:

```bash
# macOS
brew install --cask temurin17

# Verify both versions are installed
/usr/libexec/java_home -V

# You should see both Java 17 and Java 25
# The project will automatically use Java 17 via toolchain
```

After installing JDK 17:
```bash
# Clear Gradle cache
./gradlew clean --no-daemon
rm -rf ~/.gradle/daemon

# Rebuild
./gradlew buildPlugin
```

**Error: "Language server not found"**

The plugin copies files from `packages/language-server/dist` and `packages/vscode/dist`. If these don't exist:

```bash
# From repository root
pnpm install
pnpm build

# Verify dist folders exist
ls -la packages/language-server/dist
ls -la packages/vscode/dist

# Try plugin build again
cd packages/jetbrains
./gradlew clean buildPlugin
```

**Error: "Could not find or load main class org.gradle.wrapper.GradleWrapperMain"**

The Gradle wrapper JAR is missing. Download it:

```bash
cd packages/jetbrains
curl -L https://raw.githubusercontent.com/gradle/gradle/v8.10.2/gradle/wrapper/gradle-wrapper.jar -o gradle/wrapper/gradle-wrapper.jar
chmod +x gradlew
./gradlew --version
```

### Runtime Issues

1. **"Node.js not found"**
   - Ensure Node.js is in PATH: `which node`
   - Or configure path in Settings → Tools → Web Components Language Server

2. **MCP Server won't start**
   - Check if port is in use: `lsof -i :3000` (macOS/Linux)
   - Change port in Settings
   - Verify Node.js is accessible
   - Check IDE logs: `Help → Show Log in Finder/Explorer`

3. **No autocomplete/diagnostics**
   - Verify `custom-elements.json` exists in your project
   - Check file type is supported (HTML, Vue, JSX, etc.)
   - Restart language server: `Tools → Restart Web Components Language Server`
   - Check IDE logs for errors

### Logs

Find logs at:
- **Mac**: `~/Library/Logs/JetBrains/WebStorm2023.2/idea.log`
- **Linux**: `~/.cache/JetBrains/WebStorm2023.2/log/idea.log`
- **Windows**: `%USERPROFILE%\AppData\Local\JetBrains\WebStorm2023.2\log\idea.log`

Or: `Help → Show Log in Finder/Explorer`

## Quick Reference Commands

```bash
# Setup (one-time)
brew install --cask temurin17        # Install JDK 17
cd ../../                             # Go to repo root
pnpm install && pnpm build           # Build language server

# Development
cd packages/jetbrains
./gradlew buildPlugin                # Build plugin
./gradlew runIde                     # Run in sandbox
./gradlew test                       # Run tests
./gradlew clean                      # Clean build

# Troubleshooting
./gradlew clean --no-daemon          # Clean rebuild
rm -rf ~/.gradle/daemon              # Remove Gradle daemon
/usr/libexec/java_home -V            # Check Java versions
```

## Next Steps

### Before Publishing

- [ ] Test with various web component libraries (Lit, Shoelace, etc.)
- [ ] Add integration tests
- [ ] Test on Windows, macOS, Linux
- [ ] Create plugin icon/logo
- [ ] Set up CI/CD for automated builds
- [ ] Create marketing screenshots
- [ ] Write comprehensive documentation

### Future Enhancements

- [ ] AI integration (if/when JetBrains adds LLM APIs)
- [ ] More granular file type support
- [ ] Performance optimizations
- [ ] Additional diagnostics
- [ ] Refactoring support

## Support Matrix

| IDE | Version | Status |
|-----|---------|--------|
| WebStorm | 2023.2+ | ✅ Supported |
| IntelliJ IDEA Ultimate | 2023.2+ | ✅ Supported (with JS plugin) |
| IntelliJ IDEA Community | 2023.2+ | ✅ Supported (with JS plugin) |
| PhpStorm | 2023.2+ | ✅ Should work |
| PyCharm Professional | 2023.2+ | ✅ Should work (with JS plugin) |

## Resources

- [IntelliJ Platform SDK](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [LSP Support in IntelliJ](https://plugins.jetbrains.com/docs/intellij/language-server-protocol.html)
- [Gradle IntelliJ Plugin](https://github.com/JetBrains/gradle-intellij-plugin)
- [Plugin Development Guidelines](https://plugins.jetbrains.com/docs/intellij/plugin-development-guidelines.html)
