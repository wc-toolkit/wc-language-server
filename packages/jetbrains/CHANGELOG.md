# Changelog

## 0.0.2

### Patch Changes

- 494950d: Fixed MCP server implementation

All notable changes to the Web Components Language Server JetBrains plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-11-20

### Added

- Initial release of JetBrains plugin for Web Components Language Server
- Language Server Protocol (LSP) integration for web components
- HTML diagnostics for custom elements and attributes
- Attribute type validation (boolean, number, enum, string)
- Deprecated element and attribute warnings
- Duplicate attribute detection
- Smart autocomplete for custom elements
- Hover documentation support
- Go-to-definition functionality
- CSS custom property support
- Configurable diagnostics severity
- Auto-restart on configuration file changes
- File watchers for `wc.config.js`, `custom-elements.json`, and `package.json`
- Model Context Protocol (MCP) server integration
- MCP server status checking
- Settings UI for Node.js path and MCP configuration
- Support for WebStorm 2023.2+
- Support for IntelliJ IDEA 2023.2+ (with JavaScript plugin)
