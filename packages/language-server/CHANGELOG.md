# @wc-toolkit/language-server

## 0.0.7

### Patch Changes

- a80cf60: Added support for type validation with union and intersection types - `string & {}` and `number & {}`
- a80cf60: Added default value details to hover and autocomplete services

## 0.0.6

### Patch Changes

- ad48173: Fixed executable deployment to GitHub Releases

## 0.0.5

### Patch Changes

- e2c39d7: Updated where executables get deployed in the GitHub Release

## 0.0.4

### Patch Changes

- 0131c34: Added operating specific executables

## 0.0.3

### Patch Changes

- 935c0fa: Updated language server to compile to a single-file executable to remove node.js dependency

## 0.0.2

### Patch Changes

- 739346a: Updated build to include TypeScript dependencies

## 0.0.1

### Patch Changes

- f955de3: Fixed release pipeline

## 0.0.7

### Patch Changes

- 60bff83: Removed plugin that was causing duplicate entries in info bubbles and autocomplete menus

## 0.0.6

### Patch Changes

- a4e423e: Removed unused code

## 0.0.5

### Patch Changes

- 4541eac: Added watchers to restart extension when manifest, package.json, or config changes

## 0.0.4

### Patch Changes

- bdbe4b3: Add better error handling if dependencies aren't installed
- bdbe4b3: Added check to prevent crashes if `node_modules` haven't been installed
- bdbe4b3: Fixed type export from language server

## 0.0.3

### Patch Changes

- ea8110a: Fixed false positives with `unknownAttribute` for common attributes

## 0.0.2

### Patch Changes

- 188575e: Added `unknownElement` and `unknownAttribute` diagnostic settings
- 6f7210d: Updated language-server project to be ESM
- 12b5f6b: Fixed regex for getting attribute values with spaces
- 98447f7: Added inline comments to ignore diagnostic rules
- 188575e: Added ability to disable validation features using "off"
