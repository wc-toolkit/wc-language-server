# Quick Start Guide - Testing the JetBrains Plugin Locally

This guide will help you test the Web Components Language Server plugin in WebStorm.

## Prerequisites

1. **Install JDK 17 or higher**
   ```bash
   # Check your Java version
   java -version
   ```

2. **Build the language server**
   ```bash
   # From the repository root
   pnpm install
   pnpm build
   ```

## Option 1: Run Plugin in Sandbox (Recommended)

This is the fastest way to test the plugin during development.

### Steps

1. **Navigate to the plugin directory**
   ```bash
   cd packages/jetbrains
   ```

2. **Run the plugin in a sandbox IDE**
   ```bash
   ./gradlew runIde
   ```
   
   On Windows:
   ```bash
   gradlew.bat runIde
   ```

3. **Wait for WebStorm to start**
   - A new WebStorm window will open with the plugin pre-installed
   - This is a completely separate sandbox environment

4. **Open a demo project**
   - In the sandbox WebStorm: `File → Open`
   - Navigate to `[repository]/demos/html`
   - Click `Open`

5. **Test the features**
   - Open `test.html`
   - Type `<sl-` and press `Ctrl+Space` (or `Cmd+Space` on Mac)
   - You should see autocomplete suggestions for Shoelace components
   - Hover over `<sl-button>` to see documentation
   - Try adding an invalid attribute to see diagnostics

### Testing MCP Server

1. In the sandbox WebStorm: `Settings → Tools → Web Components Language Server`
2. Check `Enable MCP Server`
3. Click `Apply` and `OK`
4. Go to `Tools → Check Web Components MCP Server Status`
5. Should show the server is running with component count

## Option 2: Install from Disk

If you want to install the plugin in your regular WebStorm installation:

### Steps

1. **Build the plugin**
   ```bash
   cd packages/jetbrains
   ./gradlew buildPlugin
   ```

2. **Locate the built plugin**
   - The plugin ZIP will be at: `build/distributions/wc-language-server-jetbrains-0.0.1.zip`

3. **Install in WebStorm**
   - Open WebStorm
   - Go to `Settings → Plugins`
   - Click the gear icon ⚙️
   - Select `Install Plugin from Disk...`
   - Navigate to the ZIP file and select it
   - Click `OK`

4. **Restart WebStorm**

5. **Open a test project**
   - Open `demos/html` or `demos/npm` from this repository
   - Or open any project with web components

## Verifying Installation

### Check Plugin is Loaded

1. Go to `Settings → Plugins`
2. Search for "Web Components"
3. You should see "Web Components Language Server" as installed

### Check Language Server

1. Open an HTML file with custom elements
2. The language server should start automatically
3. Check the IDE logs: `Help → Show Log in Finder/Explorer`
4. Look for: `Web Components Language Server Service initialized`

### Test Features

**Autocomplete:**
```html
<!-- Type this and trigger autocomplete -->
<sl-
```

**Hover:**
```html
<!-- Hover over this to see docs -->
<sl-button variant="primary">Click me</sl-button>
```

**Diagnostics:**
```html
<!-- This should show an error for unknown attribute -->
<sl-button invalid-attribute="test">Button</sl-button>
```

## Debugging the Plugin

### In IntelliJ IDEA (Plugin Development)

1. **Open the plugin project**
   - Open `packages/jetbrains` in IntelliJ IDEA

2. **Set breakpoints**
   - Open any Kotlin file (e.g., `WCLanguageServerProvider.kt`)
   - Click in the gutter to set a breakpoint

3. **Run in Debug mode**
   ```bash
   ./gradlew runIde --debug-jvm
   ```
   
   Or use the IDE's Gradle tool window:
   - Open Gradle tool window
   - Navigate to `Tasks → intellij → runIde`
   - Right-click → Debug

4. **Attach debugger**
   - The sandbox WebStorm will start
   - Your breakpoints in IntelliJ IDEA will be hit when you use the features

## Troubleshooting

### "Node.js not found" Error

**Solution:**
1. Ensure Node.js is installed: `node --version`
2. Add Node.js to your PATH
3. Or configure the path manually in Settings

### Language Server Won't Start

**Check:**
1. Built the language server: `pnpm build` in repository root
2. The `dist` folder exists in `packages/language-server`
3. The `dist` folder exists in `packages/vscode`

**Rebuild everything:**
```bash
# From repository root
pnpm clean
pnpm install
pnpm build
```

### MCP Server Port Already in Use

**Solution:**
1. Change the port in Settings
2. Or stop the conflicting process:
   ```bash
   # Find process using port 3000
   lsof -i :3000  # Mac/Linux
   netstat -ano | findstr :3000  # Windows
   ```

### No Autocomplete/Diagnostics

**Verify:**
1. The file type is supported (HTML, Vue, JSX, etc.)
2. A `custom-elements.json` file exists in the project
3. The language server has started (check logs)

**Try:**
1. Restart the language server: `Tools → Restart Web Components Language Server`
2. Restart WebStorm
3. Rebuild the plugin: `./gradlew clean buildPlugin`

## Next Steps

- **Modify the code**: Edit Kotlin files and rerun `./gradlew runIde`
- **Add features**: Check the VS Code extension for reference
- **Test with real projects**: Try the plugin with your own web component projects
- **Report issues**: Open issues on GitHub if you find bugs

## Useful Commands

```bash
# Build the plugin
./gradlew buildPlugin

# Run in sandbox WebStorm
./gradlew runIde

# Run tests
./gradlew test

# Clean build artifacts
./gradlew clean

# Verify plugin
./gradlew verifyPlugin

# Build and run in one command
./gradlew clean buildPlugin runIde
```

## IDE Logs Location

**Mac:**
```
~/Library/Logs/JetBrains/WebStorm2023.2/idea.log
```

**Linux:**
```
~/.cache/JetBrains/WebStorm2023.2/log/idea.log
```

**Windows:**
```
%USERPROFILE%\AppData\Local\JetBrains\WebStorm2023.2\log\idea.log
```

Access via IDE: `Help → Show Log in Finder/Explorer`
