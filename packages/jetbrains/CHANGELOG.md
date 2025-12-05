# Changelog

## 0.0.8

### Patch Changes

- 0131c34: Added operating specific executables

## 0.0.7

### Patch Changes

- 935c0fa: Updated language server to compile to a single-file executable to remove node.js dependency

## 0.0.6

### Patch Changes

- 739346a: Updated build to include TypeScript dependencies

## 0.0.5

### Patch Changes

- 3ded7ed: Updated JetBrains icon

## 0.0.4

### Patch Changes

- f955de3: Fixed release pipeline

## 0.0.3

### Patch Changes

- f39dd09: Optimized server build to reduce plugin size and improve performance
- c982b80: Updated to include necessary TypeScript files

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
