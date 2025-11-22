# Zed Configuration for Web Components Language Server

## Enabling the Language Server

After installing the Web Components extension, you need to configure Zed to use it. Zed supports running multiple language servers simultaneously for the same language.

### Option 1: Run Alongside Built-in HTML Server (Recommended)

This configuration runs both the Web Components Language Server and Zed's built-in HTML language server, giving you the best of both worlds:

1. Open Zed settings: `cmd-,` (Mac) or `ctrl-,` (Windows/Linux)
2. Click "Open Settings JSON" in the bottom right
3. Add this configuration:

```json
{
  "languages": {
    "HTML": {
      "language_servers": [
        "web-components-language-server",
        "vscode-html-language-server"
      ]
    },
    "JavaScript": {
      "language_servers": [
        "web-components-language-server",
        "typescript-language-server"
      ]
    },
    "TypeScript": {
      "language_servers": [
        "web-components-language-server",
        "typescript-language-server"
      ]
    },
    "TSX": {
      "language_servers": [
        "web-components-language-server",
        "typescript-language-server"
      ]
    },
    "JSX": {
      "language_servers": [
        "web-components-language-server",
        "typescript-language-server"
      ]
    }
  }
}
```

### Option 2: Web Components Only

If you want to use only the Web Components Language Server (disabling the default HTML server):

```json
{
  "languages": {
    "HTML": {
      "language_servers": [
        "web-components-language-server",
        "!vscode-html-language-server"
      ]
    }
  }
}
```

The `!` prefix disables a specific language server.

### Option 3: Per-Project Configuration

You can also configure this per-project by creating a `.zed/settings.json` file in your project root:

```json
{
  "languages": {
    "HTML": {
      "language_servers": ["web-components-language-server", "vscode-html-language-server"]
    }
  }
}
```

## Verifying the Configuration

After configuring the language servers:

1. Open an HTML file with web components
2. Check the status bar - you should see the language server indicator
3. Try typing `<` to see if web component completions appear
4. Hover over a web component tag to see if documentation appears

## Troubleshooting

### Language Server Not Starting

If the language server doesn't start:

1. Check the Zed logs:
   - Run Zed from terminal: `zed --foreground`
   - Look for messages about "web-components-language-server"

2. Verify the extension is installed:
   - `cmd-shift-p` → "zed: extensions"
   - Look for "Web Components" in the list

3. Check your settings.json:
   - Ensure the language server name matches exactly: `web-components-language-server`
   - Verify JSON syntax is correct (no trailing commas, proper quotes)

### Multiple Servers Behavior

When running multiple language servers:

- **Completions**: Zed merges completions from all servers
- **Hover**: Information from all servers is combined
- **Diagnostics**: All servers can report issues
- **Go to Definition**: First server to respond wins

This means you get comprehensive support combining web component features with standard HTML/JS support.

## Advanced Configuration

### Language Server Settings

You can pass settings to the language server:

```json
{
  "lsp": {
    "web-components-language-server": {
      "settings": {
        "wc": {
          "diagnostics": {
            "enabled": true,
            "unknownElements": "warning"
          },
          "completion": {
            "enabled": true,
            "attributeQuotes": "double"
          }
        }
      }
    }
  }
}
```

### Disabling for Specific File Types

```json
{
  "languages": {
    "HTML": {
      "language_servers": ["web-components-language-server"]
    },
    "PHP": {
      "language_servers": ["!web-components-language-server"]
    }
  }
}
```

## Example Complete Configuration

Here's a complete example settings.json for a web components project:

```json
{
  "languages": {
    "HTML": {
      "language_servers": ["web-components-language-server", "vscode-html-language-server"],
      "format_on_save": "on",
      "tab_size": 2
    },
    "JavaScript": {
      "language_servers": ["web-components-language-server", "typescript-language-server"]
    },
    "TypeScript": {
      "language_servers": ["web-components-language-server", "typescript-language-server"]
    },
    "TSX": {
      "language_servers": ["web-components-language-server", "typescript-language-server"]
    },
    "JSX": {
      "language_servers": ["web-components-language-server", "typescript-language-server"]
    }
  },
  "lsp": {
    "web-components-language-server": {
      "settings": {
        "wc": {
          "diagnostics": {
            "enabled": true
          }
        }
      }
    }
  }
}
```

## References

- [Zed Language Server Documentation](https://zed.dev/docs/extensions/languages#language-servers)
- [Zed Settings Documentation](https://zed.dev/docs/configuring-zed)
