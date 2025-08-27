# @wc-toolkit/cli

A command-line interface for validating Web Components using Custom Elements Manifest (CEM). This CLI tool reuses the validation logic from the `@wc-toolkit/language-server` to provide standalone validation capabilities outside of your editor.

## Features

- 🔍 **Web Components Validation** - Validates custom elements, attributes, and their values against Custom Elements Manifest
- 🎯 **Unknown Element Detection** - Identifies unregistered custom elements
- ⚠️ **Unknown Attribute Detection** - Finds attributes not defined in the manifest
- 📊 **Multiple Output Formats** - Text, JSON, JUnit XML, and Checkstyle XML
- 🎨 **Colored Output** - Terminal-friendly formatting with colors and icons
- ⚙️ **Configurable** - Flexible configuration via JSON or JavaScript files
- 🔧 **CLI Integration** - Perfect for CI/CD pipelines and build processes

## Installation

```bash
# Install globally
npm install -g @wc-toolkit/cli

# Or install locally in your project
npm install --save-dev @wc-toolkit/cli
```

## Quick Start

1. **Initialize configuration**:
   ```bash
   wc-validate init
   ```

2. **Validate your files**:
   ```bash
   wc-validate validate "src/**/*.html"
   ```

## Usage

### Commands

#### `validate [patterns...]`

Validate Web Component files against Custom Elements Manifest.

```bash
# Validate specific files
wc-validate validate src/components/*.html

# Validate with glob patterns
wc-validate validate "src/**/*.{html,js,ts}"

# Validate with custom config
wc-validate validate --config my-config.json "**/*.html"

# Different output formats
wc-validate validate --format json src/*.html
wc-validate validate --format junit src/*.html > results.xml
wc-validate validate --format checkstyle src/*.html
```

**Options:**
- `-c, --config <path>` - Path to configuration file
- `-f, --format <format>` - Output format: `text`, `json`, `junit`, `checkstyle` (default: `text`)
- `--no-color` - Disable colored output
- `-v, --verbose` - Show files with no issues

#### `init [options]`

Create a sample configuration file.

```bash
# Create default config
wc-validate init

# Create with custom filename
wc-validate init --file wc.config.js
```

**Options:**
- `-f, --file <filename>` - Configuration file name (default: `wc.config.json`)

## Configuration

The CLI supports multiple configuration file formats:

- `wc.config.json`
- `wc.config.js`
- `.wcrc.json`
- `.wcrc.js`
- `.wcrc`

### Configuration Example

```json
{
  "manifestSrc": "custom-elements.json",
  "include": [
    "src/**/*.html",
    "src/**/*.js",
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules/**",
    "dist/**",
    "build/**"
  ],
  "diagnosticSeverity": {
    "unknownElement": "warning",
    "unknownAttribute": "warning",
    "deprecatedElement": "warning",
    "deprecatedAttribute": "warning",
    "invalidBoolean": "error",
    "invalidNumber": "error",
    "invalidAttributeValue": "error",
    "duplicateAttribute": "error"
  }
}
```

### JavaScript Configuration

```javascript
// wc.config.js
export default {
  manifestSrc: 'custom-elements.json',
  include: ['src/**/*.html', 'src/**/*.js'],
  exclude: ['node_modules/**'],
  diagnosticSeverity: {
    unknownElement: 'hint',
    unknownAttribute: 'hint'
  }
};
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `manifestSrc` | `string` | `"custom-elements.json"` | Path to Custom Elements Manifest file |
| `include` | `string[]` | `["**/*.html"]` | File patterns to include |
| `exclude` | `string[]` | `["node_modules/**", ".git/**", "dist/**", "build/**"]` | File patterns to exclude |
| `typeSrc` | `"parsedType" \| "type"` | `"parsedType"` | Which type information to use |
| `diagnosticSeverity` | `object` | See below | Severity levels for different diagnostic types |

### Diagnostic Severity Options

Configure the severity level for different types of validation issues:

```json
{
  "diagnosticSeverity": {
    "unknownElement": "hint",
    "unknownAttribute": "hint", 
    "deprecatedElement": "warning",
    "deprecatedAttribute": "warning",
    "invalidBoolean": "error",
    "invalidNumber": "error",
    "invalidAttributeValue": "error",
    "duplicateAttribute": "error"
  }
}
```

**Severity Levels:**
- `"error"` - Causes validation to fail (exit code 1)
- `"warning"` - Shows as warning but doesn't fail
- `"info"` - Informational message
- `"hint"` - Subtle hint/suggestion
- `"off"` - Disables diagnostic

## Output Formats

### Text Format (Default)

```
src/components/my-element.html:
  💡 Hint 1:15 Unknown element: my-custom-element
  💡 Hint 1:30 Unknown attribute: unknown-attr

Found 2 hints in 1 file.
```

### JSON Format

```json
[
  {
    "file": "src/components/my-element.html",
    "diagnostics": [
      {
        "range": {
          "start": { "line": 0, "character": 14 },
          "end": { "line": 0, "character": 31 }
        },
        "severity": 4,
        "message": "Unknown element: my-custom-element"
      }
    ]
  }
]
```

### JUnit XML Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="wc-validate" tests="1" failures="0">
  <testcase name="src/components/my-element.html" classname="WebComponentValidation"/>
</testsuite>
```

### Checkstyle XML Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="1.0">
  <file name="src/components/my-element.html">
    <error line="1" column="15" severity="hint" message="Unknown element: my-custom-element" source="wc-validate"/>
  </file>
</checkstyle>
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Validate Web Components
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx wc-validate validate "src/**/*.html"
```

### GitLab CI

```yaml
validate-web-components:
  stage: test
  script:
    - npm ci
    - npx wc-validate validate --format junit "src/**/*.html" > validation-results.xml
  artifacts:
    reports:
      junit: validation-results.xml
```

### npm Scripts

```json
{
  "scripts": {
    "validate:wc": "wc-validate validate \"src/**/*.{html,js,ts}\"",
    "validate:wc:ci": "wc-validate validate --format junit \"src/**/*.html\" > validation-results.xml"
  }
}
```

## Examples

### Basic Validation

```bash
# Validate all HTML files in src directory
wc-validate validate "src/**/*.html"

# Validate specific files
wc-validate validate src/button.html src/card.html

# Validate with verbose output to see all files processed
wc-validate validate --verbose "**/*.html"
```

### Custom Configuration

```bash
# Use specific config file
wc-validate validate --config ./configs/strict.json "src/**/*.html"

# Different output formats for CI
wc-validate validate --format junit "src/**/*.html" > results.xml
wc-validate validate --format checkstyle "src/**/*.html" > checkstyle.xml
wc-validate validate --format json "src/**/*.html" > results.json
```

### Integration with Build Tools

```bash
# Validate before build
npm run validate:wc && npm run build

# Validate in watch mode (using nodemon or similar)
nodemon --watch src --ext html,js,ts --exec "wc-validate validate 'src/**/*.html'"
```

## Supported File Types

The CLI validates Web Components usage in:

- **HTML** (`.html`, `.htm`) - Template files
- **JavaScript** (`.js`) - Component definitions and usage
- **TypeScript** (`.ts`) - Component definitions and usage  
- **JSX/TSX** (`.jsx`, `.tsx`) - React components using Web Components
- **Vue** (`.vue`) - Vue single-file components
- **Svelte** (`.svelte`) - Svelte components

## Custom Elements Manifest

This tool requires a Custom Elements Manifest (CEM) file to validate against. You can generate one using:

- [@custom-elements-manifest/analyzer](https://www.npmjs.com/package/@custom-elements-manifest/analyzer)
- [Stencil](https://stenciljs.com/) (built-in CEM generation)
- [Lit](https://lit.dev/) with [@lit/reactive-element](https://www.npmjs.com/package/@lit/reactive-element)

Example CEM generation:

```bash
# Using CEM Analyzer
npx @custom-elements-manifest/analyzer analyze --litelement

# Using Stencil (automatic)
npm run build

# Using Lit
npx cem analyze --litelement
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/wc-toolkit/wc-language-server.git
cd wc-language-server

# Install dependencies
pnpm install

# Build the language server
cd packages/language-server
pnpm build

# Build the CLI
cd ../cli
pnpm build

# Test the CLI
pnpm dev --help
```

### Running Tests

```bash
# Run CLI in development mode
pnpm dev validate "test.html"

# Create test configuration
pnpm dev init --file test.config.json
```

## Related Projects

- [@wc-toolkit/language-server](../language-server) - VS Code language server for Web Components
- [@wc-toolkit/vscode](../vscode) - VS Code extension for Web Components
- [@custom-elements-manifest/analyzer](https://www.npmjs.com/package/@custom-elements-manifest/analyzer) - Generate Custom Elements Manifest

## Contributing

Contributions are welcome! Please see the [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

MIT License - see [LICENSE](LICENSE) file for details.
