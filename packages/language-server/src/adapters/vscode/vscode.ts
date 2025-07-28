import {
  HTMLDataAttribute,
  HTMLDataTag,
  HTMLDataAttributeValue,
  LanguageServerAdapter,
} from "../types";
import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };
import {
  Component,
  getComponentDetailsTemplate,
  getMemberDescription,
} from "@wc-toolkit/cem-utilities";

export class VSCodeAdapter implements LanguageServerAdapter {
  htmlDataProvider!: html.IHTMLDataProvider;

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

  /**
   * Creates completion items for all custom elements.
   * @param customElements Map of custom element tag names to their definitions
   * @returns Array of completion items for custom element tags
   */
  createCustomElementCompletionItems(
    customElements: Map<string, Component>
  ): html.CompletionItem[] {
    const items: html.CompletionItem[] = [];

    for (const [tagName, element] of customElements) {
      const description = getComponentDetailsTemplate(element);

      items.push({
        label: tagName,
        kind: html.CompletionItemKind.Property,
        documentation: {
          kind: "markdown",
          value: description,
        },
        insertText: `${tagName}>$0</${tagName}>`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: "Custom Element",
        sortText: "0" + tagName, // Sort custom elements first
      });
    }

    return items;
  }

  /**
   * Creates hover information for a custom element tag.
   * @param tagName The tag name to get hover info for
   * @param element The custom element definition
   * @returns Hover information object
   */
  createElementHoverInfo(
    tagName: string,
    element: cem.CustomElement
  ): html.Hover {
    const description = element.description || `Custom element: ${tagName}`;
    return {
      contents: {
        kind: "markdown",
        value: description,
      },
    };
  }

  /**
   * Creates HTML data from custom elements manifest data
   * @param customElements Map of custom element tag names to their definitions
   * @param attributeOptions Map of attribute names to their options data
   * @param findPositionInManifest Function to find position of attributes in the manifest
   * @returns HTML data provider for VS Code integration
   */
  createHTMLDataFromCustomElements(
    customElements: Map<string, cem.CustomElement>,
    attributeOptions: Map<string, string[] | string>,
    findPositionInManifest: (searchText: string) => number
  ): html.IHTMLDataProvider {
    const tags: HTMLDataTag[] = [];

    for (const [tagName, element] of customElements) {
      const attributes = this.extractAttributesForAutoComplete(
        element,
        attributeOptions,
        findPositionInManifest
      );

      tags.push({
        name: tagName,
        description: element.description || `Custom element: ${tagName}`,
        attributes: attributes,
      });
    }

    // Create HTML data provider
    return this.createHTMLDataProvider(tags);
  }

  /**
   * Extracts attribute definitions from a custom element.
   * @param element The custom element to extract attributes from
   * @param attributeOptions Map of attribute names to their options data
   * @param findPositionInManifest Function to find position of attributes in the manifest
   * @returns Array of HTML data attributes with metadata
   */
  extractAttributesForAutoComplete(
    element: cem.CustomElement,
    attributeOptions: Map<string, string[] | string>,
    findPositionInManifest: (searchText: string) => number
  ): HTMLDataAttribute[] {
    const attributes: HTMLDataAttribute[] = [];

    for (const attr of element?.attributes || []) {
      // Find position in the manifest file
      const attrPosition = findPositionInManifest(
        `"attribute": "${attr.name}"`
      );

      // Get the attribute type from the field
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typeText =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (attr as any)["parsedType"]?.text || attr.type?.text || "";

      const attrOptions = attributeOptions.get(
        `${element.tagName}:${attr.name}`
      );
      const attrValues = Array.isArray(attrOptions)
        ? attrOptions.map((option) => {
            return {
              name: option,
              description: `Value: ${option}`,
            };
          })
        : [];

      // Create attribute with more info
      attributes.push({
        name: attr.name,
        description: getMemberDescription(attr.description, attr.deprecated),
        type: typeText,
        // Add possible values for enum types
        values: attrValues,
        // Store the position
        sourcePosition: attrPosition,
      });
    }

    return attributes;
  }

  /**
   * Creates completion items for attributes of a custom element
   * @param element The custom element
   * @param tagName The tag name
   * @param attributeOptions Map of attribute names to their options
   * @param findPositionInManifest Function to find position in manifest
   * @returns Array of attribute completion items
   */
  createAttributeCompletionItems(
    element: cem.CustomElement,
    tagName: string,
    attributeOptions: Map<string, string[] | string>,
    findPositionInManifest: (searchText: string) => number
  ): html.CompletionItem[] {
    if (!element || !this.createAttributeCompletionItem) return [];

    const attributes = this.extractAttributesForAutoComplete(
      element,
      attributeOptions,
      findPositionInManifest
    );

    const completions: html.CompletionItem[] = [];
    for (const attr of attributes) {
      completions.push(this.createAttributeCompletionItem(attr, tagName));
    }
    return completions;
  }

  /**
   * Creates completion items for attribute values
   * @param element The custom element
   * @param tagName The tag name
   * @param attributeName The attribute name
   * @param attributeOptions Map of attribute names to their options
   * @param findPositionInManifest Function to find position in manifest
   * @returns Array of attribute value completion items
   */
  createAttributeValueCompletionItems(
    element: cem.CustomElement,
    tagName: string,
    attributeName: string,
    attributeOptions: Map<string, string[] | string>,
    findPositionInManifest: (searchText: string) => number
  ): html.CompletionItem[] {
    if (!element || !this.createAttributeValueCompletionItem) return [];

    const attributes = this.extractAttributesForAutoComplete(
      element,
      attributeOptions,
      findPositionInManifest
    );

    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (!attribute || !attribute.values) return [];

    return attribute.values.map((value) =>
      this.createAttributeValueCompletionItem(attribute, value, tagName)
    );
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

  /**
   * Creates a completion item for an attribute of a custom element
   * @param attribute The attribute data
   * @param tagName The name of the parent custom element
   * @returns A completion item for the attribute
   */
  createAttributeCompletionItem(
    attribute: HTMLDataAttribute,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tagName: string
  ): html.CompletionItem {
    const hasValues = attribute.values && attribute.values.length > 0;

    const documentation =
      getMemberDescription(attribute.description, attribute.deprecated) +
      (attribute.type ? `\n\n**Type:** \`${attribute.type}\`` : "");

    return {
      label: attribute.name,
      kind: html.CompletionItemKind.Property,
      documentation: {
        kind: "markdown",
        value: documentation,
      },
      insertText: hasValues
        ? `${attribute.name}="$1"$0`
        : `${attribute.name}="$0"`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      filterText: attribute.name,
      sortText: "0" + attribute.name, // Sort at the top
      command: hasValues
        ? { command: "editor.action.triggerSuggest", title: "Suggest" }
        : undefined,
    };
  }

  /**
   * Creates a completion item for an attribute value
   * @param attribute The parent attribute data
   * @param value The attribute value data
   * @param tagName The name of the parent custom element
   * @returns A completion item for the attribute value
   */
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
  createCompletionList(elements: Component[]): html.CompletionList {
    const completionItems: html.CompletionItem[] = [];

    for (const element of elements) {
      if (element.tagName) {
        completionItems.push({
          label: element.tagName,
          kind: html.CompletionItemKind.Property,
          documentation: {
            kind: "markdown",
            value: getComponentDetailsTemplate(element),
          },
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

  initializeHTMLDataProvider(
    customElementsMap: Map<string, Component>,
    attributeOptions: unknown,
    findPositionCallback: (searchText: string) => number
  ): void {
    // Convert attributeOptions to the expected type if needed
    // If attributeOptions is already a Map<string, string[] | string>, you can cast it directly
    const attributeOptionsMap = attributeOptions as Map<
      string,
      string[] | string
    >;

    // The findPositionCallback should return a number, so cast if necessary
    const findPosition = (searchText: string) => {
      const result = findPositionCallback(searchText);
      return typeof result === "number" ? result : Number(result);
    };

    // Use the adapter's method to create the HTML data provider
    this.htmlDataProvider = this.createHTMLDataFromCustomElements(
      customElementsMap as Map<string, cem.CustomElement>,
      attributeOptionsMap,
      findPosition
    );
  }
}
