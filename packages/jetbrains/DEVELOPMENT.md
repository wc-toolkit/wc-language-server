# JetBrains Plugin Development Guide

Complete guide for developing, testing, building, and deploying the Web Components Language Server plugin for JetBrains IDEs.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setting Up Your Development Environment](#setting-up-your-development-environment)
- [Project Structure](#project-structure)
- [Building the Plugin](#building-the-plugin)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Debugging](#debugging)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Development Workflow](#development-workflow)

## Prerequisites

### Required Software

**JDK 17 or 21** (NOT Java 25)
- The Kotlin compiler and IntelliJ Gradle plugin don't support Java 25 yet
- Recommended: JDK 17 for maximum compatibility

**Node.js 16+**
- Required to run the language server
- Check version: `node --version`

**Gradle 8.10.2+**
- Included via wrapper (`./gradlew`)
- No separate installation needed

### Recommended Software

**IntelliJ IDEA** (any edition)
- Best IDE for developing JetBrains plugins
- Provides built-in Gradle support and Kotlin development tools

**Git**
- For version control and contributing

## Setting Up Your Development Environment

### Step 1: Install JDK 17

If you have Java 25 or another incompatible version, install JDK 17:

**macOS (Homebrew):**
```bash
brew install --cask temurin17
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install openjdk-17-jdk
```

**Linux (Fedora):**
```bash
sudo dnf install java-17-openjdk-devel
```

**Windows:**
Download from [Adoptium](https://adoptium.net/temurin/releases/?version=17)

**Verify installation:**
```bash
# macOS - list all installed Java versions
/usr/libexec/java_home -V

# All platforms - check default version
java -version
```

The project uses Gradle's Java toolchain feature, so it will automatically use JDK 17 for compilation even if your `JAVA_HOME` points to a different version.

### Step 2: Clone the Repository

```bash
git clone https://github.com/wc-toolkit/wc-language-server.git
cd wc-language-server
```

### Step 3: Build the Language Server

The JetBrains plugin depends on the compiled language server files. Build them first:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

This creates:
- `packages/language-server/dist/` - Language server executable and dependencies
- `packages/vscode/dist/` - MCP server and shared utilities

### Step 4: Verify the Setup

```bash
cd packages/jetbrains

# Check Gradle works and uses correct Java version
./gradlew --version

# You should see:
# - Gradle 8.10.2
# - JVM: 17.x.x (or 21.x.x)
```

### Step 5: Open in IntelliJ IDEA (Optional but Recommended)

1. Open IntelliJ IDEA
2. `File → Open`
3. Select `packages/jetbrains/build.gradle.kts`
4. Choose "Open as Project"
5. Wait for Gradle sync to complete

## Project Structure

```
packages/jetbrains/
├── build.gradle.kts                    # Gradle build configuration
├── settings.gradle.kts                 # Gradle project settings
├── gradle.properties                   # Plugin metadata and properties
├── package.json                        # NPM convenience scripts
├── README.md                           # User-facing documentation
├── DEVELOPMENT.md                      # This file
├── TESTING.md                          # Testing guide
├── CHANGELOG.md                        # Version history
├── LICENSE                             # MIT License
│
├── gradle/wrapper/                     # Gradle wrapper files
│   ├── gradle-wrapper.jar
│   └── gradle-wrapper.properties
│
├── src/main/
│   ├── kotlin/com/wctoolkit/webcomponents/
│   │   ├── WCLanguageServerProvider.kt       # LSP integration (main entry point)
│   │   ├── WCLanguageServerService.kt        # Language server lifecycle
│   │   ├── WCFileWatcherService.kt           # Config file watchers
│   │   ├── WCProjectListener.kt              # Project open/close events
│   │   │
│   │   ├── settings/
│   │   │   ├── WCSettings.kt                 # Persistent settings state
│   │   │   └── WCSettingsConfigurable.kt     # Settings UI panel
│   │   │
│   │   ├── actions/
│   │   │   ├── RestartLanguageServerAction.kt  # Manual restart action
│   │   │   └── CheckMCPStatusAction.kt         # MCP health check
│   │   │
│   │   └── mcp/
│   │       └── MCPServerService.kt           # MCP server management
│   │
│   └── resources/
│       └── META-INF/
│           └── plugin.xml                    # Plugin descriptor
│
└── build/                                    # Generated files (gitignored)
    ├── distributions/                        # Built plugin ZIP
    ├── idea-sandbox/                         # Sandbox IDE for testing
    └── ...
```

### Key Files Explained

**build.gradle.kts**
- Gradle build configuration
- Dependencies (IntelliJ Platform, Kotlin stdlib)
- Plugin version synced from `package.json`
- Build target: IntelliJ 2024.2+ (build 242-243.*)

**plugin.xml**
- Plugin metadata (ID, name, description, vendor)
- Extension points (LSP provider, settings, actions)
- Dependencies (IntelliJ platform, JavaScript plugin)

**WCLanguageServerProvider.kt**
- Implements IntelliJ's LSP framework
- Starts/stops the language server process
- Handles file open events

**WCLanguageServerService.kt**
- Manages language server lifecycle
- Node.js process execution
- Server state tracking

## Building the Plugin

### Build Plugin ZIP

```bash
cd packages/jetbrains
pnpm build
```

Output: `build/distributions/wc-language-server-jetbrains-<version>.zip`

This ZIP file can be:
- Installed manually in any JetBrains IDE
- Uploaded to the JetBrains Marketplace
- Distributed to users for testing

### Clean Build

```bash
./gradlew clean buildPlugin
```

### Verify Plugin

Check for common issues before publishing:

```bash
./gradlew verifyPlugin
```

This validates:
- Plugin descriptor (`plugin.xml`)
- API compatibility
- Binary compatibility
- Missing dependencies

## Running Locally

### Method 1: Gradle runIde (Recommended)

Launch a sandbox IDE with the plugin pre-installed:

```bash
cd packages/jetbrains
pnpm dev
```

This will:
- Build the plugin
- Download the target IDE version (WebStorm 2024.2)
- Create an isolated sandbox environment
- Launch the IDE with your plugin enabled

**First run:** Downloads ~500MB of IDE files (cached for future runs)

### Method 2: Manual Installation

Build and install the plugin manually:

```bash
# 1. Build the plugin
pnpm build

# 2. Open your regular WebStorm/IntelliJ IDEA
# 3. Go to Settings → Plugins → ⚙️ → Install Plugin from Disk
# 4. Select: build/distributions/wc-language-server-jetbrains-<version>.zip
# 5. Restart the IDE
```

**Note:** Manual installation affects your regular IDE settings. Use `runIde` for safer development.

### Testing the Plugin

Once the IDE launches:

1. **Open a demo project:**
   - `File → Open`
   - Navigate to `demos/html` in the repository
   
2. **Open `test.html`**

3. **Test features:**
   - Type `<sl-` and press `Ctrl+Space` (autocomplete)
   - Hover over `sl-button` (documentation)
   - Add an invalid attribute (diagnostics)

4. **Check settings:**
   - `Settings → Tools → Web Components Language Server`
   - Verify Node.js path is detected
   - Enable MCP server and test status check

## Testing

### Run All Tests

```bash
./gradlew test
```

Currently, the plugin has minimal automated tests. Testing is primarily manual (see [TESTING.md](TESTING.md)).

### Integration Testing

Test with real web component libraries:

**Shoelace:**
```bash
# In sandbox IDE: File → Open
# Open demos/html
# Test Shoelace components in test.html
```

**Custom project:**
```bash
# Create a new project with web components
npm install @shoelace-style/shoelace

# Add to HTML:
# <sl-button>Test</sl-button>

# Test autocomplete, hover, validation
```

## Debugging

### Option 1: Debug from IntelliJ IDEA

1. **Open the plugin project:**
   - `File → Open → packages/jetbrains/build.gradle.kts`

2. **Set breakpoints:**
   - Open any `.kt` file (e.g., `WCLanguageServerProvider.kt`)
   - Click in the gutter to add a breakpoint

3. **Start debugging:**
   - Open Gradle tool window (right sidebar)
   - Navigate: `Tasks → intellij → runIde`
   - Right-click `runIde` → **Debug**

4. **Trigger breakpoints:**
   - The sandbox IDE will launch
   - Open a file with web components
   - Breakpoints will be hit when the code executes

### Option 2: Remote Debugging

```bash
# Start with debug port open
./gradlew runIde --debug-jvm
```

Then attach your IDE's debugger to `localhost:5005`.

### Debug Output

View logs in the sandbox IDE:
- **Mac:** `Help → Show Log in Finder`
- **Linux:** `Help → Show Log in Files`
- **Windows:** `Help → Show Log in Explorer`

Look for lines containing `WC Language Server` or exceptions.

## Deployment

### Versioning

The plugin version is automatically synced from `package.json`:

```json
{
  "version": "0.1.0"
}
```

The build.gradle.kts reads this and sets the plugin version accordingly.

### Publishing to JetBrains Marketplace

#### Automated Publishing (via GitHub Actions)

The repository uses GitHub Actions for automated publishing:

**Workflow:** `.github/workflows/publish.yml`

**When it runs:**
- On push to `main` branch
- When Changesets publishes a new version

**What it does:**
1. Builds the language server packages
2. Builds the JetBrains plugin
3. Publishes to JetBrains Marketplace (if version changed)

**Required secrets:**
- `JETBRAINS_PUBLISH_TOKEN` - JetBrains Marketplace token

**Get your token:**
1. Go to https://plugins.jetbrains.com/author/me/tokens
2. Create a new token with "Upload plugin" scope
3. Add to GitHub: Repository Settings → Secrets → Actions → New secret

#### Manual Publishing

```bash
# Set your publish token
export PUBLISH_TOKEN="perm:your-token-here"

# Publish
./gradlew publishPlugin
```

**First time setup:**
1. Create account at https://plugins.jetbrains.com/
2. Generate token at https://plugins.jetbrains.com/author/me/tokens
3. Add token to environment or `gradle.properties`:
   ```properties
   jetbrains.publishToken=perm:your-token-here
   ```

### Release Checklist

Before publishing a new version:

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with new features/fixes
- [ ] Run `pnpm verify` (no errors)
- [ ] Test in sandbox IDE (`pnpm dev`)
- [ ] Test with multiple component libraries (Shoelace, Lit, etc.)
- [ ] Update README.md if features changed
- [ ] Commit and push changes
- [ ] Create GitHub release with tag matching version
- [ ] Verify automated publishing succeeds

## Troubleshooting

### Build Errors

**Error: `25.0.1` or `java.lang.IllegalArgumentException`**

You're using Java 25. Install JDK 17:

```bash
# macOS
brew install --cask temurin17

# Verify both versions exist
/usr/libexec/java_home -V

# Clean and rebuild
./gradlew clean --no-daemon
rm -rf ~/.gradle/daemon
pnpm build
```

The project uses Gradle's toolchain to automatically select JDK 17.

**Error: "Language server not found" during build**

The plugin copies files from `packages/language-server/dist`. Build the language server first:

```bash
# From repository root
pnpm install
pnpm build

# Verify dist folders exist
ls -la packages/language-server/dist
ls -la packages/vscode/dist

# Rebuild plugin
cd packages/jetbrains
pnpm build
```

**Error: "Could not find or load main class org.gradle.wrapper.GradleWrapperMain"**

Gradle wrapper JAR is missing:

```bash
cd packages/jetbrains
curl -L https://raw.githubusercontent.com/gradle/gradle/v8.10.2/gradle/wrapper/gradle-wrapper.jar \
  -o gradle/wrapper/gradle-wrapper.jar
chmod +x gradlew
./gradlew --version
```

### Runtime Issues

**Plugin won't load in sandbox IDE**

1. Check build output for errors: `pnpm build`
2. Verify `plugin.xml` is valid
3. Clean and rebuild: `pnpm clean && pnpm build`

**Language server won't start**

1. Verify Node.js is accessible:
   ```bash
   which node
   node --version  # Should be 16+
   ```

2. Check language server files exist:
   ```bash
   ls -la packages/language-server/dist
   ```

3. View IDE logs (in sandbox):
   - `Help → Show Log in Finder/Explorer`
   - Look for errors containing "WC Language Server"

**No autocomplete/diagnostics**

1. Ensure `custom-elements.json` exists in your test project
2. Check file type is supported (HTML, Vue, JSX, etc.)
3. Manually restart: `Tools → Restart Web Components Language Server`
4. Enable debug logging in IDE

**MCP Server won't start**

1. Check if port is already in use:
   ```bash
   # macOS/Linux
   lsof -i :3000
   
   # Windows
   netstat -ano | findstr :3000
   ```

2. Try a different port in settings
3. Check IDE Event Log for MCP-related errors

### IDE-Specific Issues

**WebStorm vs IntelliJ IDEA**

The plugin works in both, but:
- **WebStorm:** JavaScript plugin is built-in ✅
- **IntelliJ IDEA:** Must install JavaScript plugin manually

**Compatibility testing:**

Test on different IDE versions:
```bash
# Test on specific version
./gradlew runIde -PideaVersion=2024.2

# Test on latest EAP
./gradlew runIde -PideaVersion=2024.3-EAP-SNAPSHOT
```

## Development Workflow

### Making Changes

1. **Make code changes** in `src/main/kotlin/` or `src/main/resources/`

2. **Rebuild:**
   ```bash
   pnpm build
   ```

3. **Test in sandbox:**
   ```bash
   pnpm dev
   ```

4. **Iterate** - no hot reload, must restart sandbox IDE

### Adding a New Feature

Example: Add a new settings option

1. **Update `WCSettings.kt`:**
   ```kotlin
   @State(name = "WCSettings", storages = [Storage("wc-language-server.xml")])
   class WCSettings : PersistentStateComponent<WCSettings> {
       var myNewSetting: Boolean = false  // Add field
       // ...
   }
   ```

2. **Update `WCSettingsConfigurable.kt`:**
   ```kotlin
   class WCSettingsConfigurable : Configurable {
       private val myNewSettingCheckbox = JBCheckBox("Enable My Feature")
       
       override fun createComponent(): JComponent {
           // Add to UI
       }
       
       override fun apply() {
           settings.myNewSetting = myNewSettingCheckbox.isSelected
       }
   }
   ```

3. **Use the setting:**
   ```kotlin
   val settings = WCSettings.getInstance()
   if (settings.myNewSetting) {
       // Feature logic
   }
   ```

4. **Test:** `pnpm dev`

### Common Development Tasks

**Update IntelliJ Platform version:**

Edit `build.gradle.kts`:
```kotlin
intellij {
    version.set("2024.3")  // Change version
    // Update build range too
}
```

**Update Kotlin version:**

Edit `build.gradle.kts`:
```kotlin
kotlin("jvm") version "2.0.21"  // Change version
```

**Add a dependency:**

Edit `build.gradle.kts`:
```kotlin
dependencies {
    implementation("com.example:library:1.0.0")
}
```

**Add a new action:**

1. Create `src/main/kotlin/com/wctoolkit/webcomponents/actions/MyAction.kt`
2. Register in `plugin.xml`:
   ```xml
   <actions>
     <action id="wc.MyAction" 
             class="com.wctoolkit.webcomponents.actions.MyAction"
             text="My Action"
             description="Does something useful">
       <add-to-group group-id="ToolsMenu" anchor="last"/>
     </action>
   </actions>
   ```

## Quick Reference

```bash
# Setup (one-time)
brew install --cask temurin17           # Install JDK 17 (macOS)
cd /path/to/wc-language-server
pnpm install && pnpm build              # Build language server

# Development
cd packages/jetbrains
./gradlew buildPlugin                   # Build plugin ZIP
./gradlew runIde                        # Run in sandbox
./gradlew test                          # Run tests
./gradlew verifyPlugin                  # Verify before publishing
./gradlew clean                         # Clean build artifacts

# Debugging
./gradlew runIde --debug-jvm            # Remote debug on port 5005
./gradlew runIde -PideaVersion=2024.3   # Test different IDE version

# Publishing
export PUBLISH_TOKEN="perm:xxx"
./gradlew publishPlugin                 # Publish to marketplace

# Troubleshooting
./gradlew clean --no-daemon             # Clean rebuild
rm -rf ~/.gradle/daemon                 # Clear Gradle daemon
/usr/libexec/java_home -V               # Check Java versions (macOS)
```

## Resources

- [IntelliJ Platform SDK](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [LSP Support Documentation](https://plugins.jetbrains.com/docs/intellij/language-server-protocol.html)
- [Gradle IntelliJ Plugin](https://github.com/JetBrains/gradle-intellij-plugin)
- [Kotlin Language](https://kotlinlang.org/docs/home.html)
- [JetBrains Marketplace](https://plugins.jetbrains.com/)

## Contributing

See the main repository [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## Support

- **Issues:** https://github.com/wc-toolkit/wc-language-server/issues
- **Discussions:** https://github.com/wc-toolkit/wc-language-server/discussions

## Support

- **Issues:** https://github.com/wc-toolkit/wc-language-server/issues
- **Discussions:** https://github.com/wc-toolkit/wc-language-server/discussions
