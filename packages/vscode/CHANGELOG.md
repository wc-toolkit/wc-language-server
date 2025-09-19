# web-components-language-server

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
