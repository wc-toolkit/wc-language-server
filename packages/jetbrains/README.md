# Web Components Language Server - JetBrains Plugin

JetBrains IDE plugin for working with web components and custom elements. Provides autocomplete, hover documentation, validation, and more for projects using web components.

## Features

- 🔍 **Autocomplete** for web component attributes, properties, events, and slots
- 📖 **Hover Documentation** showing component details from Custom Elements Manifest
- ✅ **Validation** for web component usage
- 🎨 **CSS Support** for CSS custom properties and parts
- 🔄 **Auto-restart** when configuration files change
- 🤖 **MCP Server** integration for AI agents (optional)

## Installation

### From JetBrains Marketplace (Coming Soon)

1. Open your JetBrains IDE (IntelliJ IDEA, WebStorm, PhpStorm, etc.)
2. Go to **Settings/Preferences → Plugins**
3. Search for "Web Components Language Server"
4. Click **Install**

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/wc-toolkit/wc-language-server.git
   cd wc-language-server/packages/jetbrains
   ```

2. Build the plugin:
   ```bash
   ./gradlew buildPlugin
   ```

3. Install the plugin:
   - The plugin will be in `build/distributions/web-components-intellij-*.zip`
   - In your IDE: **Settings/Preferences → Plugins → ⚙️ → Install Plugin from Disk**
   - Select the `.zip` file

## Requirements

- **JetBrains IDE** 2023.2 or later (IntelliJ IDEA, WebStorm, PhpStorm, etc.)
- **Node.js** installed on your system
- **Web Components Language Server** must be accessible:
  - Install globally: `npm install -g @wc-toolkit/language-server`
  - Or have it in your project: `npm install --save-dev @wc-toolkit/language-server`

## Configuration

### Language Server

The plugin will automatically search for the language server in these locations:
1. Project's `node_modules/.bin/wc-language-server`
2. Project's `packages/language-server/bin/wc-language-server.js` (monorepo)
3. Global npm installation
4. User's npm global directory

### Settings

Access plugin settings via: **Settings/Preferences → Tools → Web Components**

Available options:
- **MCP Server** - Enable/disable MCP server for AI integration
- **MCP Transport** - Choose between HTTP or stdio
- **MCP Port** - Port for HTTP mode (default: 3000)
- **MCP Host** - Host address (default: localhost)
- **Auto-restart** - Automatically restart language server on config changes
- **Show Diagnostics** - Display validation errors and warnings

## Usage

### Project Configuration

Create a `wc.config.js` file in your project root:

```javascript
module.exports = {
  packages: [
    {
      name: '@shoelace-style/shoelace',
      manifests: ['./node_modules/@shoelace-style/shoelace/dist/custom-elements.json']
    }
  ]
};
```

### Custom Elements Manifest

The plugin uses the [Custom Elements Manifest](https://custom-elements-manifest.open-wc.org/) format to provide component information. Make sure your web components have a `custom-elements.json` file.

### Actions

Available actions in **Tools** menu:
- **Restart Web Components Language Server** - Manually restart the language server
- **Check Web Component Documentation** - View loaded component documentation

## Development

### Building

```bash
./gradlew buildPlugin
```

### Running in Development Mode

```bash
./gradlew runIde
```

This will launch a new IDE instance with the plugin installed.

### Running Tests

```bash
./gradlew test
```

## Architecture

The plugin consists of several key components:

- **WCLanguageServerService** - Manages the Node.js language server process
- **WCLanguageClient** - LSP4J client implementation
- **ConfigWatcherService** - Watches for config file changes
- **ManifestLoaderService** - Loads web component documentation
- **WCToolsSettings** - Persistent plugin settings

## Troubleshooting

### Language Server Not Starting

1. Verify Node.js is installed: `node --version`
2. Check language server installation: `which wc-language-server`
3. Look at IDE logs: **Help → Show Log in Finder/Explorer**

### No Autocomplete

1. Make sure you have a `wc.config.js` or `custom-elements.json` in your project
2. Restart the language server: **Tools → Restart Web Components Language Server**
3. Check loaded documentation: **Tools → Check Web Component Documentation**

### File Watching Issues

If auto-restart isn't working:
1. Check that **Auto-restart** is enabled in settings
2. Manually restart after config changes

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [@wc-toolkit/language-server](../language-server) - The core language server
- [@wc-toolkit/vscode](../vscode) - VS Code extension
- [@wc-toolkit/wctools](../wctools) - CLI tools

## Links

- [GitHub Repository](https://github.com/wc-toolkit/wc-language-server)
- [JetBrains Marketplace](https://plugins.jetbrains.com/) (coming soon)
- [Documentation](https://github.com/wc-toolkit/wc-language-server#readme)
- [Issue Tracker](https://github.com/wc-toolkit/wc-language-server/issues)
