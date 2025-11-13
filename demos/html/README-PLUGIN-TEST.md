# Testing the JetBrains Plugin

## Quick Start

1. **Open this folder (`demos/html`) in WebStorm** via the plugin's test instance
2. The plugin should automatically detect the language server from the parent workspace
3. Open any `.html`, `.js`, or `.ts` file
4. Try typing `<sl-` to see autocomplete for Shoelace components

## What to Test

- **Autocomplete**: Type `<sl-button` and see if it suggests Shoelace components
- **Hover**: Hover over `<sl-button>` to see documentation
- **Validation**: The plugin should validate custom element usage

## Troubleshooting

If the language server doesn't start:
- Check **Help → Show Log** for errors
- Run **Tools → Restart Web Components Language Server**
- Verify the language server exists at `../../packages/language-server/bin/wc-language-server.js`
