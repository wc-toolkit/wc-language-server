# @wc-toolkit/cli

A command-line tool for validating Web Components in your projects. This tool provides the same diagnostic feedback as the Web Components Language Server, but in a format suitable for CI/CD pipelines and build environments.

## Installation

```bash
# Install globally
npm install -g @wc-toolkit/cli

# Or install locally in your project
npm install --save-dev @wc-toolkit/cli
```

## Usage

### Basic Usage

```bash
# Validate all HTML, JS, and TS files
wc-lint

# Validate specific files
wc-lint src/**/*.html src/**/*.ts

# Use custom config file
wc-lint --config ./my-wc.config.js

# Output to file
wc-lint --output results.json --format json
```

### Configuration

The CLI uses the same `wc.config.js` configuration format as the language server:

```javascript
export default {
  include: ['**/*.html', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  exclude: ['**/*.json', 'node_modules/**', 'dist/**'],
  manifestSrc: 'custom-elements.json',
  diagnosticSeverity: {
    invalidBoolean: 'warning',
    invalidNumber: 'error',
    invalidAttributeValue: 'error',
    deprecatedAttribute: 'warning',
    deprecatedElement: 'warning',
    unknownElement: 'warning',
    unknownAttribute: 'info'
  },
  tagFormatter: (tag) => tag,
  libraries: {
    "@shoelace-style/shoelace": {
      tagFormatter: (tag) => `sl-${tag}`,
      diagnosticSeverity: {
        unknownAttribute: 'warning'
      }
    }
  }
};
```

### Output Formats

#### Text (Default)
Human-readable format similar to ESLint:

```bash
wc-lint --format text
```

```
/path/to/file.html
  10:5  warning  Unknown custom element 'my-component'  wc-toolkit
  13:5  error    Invalid attribute value for 'disabled'  wc-toolkit

✖ 1 errors ⚠ 1 warnings
```

#### JSON
Machine-readable format for further processing:

```bash
wc-lint --format json
```

```json
[
  {
    "file": "/path/to/file.html",
    "diagnostics": [
      {
        "range": {
          "start": { "line": 9, "character": 4 },
          "end": { "line": 9, "character": 42 }
        },
        "message": "Unknown custom element 'my-component'",
        "severity": 2,
        "source": "wc-toolkit"
      }
    ]
  }
]
```

#### Checkstyle XML
Compatible with Jenkins, SonarQube, and other CI tools:

```bash
wc-lint --format checkstyle
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="1.0">
  <file name="/path/to/file.html">
    <error line="10" column="5" severity="warning" 
           message="Unknown custom element 'my-component'" 
           source="wc-toolkit" />
  </file>
</checkstyle>
```

#### JUnit XML
Compatible with test reporting tools:

```bash
wc-lint --format junit
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <path>` | Path to wc.config.js | `wc.config.js` |
| `-f, --format <format>` | Output format (text, json, checkstyle, junit) | `text` |
| `-o, --output <path>` | Output file (default: stdout) | - |
| `--fail-on-error` | Exit with non-zero code on errors | `true` |
| `--fail-on-warning` | Exit with non-zero code on warnings | `false` |
| `--quiet` | Only output errors and warnings | `false` |

## CI/CD Integration

### GitHub Actions

```yaml
name: Web Components Validation
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx wc-lint --format json --output wc-results.json
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: wc-lint-results
          path: wc-results.json
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Web Components Validation') {
            steps {
                sh 'npx wc-lint --format checkstyle --output wc-checkstyle.xml'
                publishCheckstyle pattern: 'wc-checkstyle.xml'
            }
        }
    }
}
```

### GitLab CI

```yaml
wc-lint:
  stage: test
  script:
    - npm ci
    - npx wc-lint --format junit --output wc-junit.xml
  artifacts:
    reports:
      junit: wc-junit.xml
```

## Custom Elements Manifest

The CLI automatically discovers and loads `custom-elements.json` files from:

1. `custom-elements.json` (current directory)
2. `dist/custom-elements.json`
3. `src/custom-elements.json`
4. Custom path specified in `wc.config.js` via `manifestSrc`

## Validation Rules

The CLI validates:

- **Unknown custom elements**: Elements with hyphens not found in manifests
- **Unknown attributes**: Attributes not defined in element manifests
- **Deprecated elements**: Elements marked as deprecated in manifests
- **Deprecated attributes**: Attributes marked as deprecated in manifests
- **Invalid attribute values**: Type validation for boolean, number attributes
- **Duplicate attributes**: Multiple instances of the same attribute

## Exit Codes

- `0`: No errors found (or only warnings when `--fail-on-warning` is false)
- `1`: Errors found or warnings found when `--fail-on-warning` is true

## Examples

```bash
# Basic validation
wc-lint

# Validate specific patterns
wc-lint "src/**/*.html" "src/**/*.ts"

# Strict mode (fail on warnings)
wc-lint --fail-on-warning

# Generate report for CI
wc-lint --format checkstyle --output checkstyle.xml --quiet

# Debug mode with detailed output
wc-lint --format json | jq '.[] | .diagnostics[]'
```
