# web-components-language-server

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
