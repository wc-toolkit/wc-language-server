import * as html from "vscode-html-languageservice";
import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };
import { LanguageServerAdapter } from "./adapters";
import { CustomElementsService } from "./custom-elements-service";

/**
 * Service dedicated to handling HTML completions for custom elements.
 * Provides completion items, hover information, and validation for custom element attributes.
 */
export class HtmlCompletionService {
  /** HTML data provider for VS Code HTML language service integration */
  private htmlDataProvider: html.IHTMLDataProvider | null = null;

  /** VS Code HTML language service instance */
  private htmlLanguageService!: html.LanguageService;

  /**
   * Creates a new HtmlCompletionService instance.
   * @param adapter - Language server adapter for creating completions and definitions
   * @param customElementsService - Service for accessing custom elements data
   */
  constructor(
    private adapter: LanguageServerAdapter,
    private customElementsService: CustomElementsService
  ) {
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
    if (!this.adapter.createHTMLDataFromCustomElements) {
      console.warn("Adapter does not support creating HTML data providers");
      return;
    }

    // Use the adapter to create the HTML data provider
    this.htmlDataProvider = this.adapter.createHTMLDataFromCustomElements(
      this.customElementsService.getCustomElementsMap(),
      this.customElementsService.getAttributeOptions(),
      (searchText: string) => this.customElementsService.findPositionInManifest(searchText)
    );
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
    const htmlDocument = this.htmlLanguageService.parseHTMLDocument(textDocument);

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
    const htmlDocument = this.htmlLanguageService.parseHTMLDocument(textDocument);

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
    
    if (this.adapter.createCustomElementCompletionItems) {
      return this.adapter.createCustomElementCompletionItems(customElements);
    }

    // Fallback for adapters that don't implement the new method
    const items: html.CompletionItem[] = [];
    for (const [tagName, element] of customElements) {
      const description =
        element.description || element.summary || `Custom element: ${tagName}`;
      items.push(this.adapter.createCompletionItem(tagName, description));
    }
    return items;
  }

  /**
   * Gets hover information for a specific custom element tag.
   * @param tagName - The tag name to get hover info for
   * @param element - The custom element definition
   * @returns Hover information object or null if not found
   */
  public getHoverInfo(tagName: string, element: cem.CustomElement): html.Hover | null {
    if (this.adapter.createElementHoverInfo) {
      return this.adapter.createElementHoverInfo(tagName, element);
    }

    // Fallback
    const description = element.description || `Custom element: ${tagName}`;
    return {
      contents: {
        kind: "markdown",
        value: description,
      },
    };
  }

  /**
   * Gets attribute completion items for a specific custom element tag.
   * @param tagName - The tag name to get attribute completions for
   * @returns Array of attribute completion items
   */
  public getAttributeCompletions(tagName: string): html.CompletionItem[] {
    const element = this.customElementsService.getCustomElement(tagName);
    if (!element || !this.adapter.createAttributeCompletionItems) return [];

    const result = this.adapter.createAttributeCompletionItems(
      element,
      tagName,
      this.customElementsService.getAttributeOptions(),
      (searchText: string) => this.customElementsService.findPositionInManifest(searchText),
    );

    // Type guard to ensure we get completion items
    return Array.isArray(result) && result.length > 0 && 'label' in result[0] 
      ? result as html.CompletionItem[]
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
    if (!element || !this.adapter.createAttributeValueCompletionItems) return [];

    return this.adapter.createAttributeValueCompletionItems(
      element,
      tagName,
      attributeName,
      this.customElementsService.getAttributeOptions(),
      (searchText: string) => this.customElementsService.findPositionInManifest(searchText)
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
        const attrValuePos = position.character - (attrValueMatch[3]?.length || 0);
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

    return this.adapter.createTagDefinitionLocation?.(
      tagName,
      manifestPath,
      position
    );
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
    if (!element || !this.adapter.createAttributeCompletionItems) return null;

    const attributesResult = this.adapter.createAttributeCompletionItems(
      element,
      tagName,
      this.customElementsService.getAttributeOptions(),
      (searchText: string) => this.customElementsService.findPositionInManifest(searchText),
    );

    // Type guard to ensure we get HTML data attributes
    const attributes = Array.isArray(attributesResult) && 
                      attributesResult.length > 0 && 
                      'name' in attributesResult[0]
      ? attributesResult as unknown as Array<{ name: string; sourcePosition?: number }>
      : [];

    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (!attribute) return null;

    return this.adapter.createAttributeDefinitionLocation?.(
      tagName,
      attributeName,
      manifestPath,
      attribute.sourcePosition || 0
    );
  }
}