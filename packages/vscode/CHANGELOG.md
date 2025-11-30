# web-components-language-server

## 0.0.32

### Patch Changes

- f39dd09: Optimized server build to reduce plugin size and improve performance
- c982b80: Updated to include necessary TypeScript files

## 0.0.30

### Patch Changes

- fb7755e: Fixed autocomplete for tags with `_` and `.` in them

## 0.0.29

### Patch Changes

- 4a65f65: Fixed validation timing for async manifests

## 0.0.28

### Patch Changes

- 6b81e8f: Fixed tag completions

## 0.0.27

### Patch Changes

- c4ddd1a: Added component cache independant of autocomplete data
- a066f8f: Separated component cache from autocomplete cache
- a066f8f: Lazy-load autocomplete cache to prevent conflicts in CLI tools and non-vscode environments
- c4ddd1a: Fixed validation when loading external manifests

## 0.0.26

### Patch Changes

- 4222fb7: Cleaned up validation for attribute binding and interpolated values

## 0.0.25

### Patch Changes

- 09d2b46: Added fallback to `string` when attribute type is a TypeScript generic
- 09d2b46: Added logic to keep MCP server alive to prevent timeouts
- 09d2b46: Skipped validation for attributes with flexible string inputs (`string & {}`) and excluded them from the list of options
- 09d2b46: Added error logs for MCP server

## 0.0.24

### Patch Changes

- dd72902: Added some error logging

## 0.0.23

### Patch Changes

- 13e07ff: Fixed autocomplete

## 0.0.22

### Patch Changes

- 04e9a15: Fixed language server restart functionality
- 8fc266c: Added hover, autocomplete, and validation for properties and events in common template binding syntaxes (Angular, React, Vue, Lit, FAST, etc.).
- 04e9a15: Added autocomplete and hover information for CSS variables, parts, and states
- 8fc266c: Added API cache for better performance. This also adds access to other APIs besides just attributes.

## 0.0.21

### Patch Changes

- 36a616c: Added types to descriptions for attributes, properties, and events
- 5e8c7a6: Added AI support and MCP server

## 0.0.20

### Patch Changes

- daab834: Fixed boolean binding behavior when using `?` in templates

## 0.0.19

### Patch Changes

- 30a3aee: Fixed config load timing when loading manifests

## 0.0.18

### Patch Changes

- 7366741: Added restart scheduler to batch restarts and prevent multiple restarts when the project is changed
- 9ecf276: Updated documentation

## 0.0.17

### Patch Changes

- 9ff3d68: Fixed autocomplete issue with attributes that start with "?"
- 9ff3d68: Fixed issue that cause the language server to crash when no attribute "name" is defined
- 9cba346: Fixed globby path resolver
- 87cec34: Added `debug` config setting

## 0.0.16

### Patch Changes

- e8c1382: Renamed `wctools-disable` comments to `wctools-ignore`

## 0.0.15

### Patch Changes

- 36c8b67: Fixed autocomplete after an attribute with a bound value
- 36c8b67: Added basic template binding completions and prevent validation on bound attributes

## 0.0.14

### Patch Changes

- 60bff83: Removed plugin that was causing duplicate entries in info bubbles and autocomplete menus
- 190599f: Added watcher for `node_modules` directory

## 0.0.13

### Patch Changes

- a4e423e: Fixed logic to find manifest at the root of the project
- a4e423e: Added more common attributes to prevent warnings
- a4e423e: Cached hover documentation for faster render

## 0.0.12

### Patch Changes

- 4541eac: Added watchers to restart extension when manifest, package.json, or config changes

## 0.0.11

### Patch Changes

- bdbe4b3: Add better error handling if dependencies aren't installed
- bdbe4b3: Added check to prevent crashes if `node_modules` haven't been installed

## 0.0.10

### Patch Changes

- ea8110a: Fixed false positives with `unknownAttribute` for common attributes

## 0.0.9

### Patch Changes

- 188575e: Added `unknownElement` and `unknownAttribute` diagnostic settings
- 12b5f6b: Fixed regex for getting attribute values with spaces
- 98447f7: Added inline comments to ignore diagnostic rules
- 188575e: Added ability to disable validation features using "off"
