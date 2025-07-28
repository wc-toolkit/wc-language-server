import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity, LocationLink } from "vscode-languageserver-types";
import { CustomElementsService } from "./custom-elements-service";
import { VSCodeAdapter } from "./adapters";
import {
  LanguageServiceContext,
  LanguageServicePlugin,
} from "@volar/language-server";

/**
 * Service that provides HTML language features with custom element support.
 * Extends the VS Code HTML language service with custom element definitions,
 * completions, hover information, and diagnostics.
 */
export class CustomHtmlService {
  /** Service for managing custom element definitions and data */
  private customElementsService: CustomElementsService;

  /** VS Code HTML language service instance */
  private htmlLanguageService: html.LanguageService;

  /**
   * Creates a new CustomHtmlService instance.
   * @param workspaceRoot - Root directory of the workspace
   * @param adapter - Optional VS Code adapter for file system operations
   */
  constructor(workspaceRoot: string, adapter?: VSCodeAdapter) {
    // Create custom elements service with adapter
    this.customElementsService = new CustomElementsService(
      workspaceRoot,
      adapter || new VSCodeAdapter()
    );

    // Get HTML data provider from custom elements service
    const htmlDataProvider = this.customElementsService.getHTMLDataProvider();

    // Create HTML language service with custom data
    this.htmlLanguageService = html.getLanguageService({
      customDataProviders: htmlDataProvider ? [htmlDataProvider] : [],
      useDefaultDataProvider: true,
    });
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
  ) {
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
  public provideHover(document: html.TextDocument, position: html.Position) {
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      document.getText()
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    return this.htmlLanguageService.doHover(
      textDocument,
      position,
      htmlDocument
    );
  }

  /**
   * Provides definition links for custom elements and their attributes.
   * @param document - The text document containing the symbol
   * @param position - The cursor position on the symbol
   * @returns Definition location or null if no definition is found
   */
  public provideDefinition(
    document: html.TextDocument,
    position: html.Position
  ): LocationLink[] | null {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const currentWord = this.getCurrentWord(text, offset);

    if (!currentWord) {
      return null;
    }

    // Check if the word is a custom element tag
    if (this.customElementsService.getTagNames().includes(currentWord)) {
      const definition =
        this.customElementsService.getTagDefinition(currentWord);
      if (!definition) {
        return null;
      }
      // Convert Location to LocationLink[]
      return [
        {
          targetUri: definition.uri,
          targetRange: definition.range,
          targetSelectionRange: definition.range,
        },
      ];
    }

    // Check if the word is an attribute
    const tagName = this.findContainingTag(text, position, offset);
    if (!tagName) {
      return null;
    }

    const attributeDefinition =
      this.customElementsService.getAttributeDefinition(tagName, currentWord);

    if (!attributeDefinition) {
      return null;
    }

    // Convert Location to LocationLink[]
    return [
      {
        targetUri: attributeDefinition.uri,
        targetRange: attributeDefinition.range,
        targetSelectionRange: attributeDefinition.range,
      },
    ];
  }

  /**
   * Provides diagnostic information for HTML documents with custom element validation.
   * @param document - The text document to validate
   * @returns Array of diagnostic messages for validation errors
   */
  public provideDiagnostics(document: html.TextDocument) {
    const text = document.getText();
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      text
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    const diagnostics: html.Diagnostic[] = [];

    // Process each element in the document
    for (const node of htmlDocument.roots) {
      this.validateNode(node, document, diagnostics);
    }

    return diagnostics;
  }

  /**
   * Disposes of the service and cleans up resources.
   */
  public dispose() {
    this.customElementsService.dispose();
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
  ) {
    // Get completions from HTML service
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    // Add custom element completions without the opening '<' since it's already typed
    const customCompletions = this.customElementsService.getCompletionItems();

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
  ) {
    const attrNameMatch = beforeText.match(
      /<([a-zA-Z0-9-]+)(?:\s+[a-zA-Z0-9-]+(=(?:["'][^"']*["'])?))*\s+([a-zA-Z0-9-]*)$/
    );

    if (!attrNameMatch) {
      return null;
    }

    const tagName = attrNameMatch[1];

    // Get default HTML attribute completions
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    // Add custom element attribute completions
    const customAttrCompletions =
      this.customElementsService.getAttributeCompletions(tagName);
    htmlCompletions.items.push(...customAttrCompletions);

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
  ) {
    const attrValueMatch = beforeText.match(
      /<([a-zA-Z0-9-]+)\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/
    );

    if (!attrValueMatch) {
      return null;
    }

    const tagName = attrValueMatch[1];
    const attrName = attrValueMatch[2];

    // Let HTML service handle it first for standard attributes
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    // Add custom attribute value completions
    const customValueCompletions =
      this.customElementsService.getAttributeValueCompletions(
        tagName,
        attrName
      );

    // Set the range for each completion item for proper replacement
    if (customValueCompletions.length === 0) {
      return htmlCompletions;
    }

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
    return htmlCompletions;
  }

  /**
   * Extracts the current word at the specified offset in the text.
   * @param text - The full text content
   * @param offset - The character offset position
   * @returns The word at the offset or null if no word is found
   */
  private getCurrentWord(text: string, offset: number): string | null {
    const wordPattern = /[a-zA-Z0-9-]+/;
    let wordStart = offset;
    let wordEnd = offset;

    // Find word start
    while (wordStart > 0 && wordPattern.test(text[wordStart - 1])) {
      wordStart--;
    }

    // Find word end
    while (wordEnd < text.length && wordPattern.test(text[wordEnd])) {
      wordEnd++;
    }

    if (wordStart === wordEnd) {
      return null;
    }

    return text.substring(wordStart, wordEnd);
  }

  /**
   * Finds the HTML tag that contains the specified position.
   * @param text - The full text content
   * @param position - The cursor position
   * @param offset - The character offset position
   * @returns The tag name containing the position or null if not found
   */
  private findContainingTag(
    text: string,
    position: html.Position,
    offset: number
  ): string | null {
    const textDocument = html.TextDocument.create("", "html", 0, text);
    const scanner = this.htmlLanguageService.createScanner(text);
    let tagName = "";
    let token = scanner.scan();

    while (token !== html.TokenType.EOS) {
      if (token !== html.TokenType.StartTag) {
        token = scanner.scan();
        continue;
      }

      const currentTagName = scanner.getTokenText();
      const tagRange = {
        start: textDocument.positionAt(scanner.getTokenOffset()),
        end: textDocument.positionAt(scanner.getTokenEnd()),
      };

      // If the tag contains our position
      if (
        position.line >= tagRange.start.line &&
        position.character >= tagRange.start.character &&
        scanner.getTokenEnd() > offset
      ) {
        tagName = currentTagName;
        break;
      }

      token = scanner.scan();
    }

    return tagName || null;
  }

  /**
   * Validates an HTML node and its attributes for custom element compliance.
   * @param node - The HTML node to validate
   * @param document - The text document containing the node
   * @param diagnostics - Array to append diagnostic messages to
   */
  private validateNode(
    node: html.Node,
    document: html.TextDocument,
    diagnostics: html.Diagnostic[]
  ) {
    // Only process element nodes
    if (!node.tag) {
      // Process child nodes recursively
      if (node.children) {
        for (const child of node.children) {
          this.validateNode(child, document, diagnostics);
        }
      }
      return;
    }

    const tagName = node.tag;

    // Check if this is a custom element we know about
    if (!this.customElementsService.getTagNames().includes(tagName)) {
      // Process child nodes recursively
      if (node.children) {
        for (const child of node.children) {
          this.validateNode(child, document, diagnostics);
        }
      }
      return;
    }

    // Validate each attribute
    if (node.attributes) {
      for (const [attrName, attrValue] of Object.entries(node.attributes)) {
        if (typeof attrValue !== "string") {
          continue;
        }

        // Validate the attribute value
        const errorMessage = this.customElementsService.validateAttributeValue(
          tagName,
          attrName,
          attrValue
        );

        // If there's no error, continue
        if (!errorMessage) {
          continue;
        }

        // Find the attribute position in the document
        const startOffset = this.findAttributeOffset(
          document.getText(),
          node,
          attrName
        );

        if (startOffset === -1) {
          continue;
        }

        const startPos = document.positionAt(startOffset);
        const endPos = document.positionAt(
          startOffset + attrName.length + attrValue.length + 1
        ); // +1 for ="

        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: startPos,
            end: endPos,
          },
          message: errorMessage,
          source: "web-components",
        });
      }
    }

    // Process child nodes recursively
    if (node.children) {
      for (const child of node.children) {
        this.validateNode(child, document, diagnostics);
      }
    }
  }

  /**
   * Finds the character offset of a specific attribute within an HTML element.
   * @param text - The full text content
   * @param node - The HTML node containing the attribute
   * @param attrName - The name of the attribute to find
   * @returns The character offset of the attribute or -1 if not found
   */
  private findAttributeOffset(
    text: string,
    node: html.Node,
    attrName: string
  ): number {
    // Find the start of the element
    const elementStart = node.start;
    const elementEnd = node.end;

    // Extract the element text
    const elementText = text.substring(elementStart, elementEnd);

    // Look for the attribute
    const attrRegex = new RegExp(`\\s${attrName}\\s*=\\s*["']`, "g");
    const match = attrRegex.exec(elementText);

    if (!match) {
      return -1;
    }

    return elementStart + match.index + 1; // +1 to skip the initial space
  }
}

/**
 * Creates a language service plugin for custom HTML features.
 * @returns Plugin object with capabilities and service creation function
 */
export function createCustomHtmlServicePlugin(): LanguageServicePlugin {
  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: [
          "<",
          " ",
          "=",
          '"',
          "'",
          ">",
          "-",
          "a",
          "b",
          "c",
          "d",
          "e",
          "f",
          "g",
          "h",
          "i",
          "j",
          "k",
          "l",
          "m",
          "n",
          "o",
          "p",
          "q",
          "r",
          "s",
          "t",
          "u",
          "v",
          "w",
          "x",
          "y",
          "z",
        ],
      },
      hoverProvider: true,
      definitionProvider: true,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    /**
     * Creates the custom HTML service instance.
     * @param context - Language service context containing workspace information
     * @returns Service instance with bound methods
     */
    create(context: LanguageServiceContext) {
      const workspaceFolders = context.env?.workspaceFolders;
      // @ts-expect-error the type appears to be incorrect here
      const workspaceRoot = workspaceFolders?.[0]?.uri || "";

      const service = new CustomHtmlService(workspaceRoot);

      return {
        provideCompletionItems: service.provideCompletionItems.bind(service),
        provideHover: service.provideHover.bind(service),
        provideDefinition: service.provideDefinition.bind(service),
        provideDiagnostics: service.provideDiagnostics.bind(service),
        dispose: service.dispose.bind(service),
      };
    },
  };
}
