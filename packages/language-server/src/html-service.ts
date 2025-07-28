import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity, LocationLink } from "vscode-languageserver-types";
import { CustomElementsService } from "./custom-elements-service";
import { HtmlCompletionService } from "./html-completion-service";
import { VSCodeAdapter } from "./adapters";

/**
 * Service that provides HTML language features with custom element support.
 * Extends the VS Code HTML language service with custom element definitions,
 * completions, hover information, and diagnostics.
 */
export class CustomHtmlService {
  /** Service for managing custom element definitions and data */
  private customElementsService: CustomElementsService;

  /** Service for handling HTML completions */
  private htmlCompletionService: HtmlCompletionService;

  /** VS Code adapter for language server operations */
  private adapter: VSCodeAdapter;

  /** VS Code HTML language service instance */
  private htmlLanguageService!: html.LanguageService;

  /** Unsubscribe function for manifest change listener */
  private unsubscribeFromChanges: (() => void) | null = null;

  /**
   * Creates a new CustomHtmlService instance.
   * @param workspaceRoot - Root directory of the workspace
   */
  constructor(workspaceRoot: string) {
    // Create custom elements service (no adapter dependency)
    this.customElementsService = new CustomElementsService(workspaceRoot);

    // Create adapter separately
    this.adapter = new VSCodeAdapter();

    // Create HTML completion service
    this.htmlCompletionService = new HtmlCompletionService(
      this.adapter,
      this.customElementsService
    );

    // Create HTML language service with custom data
    this.recreateHtmlLanguageService();
  }

  /**
   * Recreates the HTML language service with updated data providers.
   */
  private recreateHtmlLanguageService() {
    const htmlDataProvider = this.htmlCompletionService.getHTMLDataProvider();

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
    return this.htmlCompletionService.provideCompletionItems(document, position);
  }

  /**
   * Provides hover information for custom elements and standard HTML.
   * @param document - The text document containing the symbol
   * @param position - The cursor position on the symbol
   * @returns Hover information or null if no hover is available
   */
  public provideHover(
    document: html.TextDocument,
    position: html.Position
  ): html.Hover | null {
    return this.htmlCompletionService.provideHover(document, position);
  }

  /**
   * Provides definition links for custom elements and their attributes.
   * @param document - The text document containing the symbol
   * @param position - The cursor position on the symbol
   * @returns Definition location or null if no definition is found
   */
  public provideDefinition(
    document: html.TextDocument,
    cursorPosition: html.Position
  ): LocationLink[] | null {
    const text = document.getText();
    const offset = document.offsetAt(cursorPosition);
    const currentWord = this.getCurrentWord(text, offset);

    if (!currentWord) {
      return null;
    }

    const manifestPath = this.customElementsService.getManifestPath();
    if (!manifestPath) {
      return null;
    }

    // Check if the word is a custom element tag
    if (this.customElementsService.hasCustomElement(currentWord)) {
      const definition = this.htmlCompletionService.getTagDefinition(currentWord);
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
    const tagName = this.findContainingTag(text, cursorPosition, offset);
    if (!tagName || !this.customElementsService.hasCustomElement(tagName)) {
      return null;
    }

    const element = this.customElementsService.getCustomElement(tagName);
    if (!element) return null;

    const attribute = element.attributes?.find((attr) => attr.name === currentWord);
    if (!attribute) return null;

    const position = this.customElementsService.findPositionInManifest(currentWord);
    const attributeDefinition = this.adapter.createAttributeDefinitionLocation(
      tagName,
      currentWord,
      manifestPath,
      position
    );

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
    const htmlDocument = this.htmlLanguageService.parseHTMLDocument(textDocument);

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
    if (this.unsubscribeFromChanges) {
      this.unsubscribeFromChanges();
    }
    this.customElementsService.dispose();
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
    if (!this.customElementsService.hasCustomElement(tagName)) {
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
        const range = this.findAttributeRange(document, node, attrName);

        if (!range) {
          continue;
        }

        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: range,
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
   * Finds the range of a specific attribute within an HTML element.
   * @param document - The text document
   * @param node - The HTML node containing the attribute
   * @param attrName - The name of the attribute to find
   * @returns The range of the attribute or null if not found
   */
  private findAttributeRange(
    document: html.TextDocument,
    node: html.Node,
    attrName: string
  ): html.Range | null {
    const text = document.getText();
    
    // Find the start of the element
    const elementStart = node.start;
    const elementEnd = node.end;

    // Extract the element text
    const elementText = text.substring(elementStart, elementEnd);

    // Look for the attribute with a more precise regex
    const attrRegex = new RegExp(`\\s(${attrName})\\s*=\\s*["']([^"']*)["']`, "g");
    const match = attrRegex.exec(elementText);

    if (!match) {
      return null;
    }

    // Calculate the start position of just the attribute name and value
    const attrStart = elementStart + match.index + 1; // +1 to skip the space before attribute
    const attrEnd = attrStart + match[1].length + match[2].length + 3; // +3 for ="" or =''

    return {
      start: document.positionAt(attrStart),
      end: document.positionAt(attrEnd),
    };
  }
}
