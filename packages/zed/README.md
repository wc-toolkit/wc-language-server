# Web Components Language Server - Zed Extension

Editor tools for working with web components / custom elements in Zed IDE.

## Features

This extension provides:

- **IntelliSense** - Auto-completion for web component tags, attributes, properties, events, slots, and CSS parts
- **Hover Documentation** - View component documentation on hover
- **Go to Definition** - Navigate to component definitions
- **Diagnostics** - Validation for web component usage
- **Code Actions** - Quick fixes for common issues
- **Signature Help** - Parameter hints for component properties

## Installation

### From Zed Extensions

1. Open Zed
2. Press `cmd-shift-p` (Mac) or `ctrl-shift-p` (Windows/Linux)
3. Type "zed: extensions" and press Enter
4. Search for "Web Components"
5. Click Install

### Configuring Language Servers (Optional)

By default, Zed will run both the Web Components Language Server and the built-in HTML language server. This allows you to get web component features alongside standard HTML support.

If you prefer to use only the Web Components Language Server, add this to your Zed `settings.json`:

```json
{
  "languages": {
    "HTML": {
      "language_servers": ["web-components-language-server", "!vscode-html-language-server"]
    }
  }
}
```

Or to run both servers simultaneously (recommended):

```json
{
  "languages": {
    "HTML": {
      "language_servers": ["web-components-language-server", "vscode-html-language-server"]
    }
  }
}
```

**Note:** Zed automatically merges results from multiple language servers, so you'll get the best of both worlds when running them together.

### Development Installation

1. Clone this repository
2. Open Zed
3. Press `cmd-shift-p` and run "zed: install dev extension"
4. Select the `packages/zed` directory

## Requirements

- Zed IDE v0.140.0 or higher
- Node.js 18.0.0 or higher (Zed includes its own Node.js runtime)

**Important:** After installing this extension, you must configure Zed to use it. See [Configuration](#configuration) below.

## Quick Start

1. Install the extension (see [Installation](#installation))
2. **Configure Zed settings** - Currently required, see [CONFIGURATION.md](./CONFIGURATION.md) for details
3. Open an HTML file with web components
4. Start coding!

**Note:** Due to current limitations in how Zed activates language servers from extensions, you need to manually configure the language server in your settings. See [CONFIGURATION.md](./CONFIGURATION.md) for the configuration needed.

## Configuration

The extension works automatically with projects that have:

- A `custom-elements.json` file (Custom Elements Manifest)
- A `wc.config.js` configuration file
- Web component libraries in `node_modules`

### Custom Elements Manifest

The language server reads component documentation from `custom-elements.json` files. Many popular web component libraries include this file:

- Shoelace
- Lion
- Material Web Components
- Fast
- And many more...

You can also generate your own manifest using tools like:
- [@custom-elements-manifest/analyzer](https://www.npmjs.com/package/@custom-elements-manifest/analyzer)
- [Web Component Analyzer](https://www.npmjs.com/package/web-component-analyzer)

### Configuration File

Create a `wc.config.js` file in your project root to customize behavior:

```javascript
export default {
  // Paths to custom-elements.json files
  manifests: [
    './custom-elements.json',
    './node_modules/@shoelace-style/shoelace/dist/custom-elements.json'
  ],
  
  // Enable/disable features
  features: {
    diagnostics: true,
    hover: true,
    completion: true,
    definition: true
  }
};
```

## Supported Languages

The extension provides web component support in:

- HTML
- JavaScript (JSX)
- TypeScript (TSX)
- Vue
- Svelte
- Astro
- MDX
- PHP
- Twig
- CSS/SCSS

## Usage

### Auto-completion

Type `<` to see available web components:

```html
<sl-button>Click me</sl-button>
```

After typing a component name, auto-complete attributes:

```html
<sl-button variant="primary" size="large">
```

### Hover Documentation

Hover over any web component tag or attribute to see documentation:

```html
<sl-button>
  <!-- Hover over 'sl-button' to see component docs -->
</sl-button>
```

### Go to Definition

Hold `cmd` (Mac) or `ctrl` (Windows/Linux) and click on a component tag to jump to its definition in the Custom Elements Manifest.

## Troubleshooting

### Language Server Not Found

If you see errors about the language server not being found:

1. Ensure you've built the language server:
   ```bash
   cd /path/to/wc-language-server2
   pnpm run build:ls
   ```

2. Verify the file exists:
   ```bash
   ls packages/language-server/bin/wc-language-server.js
   ```

3. Restart Zed
4. Run `zed --foreground` to see detailed logs

### No Component Completions

If you're not seeing web component completions:

1. Ensure you have a `custom-elements.json` file in your project
2. Check that the file is properly formatted
3. Create a `wc.config.js` to specify manifest locations
4. Restart the language server

### Checking Logs

To see language server logs:

1. Run Zed from the terminal: `zed --foreground`
2. Check the console output for language server messages

## Development

### Building the Extension

```bash
cd packages/zed
cargo build --release
```

### Installing Dependencies

```bash
pnpm install
```

### Running Tests

```bash
cargo test
```

## Related Projects

- [Web Components Language Server](../language-server) - The core language server
- [VS Code Extension](../vscode) - VS Code version of this extension
- [wctools](../wctools) - CLI tools for web components

## License

MIT - See LICENSE file for details

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Links

- [GitHub Repository](https://github.com/wc-toolkit/wc-language-server)
- [Report Issues](https://github.com/wc-toolkit/wc-language-server/issues)
- [Documentation](https://github.com/wc-toolkit/wc-language-server#readme)
