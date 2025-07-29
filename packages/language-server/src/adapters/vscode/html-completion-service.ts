import * as html from "vscode-html-languageservice";
import { HTMLDataAttribute, HTMLDataAttributeValue, HTMLDataTag } from "..";
import { CustomElementsService } from "../../custom-elements-service";
import {
  Component,
  getComponentDetailsTemplate,
  getMemberDescription,
} from "@wc-toolkit/cem-utilities";

/**
 * Service dedicated to handling HTML completions for custom elements.
 * Provides completion items, hover information, and validation for custom element attributes.
 */
export class VsCodeHtmlCompletionService {
  /** HTML data provider for VS Code HTML language service integration */
  private htmlDataProvider: html.IHTMLDataProvider | null = null;

  /** VS Code HTML language service instance */
  private htmlLanguageService!: html.LanguageService;

  /**
   * Creates a new HtmlCompletionService instance.
   * @param adapter - Language server adapter for creating completions and definitions
   * @param customElementsService - Service for accessing custom elements data
   */
  constructor(private customElementsService: CustomElementsService) {
    this.initializeHTMLLanguageService();
    this.setupManifestChangeListener();
  }

  /**
   * Sets up a listener for manifest changes to recreate the HTML language service.
   */
  private setupManifestChangeListener(): void {
    this.customElementsService.onManifestChange(() => {
      this.createHTMLData();
      this.initializeHTMLLanguageService();
    });
  }

  /**
   * Initializes the HTML language service with custom data providers.
   */
  private initializeHTMLLanguageService(): void {
    this.htmlLanguageService = html.getLanguageService({
      customDataProviders: this.htmlDataProvider ? [this.htmlDataProvider] : [],
      useDefaultDataProvider: true,
    });
  }

  /**
   * Creates HTML data for VS Code HTML language service integration.
   * Converts custom element definitions to HTML data format.
   */
  public createHTMLData(): void {
    // If the adapter doesn't support creating HTML data providers, we can't proceed
    if (!this.createHTMLDataFromCustomElements) {
      console.warn("Adapter does not support creating HTML data providers");
      return;
    }

    // Use the adapter to create the HTML data provider
    this.htmlDataProvider = this.createHTMLDataFromCustomElements(
      this.customElementsService.getCustomElementsMap(),
      this.customElementsService.getAttributeOptions(),
      (searchText: string) =>
        this.customElementsService.findPositionInManifest(searchText)
    );
  }

  /**
   * Creates HTML data from custom elements manifest data
   * @param customElements Map of custom element tag names to their definitions
   * @param attributeOptions Map of attribute names to their options data
   * @param findPositionInManifest Function to find position of attributes in the manifest
   * @returns HTML data provider for VS Code integration
   */
  createHTMLDataFromCustomElements(
    customElements: Map<string, Component>,
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
        description:
          getComponentDetailsTemplate(element) || `Custom element: ${tagName}`,
        attributes: attributes,
      });
    }

    // Create HTML data provider
    return this.createHTMLDataProvider(tags);
  }

  /**
   * Creates completion items for attributes of a custom element
   * @param element The custom element
   * @param _tagName The tag name
   * @param attributeOptions Map of attribute names to their options
   * @param findPositionInManifest Function to find position in manifest
   * @returns Array of attribute completion items
   */
  createAttributeCompletionItems(
    element: Component,
    _tagName: string,
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
      completions.push(this.createAttributeCompletionItem(attr));
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
    element: Component,
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

  /**
   * Creates a completion item for an attribute of a custom element
   * @param attribute The attribute data
   * @param tagName The name of the parent custom element
   * @returns A completion item for the attribute
   */
  createAttributeCompletionItem(
    attribute: HTMLDataAttribute
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

  /**
   * Extracts attribute definitions from a custom element.
   * @param element The custom element to extract attributes from
   * @param attributeOptions Map of attribute names to their options data
   * @param findPositionInManifest Function to find position of attributes in the manifest
   * @returns Array of HTML data attributes with metadata
   */
  extractAttributesForAutoComplete(
    element: Component,
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
   * Gets the HTML data provider for VS Code integration.
   * @returns The HTML data provider instance
   */
  public getHTMLDataProvider(): html.IHTMLDataProvider | null {
    return this.htmlDataProvider;
  }

  /**
   * Provides completion items for HTML documents with custom element support.
   * @param document - The text document being edited
   * @param position - The cursor position where completion was triggered
   * @returns Completion list containing both standard HTML and custom element completions
   */
  public provideCompletionItems(
    document: html.TextDocument,
    position: html.Position
  ): html.CompletionList {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const beforeText = text.substring(0, offset);

    // Create text document for HTML service
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      text
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    // Handle different completion scenarios
    if (this.isTagCompletion(beforeText)) {
      return this.handleTagCompletion(textDocument, position, htmlDocument);
    }

    if (this.isAttributeNameCompletion(beforeText)) {
      return this.handleAttributeNameCompletion(
        beforeText,
        textDocument,
        position,
        htmlDocument
      );
    }

    if (this.isAttributeValueCompletion(beforeText)) {
      return this.handleAttributeValueCompletion(
        beforeText,
        textDocument,
        position,
        htmlDocument
      );
    }

    // Default: Let HTML service handle all other completion scenarios
    return this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );
  }

  /**
   * Provides hover information for HTML elements and attributes.
   * @param document - The text document being hovered over
   * @param position - The cursor position where hover was triggered
   * @returns Hover information or null if no hover data is available
   */
  public provideHover(
    document: html.TextDocument,
    position: html.Position
  ): html.Hover | null {
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      document.getText()
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    const offset = textDocument.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    let element: Component | null = null;
    let attributes: HTMLDataAttribute[] = [];

    if (!node) {
      return this.htmlLanguageService.doHover(
        textDocument,
        position,
        htmlDocument
      );
    }

    if (node.tag) {
      element = this.customElementsService.getCustomElement(node.tag);
      if (element) {
        attributes = this.extractAttributesForAutoComplete(
          element,
          this.customElementsService.getAttributeOptions(),
          (searchText: string) =>
            this.customElementsService.findPositionInManifest(searchText)
        );
      }
    }

    // Attribute hover
    if (node.attributes) {
      const cursorOffset = document.offsetAt(position);

      for (const attrName in node.attributes) {
        const attrValue = node.attributes[attrName];

        // compute the start/end positions by searching for the attribute in the tag text
        const tagOffset = node.start;
        const tagText = document.getText().slice(tagOffset, node.end);
        const attrStart = tagText.indexOf(attrName);
        const attrEnd =
          attrStart + attrName.length + (attrValue ? attrValue.length : 0); // +2 for quotes if present

        if (
          cursorOffset >= tagOffset + attrStart &&
          cursorOffset <= tagOffset + attrEnd
        ) {
          // Show hover information for the attribute
          const attribute = attributes.find((a) => a.name === attrName);
          if (!attribute) {
            return null; // Skip if attribute not found
          }

          const description =
            getMemberDescription(attribute.description, attribute.deprecated) +
            `\n\n**Type:** \`${attribute.type}\``;

          return {
            contents: description,
          };
        }
      }
    }

    // Tag hover
    if (node.tag) {
      if (element) {
        return {
          contents: getComponentDetailsTemplate(element),
        };
      }
    }

    // Fallback to default hover
    return this.htmlLanguageService.doHover(
      textDocument,
      position,
      htmlDocument
    );
  }

  /**
   * Gets completion items for all custom elements.
   * @returns Array of completion items for custom element tags
   */
  public getCompletionItems(): html.CompletionItem[] {
    const customElements = this.customElementsService.getCustomElementsMap();

    if (this.createCustomElementCompletionItems) {
      return this.createCustomElementCompletionItems(customElements);
    }

    // Fallback for adapters that don't implement the new method
    const items: html.CompletionItem[] = [];
    for (const [tagName, element] of customElements) {
      const description =
        element.description || element.summary || `Custom element: ${tagName}`;
      items.push(this.createCompletionItem(tagName, description));
    }
    return items;
  }

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
   * Gets attribute completion items for a specific custom element tag.
   * @param tagName - The tag name to get attribute completions for
   * @returns Array of attribute completion items
   */
  public getAttributeCompletions(tagName: string): html.CompletionItem[] {
    const element = this.customElementsService.getCustomElement(tagName);
    if (!element || !this.createAttributeCompletionItems) return [];

    const result = this.createAttributeCompletionItems(
      element,
      tagName,
      this.customElementsService.getAttributeOptions(),
      (searchText: string) =>
        this.customElementsService.findPositionInManifest(searchText)
    );

    // Type guard to ensure we get completion items
    return Array.isArray(result) && result.length > 0 && "label" in result[0]
      ? (result as html.CompletionItem[])
      : [];
  }

  /**
   * Gets attribute value completion items for a specific attribute.
   * @param tagName - The tag name containing the attribute
   * @param attributeName - The attribute name to get value completions for
   * @returns Array of attribute value completion items
   */
  public getAttributeValueCompletions(
    tagName: string,
    attributeName: string
  ): html.CompletionItem[] {
    const element = this.customElementsService.getCustomElement(tagName);
    if (!element || !this.createAttributeValueCompletionItems) return [];

    return this.createAttributeValueCompletionItems(
      element,
      tagName,
      attributeName,
      this.customElementsService.getAttributeOptions(),
      (searchText: string) =>
        this.customElementsService.findPositionInManifest(searchText)
    );
  }

  /**
   * Checks if the current completion context is for HTML tag completion.
   * @param beforeText - Text content before the cursor position
   * @returns True if this is a tag completion scenario
   */
  private isTagCompletion(beforeText: string): boolean {
    return !!beforeText.match(/<([a-zA-Z0-9-]*)$/);
  }

  /**
   * Checks if the current completion context is for HTML attribute name completion.
   * @param beforeText - Text content before the cursor position
   * @returns True if this is an attribute name completion scenario
   */
  private isAttributeNameCompletion(beforeText: string): boolean {
    return !!beforeText.match(
      /<([a-zA-Z0-9-]+)(?:\s+[a-zA-Z0-9-]+(=(?:["'][^"']*["'])?))*\s+([a-zA-Z0-9-]*)$/
    );
  }

  /**
   * Checks if the current completion context is for HTML attribute value completion.
   * @param beforeText - Text content before the cursor position
   * @returns True if this is an attribute value completion scenario
   */
  private isAttributeValueCompletion(beforeText: string): boolean {
    return !!beforeText.match(
      /<([a-zA-Z0-9-]+)\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/
    );
  }

  /**
   * Handles completion for HTML tags, including custom elements.
   * @param textDocument - The HTML text document
   * @param position - The cursor position
   * @param htmlDocument - Parsed HTML document structure
   * @returns Completion list with both standard and custom element tags
   */
  private handleTagCompletion(
    textDocument: html.TextDocument,
    position: html.Position,
    htmlDocument: html.HTMLDocument
  ): html.CompletionList {
    // Get completions from HTML service
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    // Add custom element completions without the opening '<' since it's already typed
    const customCompletions = this.getCompletionItems();

    // Modify custom completions to not include the opening '<'
    const modifiedCustomCompletions = customCompletions.map((item) => ({
      ...item,
      insertText: item.insertText?.replace(/^</, "") || item.label,
    }));

    htmlCompletions.items.push(...modifiedCustomCompletions);

    return htmlCompletions;
  }

  /**
   * Handles completion for HTML attribute names on custom elements.
   * @param beforeText - Text content before the cursor position
   * @param textDocument - The HTML text document
   * @param position - The cursor position
   * @param htmlDocument - Parsed HTML document structure
   * @returns Completion list with attribute names or null if not applicable
   */
  private handleAttributeNameCompletion(
    beforeText: string,
    textDocument: html.TextDocument,
    position: html.Position,
    htmlDocument: html.HTMLDocument
  ): html.CompletionList {
    const attrNameMatch = beforeText.match(
      /<([a-zA-Z0-9-]+)(?:\s+[a-zA-Z0-9-]+(=(?:["'][^"']*["'])?))*\s+([a-zA-Z0-9-]*)$/
    );

    // Get default HTML attribute completions
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    if (attrNameMatch) {
      const tagName = attrNameMatch[1];

      // Add custom element attribute completions
      const customAttrCompletions = this.getAttributeCompletions(tagName);
      htmlCompletions.items.push(...customAttrCompletions);
    }

    return htmlCompletions;
  }

  /**
   * Handles completion for HTML attribute values on custom elements.
   * @param beforeText - Text content before the cursor position
   * @param textDocument - The HTML text document
   * @param position - The cursor position
   * @param htmlDocument - Parsed HTML document structure
   * @returns Completion list with attribute values or null if not applicable
   */
  private handleAttributeValueCompletion(
    beforeText: string,
    textDocument: html.TextDocument,
    position: html.Position,
    htmlDocument: html.HTMLDocument
  ): html.CompletionList {
    const attrValueMatch = beforeText.match(
      /<([a-zA-Z0-9-]+)\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/
    );

    // Let HTML service handle it first for standard attributes
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    if (attrValueMatch) {
      const tagName = attrValueMatch[1];
      const attrName = attrValueMatch[2];

      // Add custom attribute value completions
      const customValueCompletions = this.getAttributeValueCompletions(
        tagName,
        attrName
      );

      // Set the range for each completion item for proper replacement
      if (customValueCompletions.length > 0) {
        const attrValuePos =
          position.character - (attrValueMatch[3]?.length || 0);
        const valueRange = {
          start: { line: position.line, character: attrValuePos },
          end: position,
        };

        // Apply the range to each completion item's textEdit
        customValueCompletions.forEach((item) => {
          if (item.textEdit) {
            (item.textEdit as html.TextEdit).range = valueRange;
          }
        });

        htmlCompletions.items.push(...customValueCompletions);
      }
    }

    return htmlCompletions;
  }

  /**
   * Gets definition location for a custom element tag.
   * @param tagName - The tag name to get definition for
   * @returns Definition location or null if not found
   */
  public getTagDefinition(tagName: string) {
    const manifestPath = this.customElementsService.getManifestPath();
    if (!manifestPath) {
      return null;
    }

    const element = this.customElementsService.getCustomElement(tagName);
    if (!element) {
      return null;
    }

    const position = 0;

    return this.createTagDefinitionLocation?.(tagName, manifestPath, position);
  }

  /**
   * Gets definition location for a custom element attribute.
   * @param tagName - The tag name containing the attribute
   * @param attributeName - The attribute name to get definition for
   * @returns Definition location or null if not found
   */
  public getAttributeDefinition(tagName: string, attributeName: string) {
    const manifestPath = this.customElementsService.getManifestPath();
    if (!manifestPath) return null;

    const element = this.customElementsService.getCustomElement(tagName);
    if (!element || !this.createAttributeCompletionItems) return null;

    const attributesResult = this.createAttributeCompletionItems(
      element,
      tagName,
      this.customElementsService.getAttributeOptions(),
      (searchText: string) =>
        this.customElementsService.findPositionInManifest(searchText)
    );

    // Type guard to ensure we get HTML data attributes
    const attributes =
      Array.isArray(attributesResult) &&
      attributesResult.length > 0 &&
      "name" in attributesResult[0]
        ? (attributesResult as unknown as Array<{
            name: string;
            sourcePosition?: number;
          }>)
        : [];

    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (!attribute) return null;

    return this.createAttributeDefinitionLocation?.(
      tagName,
      attributeName,
      manifestPath,
      attribute.sourcePosition || 0
    );
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
}
