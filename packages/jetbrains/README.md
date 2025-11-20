# Web Components Language Server - JetBrains Plugin

Advanced editor support for working with Web Components and custom elements in WebStorm, IntelliJ IDEA, and other JetBrains IDEs.

## Features

- ✅ **HTML Diagnostics**: Advanced validation for custom elements and attributes
- ✅ **Type Validation**: Boolean, number, enum, and string attribute types
- ✅ **Deprecation Warnings**: Alerts for deprecated elements and attributes
- ✅ **Duplicate Detection**: Identifies duplicate attributes
- ✅ **Smart Autocomplete**: Intelligent completion for custom elements
- ✅ **Hover Documentation**: Rich documentation on hover
- ✅ **Go to Definition**: Navigate to component definitions
- ✅ **CSS Support**: Custom property autocomplete and validation
- ✅ **MCP Server**: Model Context Protocol server for AI agent integration
- ✅ **Auto-Restart**: Automatic language server restart on configuration changes

## Requirements

- **JetBrains IDE**: WebStorm 2023.2+ or IntelliJ IDEA 2023.2+ (with JavaScript plugin)
- **Node.js**: Version 16 or higher installed and available in PATH
- **Custom Elements Manifest**: A `custom-elements.json` file in your project

## Installation

### From JetBrains Marketplace (Recommended)

1. Open your JetBrains IDE (WebStorm/IntelliJ IDEA)
2. Go to `Settings/Preferences → Plugins`
3. Search for "Web Components Language Server"
4. Click `Install`
5. Restart the IDE

### From Source

1. Clone this repository
2. Navigate to `packages/jetbrains`
3. Run `./gradlew buildPlugin`
4. Install the plugin from disk: `Settings → Plugins → ⚙️ → Install Plugin from Disk`
5. Select `build/distributions/wc-language-server-jetbrains-*.zip`

## Configuration

### Basic Setup

The plugin works out of the box if Node.js is in your PATH. If not:

1. Go to `Settings → Tools → Web Components Language Server`
2. Set the Node.js path manually
3. Click `Apply`

### Web Components Configuration

Create a `wc.config.js` file in your project root:

```javascript
export default {
  // Optional: Override custom elements manifest path
  customElementsManifest: './custom-elements.json',
  
  // Optional: Configure diagnostic severity
  diagnostics: {
    unknownElement: 'warning',
    unknownAttribute: 'warning',
    deprecatedElement: 'error',
    deprecatedAttribute: 'warning',
    duplicateAttribute: 'error'
  }
};
```

### MCP Server Configuration

Enable the Model Context Protocol server for AI agent integration:

1. Go to `Settings → Tools → Web Components Language Server`
2. Check `Enable MCP Server`
3. Configure:
   - **Transport**: `http` (recommended) or `stdio`
   - **Port**: `3000` (default)
   - **Host**: `localhost` (default)
4. Click `Apply`

Check server status: `Tools → Check Web Components MCP Server Status`

## Development

### Prerequisites

- JDK 17 or higher
- Gradle 8.5+
- Built language server (`pnpm build` in repository root)

### Building the Plugin

```bash
cd packages/jetbrains
./gradlew buildPlugin
```

The plugin will be created at `build/distributions/wc-language-server-jetbrains-*.zip`

### Testing Locally in WebStorm

#### Option 1: Using Gradle (Recommended)

Run the plugin in a sandbox IDE instance:

```bash
./gradlew runIde
```

This will:
- Launch WebStorm with the plugin pre-installed
- Use a separate sandbox environment
- Enable live plugin development

#### Option 2: Manual Installation

1. Build the plugin: `./gradlew buildPlugin`
2. Open WebStorm
3. Go to `Settings → Plugins → ⚙️ → Install Plugin from Disk`
4. Select `build/distributions/wc-language-server-jetbrains-*.zip`
5. Restart WebStorm
6. Open a project with web components (e.g., `demos/html` from this repository)

### Running Tests

```bash
./gradlew test
```

### Debugging

1. In your development IDE (IntelliJ IDEA recommended):
   - Open `packages/jetbrains` as a project
   - Create a Gradle run configuration: `runIde`
   - Set breakpoints in Kotlin code
   - Run in Debug mode

2. In the sandbox WebStorm instance:
   - Open a project with web components
   - The language server will start automatically
   - Trigger features (autocomplete, hover, etc.) to hit breakpoints

### Project Structure

```
packages/jetbrains/
├── build.gradle.kts              # Gradle build configuration
├── settings.gradle.kts           # Gradle settings
├── gradle.properties             # Plugin properties
└── src/main/
    ├── kotlin/com/wctoolkit/webcomponents/
    │   ├── WCLanguageServerProvider.kt      # LSP integration
    │   ├── WCLanguageServerService.kt       # Server lifecycle
    │   ├── WCFileWatcherService.kt          # Config file watchers
    │   ├── WCProjectListener.kt             # Project events
    │   ├── settings/
    │   │   ├── WCSettings.kt                # Settings state
    │   │   └── WCSettingsConfigurable.kt    # Settings UI
    │   ├── actions/
    │   │   ├── RestartLanguageServerAction.kt
    │   │   └── CheckMCPStatusAction.kt
    │   └── mcp/
    │       └── MCPServerService.kt          # MCP server management
    └── resources/
        └── META-INF/
            └── plugin.xml                    # Plugin configuration
```

## Testing with Demo Projects

### HTML Demo

```bash
cd packages/jetbrains
./gradlew runIde
# In the sandbox WebStorm:
# File → Open → [repository]/demos/html
```

Test features:
- Open `test.html`
- Type `<sl-` and trigger autocomplete (Ctrl+Space)
- Hover over custom elements to see documentation
- Add invalid attributes to see diagnostics

### NPM Demo

```bash
# In the sandbox WebStorm:
# File → Open → [repository]/demos/npm
```

## Troubleshooting

### Language Server Not Starting

1. **Check Node.js**: Ensure Node.js is installed and in PATH
   ```bash
   node --version
   ```

2. **Check Settings**: Verify Node.js path in `Settings → Tools → Web Components Language Server`

3. **Check Logs**: View logs in `Help → Show Log in Finder/Explorer`

4. **Manual Restart**: `Tools → Restart Web Components Language Server`

### MCP Server Issues

1. **Port Already in Use**: Change the port in settings or stop the conflicting process
2. **Check Status**: Use `Tools → Check Web Components MCP Server Status`
3. **View Logs**: MCP server logs appear in the IDE's Event Log

### No Autocomplete/Hover

1. **Verify Manifest**: Ensure `custom-elements.json` exists in your project
2. **Check File Type**: Only works with HTML, Vue, JSX, and other supported file types
3. **Restart Server**: Use the restart action from Tools menu

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [GitHub Repository](https://github.com/wc-toolkit/wc-language-server)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=wc-toolkit.web-components-language-server)
- [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
- [Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
