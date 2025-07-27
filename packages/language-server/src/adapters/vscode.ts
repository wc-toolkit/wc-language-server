import {
  HTMLDataAttribute,
  HTMLDataTag,
  HTMLDataAttributeValue,
  LanguageServerAdapter,
} from "./types";
import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };

export class VSCodeAdapter implements LanguageServerAdapter {
  createCompletionItem(
    tag: string,
    description: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _attributes: HTMLDataAttribute[] = []
  ): html.CompletionItem {
    return {
      label: tag,
      kind: html.CompletionItemKind.Property,
      documentation: {
        kind: "markdown",
        value: description,
      },
      insertText: `<${tag}>$0</${tag}>`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      detail: "Custom Element",
      sortText: "0" + tag, // Sort custom elements first
    };
  }

  createHTMLDataProvider(tags: HTMLDataTag[]): html.IHTMLDataProvider {
    return html.newHTMLDataProvider("custom-elements", {
      version: 1.1,
      tags: tags,
    });
  }

  createHoverInfo(tag: string, description: string): html.MarkupContent {
    return {
      kind: "markdown",
      value: `**${tag}** (Custom Element)\n\n${description}`,
    };
  }

  // New method to create attribute completion items
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createAttributeCompletionItem(
    attribute: HTMLDataAttribute,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tagName: string
  ): html.CompletionItem {
    const hasValues = attribute.values && attribute.values.length > 0;

    const documentation =
      attribute.description || `Attribute: ${attribute.name}`;
    const typeInfo = attribute.type
      ? `\n\n**Type:** \`${attribute.type}\``
      : "";

    return {
      label: attribute.name,
      kind: html.CompletionItemKind.Property,
      documentation: {
        kind: "markdown",
        value: documentation + typeInfo,
      },
      insertText: hasValues
        ? `${attribute.name}="$1"$0`
        : `${attribute.name}="$0"`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      sortText: "0" + attribute.name, // Sort at the top
      command: hasValues
        ? { command: "editor.action.triggerSuggest", title: "Suggest" }
        : undefined,
    };
  }

  // New method to create attribute value completion items
  createAttributeValueCompletionItem(
    attribute: HTMLDataAttribute,
    value: HTMLDataAttributeValue,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tagName: string
  ): html.CompletionItem {
    return {
      label: value.name,
      kind: html.CompletionItemKind.Value,
      documentation: {
        kind: "markdown",
        value: value.description || `Value for ${attribute.name} attribute`,
      },
      insertText: value.name,
      filterText: value.name,
      sortText: "0" + value.name, // Sort at the top
      textEdit: {
        range: {
          start: {
            line: 0,
            character: 0,
          },
          end: {
            line: 0,
            character: 0,
          },
        }, // This will be set by the completion provider
        newText: value.name,
      },
    };
  }

  // Add new methods for definition provider
  createTagDefinitionLocation(
    _tagName: string,
    manifestPath: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _position: number
  ): html.Location | null {
    try {
      // For macOS, the proper format is file:///absolute/path
      const fullPath = manifestPath.startsWith("/")
        ? manifestPath
        : `/${manifestPath}`;

      // Format the URI with proper encoding
      const uri = `file://${fullPath}`;

      // Create a Location object that VSCode can navigate to
      const location = {
        uri: uri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 },
        },
      };

      return location;
    } catch {
      return null;
    }
  }

  createAttributeDefinitionLocation(
    _tagName: string,
    _attributeName: string,
    manifestPath: string,
    position: number
  ): html.Location | null {
    // Create a Location object that VSCode can navigate to
    return {
      uri: `file://${manifestPath}`,
      range: this.createRangeFromPosition(position),
    };
  }

  // Helper to create a range from a position
  private createRangeFromPosition(position: number): html.Range {
    try {
      // For a JSON file, we'll convert the flat position to a line/character
      // This is a simplified calculation but might be more accurate
      // than just using the flat position

      // Assuming an average line length of 40 characters for JSON
      const averageLineLength = 40;
      const estimatedLine = Math.floor(position / averageLineLength);
      const estimatedChar = position % averageLineLength;

      return {
        start: { line: estimatedLine, character: estimatedChar },
        end: { line: estimatedLine, character: estimatedChar + 10 },
      };
    } catch (error) {
      console.error("Error creating range:", error);
      return {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      };
    }
  }

  // Add this method to your VSCodeAdapter class
  createCompletionList(elements: cem.CustomElement[]): html.CompletionList {
    const completionItems: html.CompletionItem[] = [];

    for (const element of elements) {
      if (element.tagName) {
        completionItems.push({
          label: element.tagName,
          kind: html.CompletionItemKind.Property,
          documentation: element.description,
          insertText: `<${element.tagName}>$0</${element.tagName}>`,
          insertTextFormat: html.InsertTextFormat.Snippet,
          detail: "Custom Element",
        });
      }
    }

    return {
      isIncomplete: false,
      items: completionItems,
    };
  }

  createDiagnostic(
    range: html.Range,
    message: string,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error
  ): html.Diagnostic {
    return {
      range,
      message,
      severity,
      source: "web-components",
    };
  }
}
