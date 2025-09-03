<div align="center">
  
![workbench with tools, html, css, javascript, and wclint logo](https://github.com/wc-toolkit/wc-language-server/blob/main/assets/wc-toolkit_wclint.png?raw=true)

</div>

# Web Component Linter (`WCLint`)

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
   wclint
   ```

2. **Initialize a configuration (optional)** - create custom behavior for the linter:
   ```bash
   wclint init
   ```

## Usage

### Commands

The commands follow a similar pattern to ESLint.

```bash
wclint [options] [file|dir|glob]*
```

Validate Web Component files against Custom Elements Manifest.

```bash
# Validate using a custom or default config
wclint

# Validate specific files
wclint src/components/*.html

# Validate with glob patterns
wclint "src/**/*.{html,js,ts}"

# Different output formats - default is `text`
wclint --format json src/*.html
wclint --format junit src/*.html > results.xml
wclint --format checkstyle src/*.html
```

**Options:**

- `-f, --format <format>` - Output format: `text`, `json`, `junit`, `checkstyle` (default: `text`)
- `--no-color` - Disable colored output
- `-v, --verbose` - Show files with no issues

**Additional Options:**

- `-o, --output <file>` - Write results to a file. When `--format` is omitted, the CLI will try to autodetect the format from the output filename extension (for example: `.sarif`, `.html`, `.json`, `.xml`).

### Custom Configuration

Create a sample configuration file. This file uses the same format as the [Language Server](https://wc-toolkit.com/integrations/web-components-language-server/) and will be shared by both.

The configuration will give you default values, but all of the settings are required, so feel free to remove those that you don't need.

```bash
# Create default config
wclint init
```

> **NOTE:** The configuration should be at the root of your project with the name `wc.config.js` in order for the linter and language server to detect it.

## Disabling diagnostics in source

WCLint supports in-source directives to suppress diagnostics similar to ESLint. Use HTML comments to disable rules globally or for the next line. Multiple rules may be listed and will stack. Rules can be separated by spaces or commas.

Examples:

- Disable all diagnostics for the file:

```html
<!-- wclint-disable -->
````

- Disable specific rules for the file (stacked, comma or space separated):

```html
<!-- wclint-disable unknownAttribute deprecatedAttribute -->
```

- Disable a rule for the next line:

```html
<!-- wclint-disable-next-line deprecatedAttribute -->
<my-element deprecated-attr></my-element>
```

These directives are useful to locally silence known, acceptable deviations without changing global configuration.

## Programmatic API

You can also import types and the programmatic adapter directly from `@wc-toolkit/wclint` when using this package as a dependency:

```ts
import {
  lintWebComponents,
  type LintWebComponentsOptions,
} from "@wc-toolkit/wclint";

const options: LintWebComponentsOptions = {
  format: "html",
  output: "lint-result.html",
};
await lintWebComponents(["src/**/*.html"], options);
```

This is useful for embedding the validator in build scripts or custom tooling without spawning child processes.

**Options:**

- `-f, --file <filename>` - Configuration file name (default: `wc.config.json`)

## Output Formats

Choose an output format based on who (or what) will consume the results:

- Use the default Text format for quick, human-readable checks in a terminal.
- Use JSON when you need a machine-readable export for dashboards, scripts, or editor integrations.
- Use JUnit XML to integrate with CI systems that display test reports (GitHub Actions, GitLab, Jenkins).
- Use Checkstyle XML when you want to feed results into code-quality tools or PR annotation bots that understand the Checkstyle schema.
- SARIF is useful for CI code-scanning integrations and security tools.

Below are short notes on common consumers and why a format might be preferred.

### Which to Pick

- Local developer runs: `text` (fast, readable).
- Automation / integrations: `json`, `junit`, or `checkstyle` depending on the consuming tool.
- CI reporting & historical metrics: prefer structured formats (`junit`, `json`, or `sarif`) so results can be stored and trended.

### Text Format (Default)

```bash
# default lint command uses text output
wclint

# manual file output
wclint --format text --output report.txt
```

```txt
src/components/my-element.html:
  💡 Hint 1:15 Unknown element: my-custom-element
  💡 Hint 1:30 Unknown attribute: unknown-attr

Found 2 hints in 1 file.
```

### JSON Format

```bash
wclint --format json --output report.json
```

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

```bash
wclint --format junit --output report.xml
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="wclint" tests="1" failures="0">
  <testcase name="src/components/my-element.html" classname="WebComponentValidation"/>
</testsuite>
```

### Checkstyle XML Format

```bash
wclint --format checkstyle --output report.xml
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="1.0">
  <file name="src/components/my-element.html">
    <error line="1" column="15" severity="hint" message="Unknown element: my-custom-element" source="wclint"/>
  </file>
</checkstyle>
```

### SARIF Format

```bash
wclint --format sarif --output report.json
```

```json
{
  "$schema": "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "wclint",
          "informationUri": "https://wc-toolkit.com"
        }
      },
      "results": [
        {
          "ruleId": "WC001",
          "level": "note",
          "message": { "text": "Unknown element: my-custom-element" },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": { "uri": "src/components/my-element.html" },
                "region": { "startLine": 1, "startColumn": 15 }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

The CLI emits SARIF 2.1.0 with basic tool/driver metadata and rules mapped to diagnostics so code scanning and SARIF viewers can display issues correctly.

### HTML Report

Generate a single-file HTML report suitable for attaching as CI artifacts or sharing with teammates. The HTML is styled and responsive for quick inspection in a browser.

```bash
wclint --format html --output report.html
```

When saving HTML as a CI artifact you can open it in the browser or attach it to pull requests for easy review.

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
          node-version: "18"
      - run: npm ci
      - run: npx wclint
```

### GitLab CI

```yaml
validate-web-components:
  stage: test
  script:
    - npm ci
    - npx wclint --format junit "src/**/*.html" > validation-results.xml
  artifacts:
    reports:
      junit: validation-results.xml
```

### npm Scripts

```json
{
  "scripts": {
    "validate:wc": "wclint \"src/**/*.{html,js,ts}\"",
    "validate:wc:ci": "wclint --format junit \"src/**/*.html\" > validation-results.xml"
  }
}
```

## Examples

### Basic Validation

```bash
# Validate all HTML files in src directory
wclint "src/**/*.html"

# Validate specific files
wclint src/button.html src/card.html

# Validate with verbose output to see all files processed
wclint --verbose "**/*.html"
```

### Custom Configuration

```bash
# Different output formats for CI
wclint --format junit "src/**/*.html" > results.xml
wclint --format checkstyle "src/**/*.html" > checkstyle.xml
wclint --format json "src/**/*.html" > results.json
```

### Integration with Build Tools

```bash
# Validate with build
npm run build && npm run validate:wc

# Validate in watch mode (using nodemon or similar)
nodemon --watch src --ext html,js,ts --exec "wclint 'src/**/*.html'"
```

## Supported File Types

The CLI currently validates Web Components usage in any file format.

## Related Projects

- [@wc-toolkit/language-server](https://wc-toolkit.com/integrations/web-components-language-server/) - Editor support for Web Components

## Contributing

Contributions are welcome! Please see the [contributing guidelines](./CONTRIBUTING.md) for more information.

## License

MIT License - see [LICENSE](LICENSE) file for details.
