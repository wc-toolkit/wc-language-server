# Web Component Linting (`WCLint`)

WCLint statically analyzes your code to quickly find problems using information from the [Custom Elements Manifest (CEM)](https://github.com/webcomponents/custom-elements-manifest). Editor support can be found using the [Web Component Language Server](https://wc-toolkit.com/integrations/web-components-language-server/) and you can run WCLint as part of your continuous integration pipeline.

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
npm install -g @wc-toolkit/wclint

# Or install locally in your project
npm install --save-dev @wc-toolkit/wclint
```

## Quick Start

1. **Validate your files** - use the default configuration:
   ```bash
   wclint validate
   ```

2. **Initialize a configuration (optional)** - create custom behavior for the linter:
   ```bash
   wclint init
   ```

## Usage

### Commands

#### `validate [patterns...]`

Validate Web Component files against Custom Elements Manifest.

```bash
# Validate specific files
wclint validate src/components/*.html

# Validate with glob patterns
wclint validate "src/**/*.{html,js,ts}"

# Different output formats - default is `text`
wclint validate --format json src/*.html
wclint validate --format junit src/*.html > results.xml
wclint validate --format checkstyle src/*.html
```

**Options:**
- `-f, --format <format>` - Output format: `text`, `json`, `junit`, `checkstyle` (default: `text`)
- `--no-color` - Disable colored output
- `-v, --verbose` - Show files with no issues

**Additional Options:**
- `-o, --output <file>` - Write results to a file. When `--format` is omitted, the CLI will try to autodetect the format from the output filename extension (for example: `.sarif`, `.html`, `.json`, `.xml`).

### Custom Configuration

Create a sample configuration file. This file uses the same format as the Language Server and will be shared by both.

The configuration will give you default values, but all of the settings are required, so feel fre to remove those that you don't need. 

```bash
# Create default config
wclint init
```

## Programmatic API

You can also import types and the programmatic adapter directly from `@wc-toolkit/wclint` when using this package as a dependency:

```ts
import type { WCConfig } from '@wc-toolkit/wclint';
import { runValidate } from '@wc-toolkit/wclint';

const config: WCConfig = { manifestSrc: 'custom-elements.json' };
await runValidate(['src/**/*.html'], { config: './wc.config.js', format: 'html' });
```

This is useful for embedding the validator in build scripts or custom tooling without spawning child processes.

**Options:**
- `-f, --file <filename>` - Configuration file name (default: `wc.config.json`)

## Configuration

The CLI will use a default configuration if one isn't specified. You can set custom configurations by creating a `wc.config.js` file at the root of your project.

### Configuration Example

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

Choose an output format based on who (or what) will consume the results:

- Use the default Text format for quick, human-readable checks in a terminal.
- Use JSON when you need a machine-readable export for dashboards, scripts, or editor integrations.
- Use JUnit XML to integrate with CI systems that display test reports (GitHub Actions, GitLab, Jenkins).
- Use Checkstyle XML when you want to feed results into code-quality tools or PR annotation bots that understand the Checkstyle schema.

Below are short notes on common consumers and why a format might be preferred.

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
<testsuite name="wclint" tests="1" failures="0">
  <testcase name="src/components/my-element.html" classname="WebComponentValidation"/>
</testsuite>
```

### Checkstyle XML Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="1.0">
  <file name="src/components/my-element.html">
    <error line="1" column="15" severity="hint" message="Unknown element: my-custom-element" source="wclint"/>
  </file>
</checkstyle>
```

### SARIF Format

SARIF is useful for CI code-scanning integrations and security tools. To produce a SARIF file use either `--format sarif` or an output filename ending in `.sarif`:

```bash
wclint validate --format sarif "src/**/*.html" > results.sarif
# or
wclint validate --output results.sarif "src/**/*.html"
```

The CLI emits SARIF 2.1.0 with basic tool/driver metadata and rules mapped to diagnostics so code scanning and SARIF viewers can display issues correctly.

### HTML Report

Generate a single-file HTML report suitable for attaching as CI artifacts or sharing with teammates. The HTML is styled and responsive for quick inspection in a browser:

```bash
wclint validate --format html --output report.html "src/**/*.html"
# or let the CLI infer HTML from the filename
wclint validate --output report.html "src/**/*.html"
```

When saving HTML as a CI artifact you can open it in the browser or attach it to pull requests for easy review.

Which to pick

- Local developer runs: `text` (fast, readable).
- Automation / integrations: `json`, `junit`, or `checkstyle` depending on the consuming tool.
- CI reporting & historical metrics: prefer structured formats (`junit`, `json`, or `sarif`) so results can be stored and trended.

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
      - run: npx wclint validate
```

### GitLab CI

```yaml
validate-web-components:
  stage: test
  script:
    - npm ci
    - npx wclint validate --format junit "src/**/*.html" > validation-results.xml
  artifacts:
    reports:
      junit: validation-results.xml
```

### npm Scripts

```json
{
  "scripts": {
    "validate:wc": "wclint validate \"src/**/*.{html,js,ts}\"",
    "validate:wc:ci": "wclint validate --format junit \"src/**/*.html\" > validation-results.xml"
  }
}
```

## Examples

### Basic Validation

```bash
# Validate all HTML files in src directory
wclint validate "src/**/*.html"

# Validate specific files
wclint validate src/button.html src/card.html

# Validate with verbose output to see all files processed
wclint validate --verbose "**/*.html"
```

### Custom Configuration

```bash
# Different output formats for CI
wclint validate --format junit "src/**/*.html" > results.xml
wclint validate --format checkstyle "src/**/*.html" > checkstyle.xml
wclint validate --format json "src/**/*.html" > results.json
```

### Integration with Build Tools

```bash
# Validate with build
npm run build && npm run validate:wc

# Validate in watch mode (using nodemon or similar)
nodemon --watch src --ext html,js,ts --exec "wclint validate 'src/**/*.html'"
```

## Supported File Types

The CLI currently validates Web Components usage in any file format.

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

## Related Projects

- [@wc-toolkit/language-server](../language-server) - VS Code language server for Web Components
- [@wc-toolkit/vscode](../vscode) - VS Code extension for Web Components
- [@custom-elements-manifest/analyzer](https://www.npmjs.com/package/@custom-elements-manifest/analyzer) - Generate Custom Elements Manifest

## Contributing

Contributions are welcome! Please see the [contributing guidelines](../../CONTRIBUTING.md) for more information.

## License

MIT License - see [LICENSE](LICENSE) file for details.
