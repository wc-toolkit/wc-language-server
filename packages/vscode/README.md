# Web Components Language Server

> **NOTE:** This is currently in `alpha` and is experimental.

![Demonstration of the web components language server](https://wc-toolkit.com/_astro/vscode-wcls_demo.FCh4LrSK_17j3zC.webp)

This extension extension provides intelligent language support for building with Web Components. This extension enhances your development experience with advanced IntelliSense and validation for Web Components.

This extension uses the [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) to generate the necessary information for the component integration and validation.

## Features

### 🚀 Smart IntelliSense

- **Auto-completion** for Web Component properties, methods, and events
- **Type-aware suggestions** based on component definitions

### 🔍 Advanced Code Analysis

- **Real-time validation** of Web Component syntax and structure
- **Error detection** for common Web Component patterns

### 🔧 Code Navigation

- **Go to definition** for custom elements that will take you to the relevant position the in the Custom Elements Manifest

## Installation

### From VS Code Marketplace

1. Open Visual Studio Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Web Components Language Server"
4. Click "Install"

### Manual Installation

1. Download the `.vsix` file from the releases page
2. Open VS Code
3. Run `Extensions: Install from VSIX...` from the Command Palette
4. Select the downloaded file

## Usage

### IntelliSense in Action

```html
<!-- Get intelligent suggestions for custom elements -->
<my-custom-element my-attribute="value"></my-custom-element>
```

### Supported File Types

This plugin currently works with any file type, but additional configurations will be added to customize this experience in the future.

## Configuration

To configure the Web Components Language serve create a file named `wc.config.js` at the root of your workspace and export the configuration object.

```js
// wc.config.js
export default {
  // your config options here
};
```

### Available Settings

```ts
/** Configuration options for the Web Components Language Server. */
interface WCConfig {
  /** Optional function to format tag names before processing. */
  tagFormatter?: (tagName: string) => string;

  /** Diagnostic severity levels for various validation checks. */
  diagnosticSeverity?: {
    /** 
     * Severity for invalid boolean attribute values. 
     * @default "error" 
     */
    invalidBoolean?: DiagnosticSeverity;
    /** 
     * Severity for invalid number attribute values. 
     * @default "error" 
     */
    invalidNumber?: DiagnosticSeverity;
    /** 
     * Severity for invalid attribute values. 
     * @default "error" 
     */
    invalidAttributeValue?: DiagnosticSeverity;
    /** 
     * Severity for usage of deprecated attributes. 
     * @default "warning" 
     */
    deprecatedAttribute?: DiagnosticSeverity;
    /** 
     * Severity for usage of deprecated elements. 
     * @default "warning" 
     */
    deprecatedElement?: DiagnosticSeverity;
    /** 
     * Severity for usage of duplicate attributes. 
     * @default "error" 
     */
    duplicateAttribute?: DiagnosticSeverity;
  };
}
```

## Troubleshooting

### Common Issues

**Extension not working?**

- Ensure you have a supported file open
- Check that the extension is enabled in settings
- Restart VS Code if needed

**IntelliSense not appearing?**

- Try restarting the language server (`Ctrl/Cmd+Shift+P` > `Web Components: Restart Language Server`)
- Verify TypeScript/JavaScript language support is enabled
- Check if other extensions are conflicting

### Getting Help

- 📚 [Documentation](https://wc-toolkit.com/integrations/web-components-language-server/)
- 🐛 [Report Issues](https://github.com/wc-toolkit/wc-language-server/issues)

---

**Enjoy building with Web Components!** 🎉
