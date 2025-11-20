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

- **JetBrains IDE**: WebStorm 2024.2+ or IntelliJ IDEA 2024.2+ (with JavaScript plugin)
- **Node.js**: Version 16 or higher installed and available in PATH
- **Custom Elements Manifest**: A `custom-elements.json` file in your project

## Installation

1. Open your JetBrains IDE (WebStorm, IntelliJ IDEA, etc.)
2. Go to `Settings/Preferences → Plugins`
3. Search for "Web Components Language Server"
4. Click `Install`
5. Restart the IDE

## Getting Started

Once installed, the plugin automatically provides enhanced editor support for projects using web components from popular libraries like [Shoelace](https://shoelace.style/), [Web Awesome](https://webawesome.com/), or any library that provides a Custom Elements Manifest.

### Quick Start

1. **Open your project** that uses web components
2. **Start coding** - autocomplete, hover documentation, and diagnostics work automatically

### Example

Open an HTML file and type:

```html
<sl-button variant="primary">Click me</sl-button>
```

You'll get:
- **Autocomplete**: Type `<sl-` and press `Ctrl+Space` to see all Shoelace components
- **Attribute suggestions**: Type `variant="` to see available options (`primary`, `success`, `neutral`, etc.)
- **Hover documentation**: Hover over `sl-button` to see component documentation
- **Validation**: Misspell an attribute to see helpful error messages

### Configuration (Optional)

The plugin works out of the box for most projects. If needed, customize settings at:

**Settings → Tools → Web Components Language Server**

**Node.js Path**  
Set manually if Node.js isn't in your system PATH.

**Custom Manifest Path**  
If your library's `custom-elements.json` is in a non-standard location, specify the path here. The plugin automatically searches:
- `node_modules/*/custom-elements.json`
- `custom-elements.json` (project root)
- Any path specified in your project's `package.json`

**MCP Server (Advanced)**  
Enable Model Context Protocol server for AI agent integration:
- Check `Enable MCP Server`
- Configure transport (`http` recommended), port (`3000`), and host (`localhost`)
- Check status: `Tools → Check Web Components MCP Server Status`

## Troubleshooting

## Troubleshooting

### No Autocomplete or Hover

**The component library may not provide a Custom Elements Manifest:**
- Check if `node_modules/[library-name]/custom-elements.json` exists
- Verify your library supports the [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) format
- Try manually restarting: `Tools → Restart Web Components Language Server`

**Multiple libraries installed:**
- The plugin automatically discovers manifests from all installed libraries
- If a specific library isn't working, check its `custom-elements.json` format

### Language Server Not Starting

1. Ensure Node.js is installed: `node --version` (requires version 16+)
2. Check Node.js path in `Settings → Tools → Web Components Language Server`
3. View detailed logs: `Help → Show Log in Finder/Explorer`
4. Manual restart: `Tools → Restart Web Components Language Server`

### MCP Server Issues

1. **Port already in use**: Change the port in settings or stop the conflicting process
2. **Check status**: `Tools → Check Web Components MCP Server Status`
3. **View logs**: Check the IDE's Event Log for error messages

## Development

Want to contribute or build the plugin yourself? See [DEVELOPMENT.md](DEVELOPMENT.md) for complete development documentation.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [GitHub Repository](https://github.com/wc-toolkit/wc-language-server)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=wc-toolkit.web-components-language-server)
- [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
- [Report Issues](https://github.com/wc-toolkit/wc-language-server/issues)
