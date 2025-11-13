# Changelog

All notable changes to the Web Components Language Server JetBrains plugin will be documented in this file.

## [0.0.23] - 2025-11-13

### Added
- Initial JetBrains plugin release
- Language Server Protocol (LSP) integration with existing Node.js language server
- Automatic language server process management
- Configuration file watching (wc.config.js, custom-elements.json, package.json)
- Settings panel for plugin configuration
- MCP server support settings (similar to VS Code extension)
- Actions menu integration:
  - Restart Language Server
  - Check Loaded Documentation
- Auto-restart on configuration changes
- Project-level service architecture

### Supported IDEs
- IntelliJ IDEA 2023.2+
- WebStorm 2023.2+
- PhpStorm 2023.2+
- PyCharm 2023.2+
- Other JetBrains IDEs with JavaScript support

### Known Limitations
- Full LSP feature integration in progress
- MCP server implementation pending
- AI assistant integration pending

## [Unreleased]

### Planned
- Complete LSP feature implementation (autocomplete, hover, diagnostics)
- Custom Elements Manifest documentation display
- AI assistant integration
- Inline code actions
- Quick fixes for common issues
- Enhanced error reporting
