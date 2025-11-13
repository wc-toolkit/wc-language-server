# @wc-toolkit/wctools

## 0.0.10

### Patch Changes

- dd72902: Added some error logging

## 0.0.9

### Patch Changes

- 8fc266c: Added hover, autocomplete, and validation for properties and events in common template binding syntaxes (Angular, React, Vue, Lit, FAST, etc.).
- 8fc266c: Added API cache for better performance. This also adds access to other APIs besides just attributes.

## 0.0.8

### Patch Changes

- daab834: Fixed boolean binding behavior when using `?` in templates

## 0.0.7

### Patch Changes

- 30a3aee: Fixed config load timing when loading manifests

## 0.0.6

### Patch Changes

- 9ecf276: Updated documentation

## 0.0.5

### Patch Changes

- 9ff3d68: Fixed autocomplete issue with attributes that start with "?"
- 9ff3d68: Fixed issue that cause the language server to crash when no attribute "name" is defined
- 9cba346: Fixed globby path resolver
- 87cec34: Added `debug` config setting

## 0.0.4

### Patch Changes

- e8c1382: Renamed `wctools-disable` comments to `wctools-ignore`

## 0.0.3

### Patch Changes

- 36c8b67: Added basic template binding completions and prevent validation on bound attributes

## 0.0.2

### Patch Changes

- a4e423e: Updated default config format to be `module` instead of `commonjs`
- a4e423e: Fixed logic to find manifest at the root of the project
- a4e423e: Added more common attributes to prevent warnings
- a4e423e: Fixed issue where `wctools validate` was not including all files when no configuration was set

## 0.0.1

### Patch Changes

- 09120a9: Initial commit
