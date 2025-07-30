import * as html from "vscode-html-languageservice";
import { LocationLink } from "vscode-languageserver-types";
import { VsCodeHtmlCompletionService } from "./html-completion-service";
import { VsCodeHtmlValidationService } from "./html-validation-service";
import { CustomElementsService } from "../../services/custom-elements-service";

/**
 * Service that provides HTML language features with custom element support.
 * Extends the VS Code HTML language service with custom element definitions,
 * completions, hover information, and diagnostics.
 */
export class CustomHtmlService {
  /** Service for managing custom element definitions and data */
  private customElementsService: CustomElementsService;

  /** Service for handling HTML completions */
  private htmlCompletionService: VsCodeHtmlCompletionService;

  /** Service for handling HTML validation */
  private htmlValidationService: VsCodeHtmlValidationService;

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

    // Create HTML completion service
    this.htmlCompletionService = new VsCodeHtmlCompletionService(
      this.customElementsService
    );

    // Create HTML validation service
    this.htmlValidationService = new VsCodeHtmlValidationService(
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
    position: html.Position
  ): LocationLink[] | null {
    const text = document.getText();
    const offset = document.offsetAt(position);
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
    const tagName = this.findContainingTag(text, position, offset);
    if (!tagName || !this.customElementsService.hasCustomElement(tagName)) {
      return null;
    }

    const element = this.customElementsService.getCustomElement(tagName);
    if (!element) return null;

    const attribute = element.attributes?.find((attr) => attr.name === currentWord);
    if (!attribute) return null;

    const attrPosition = this.customElementsService.findPositionInManifest(currentWord);
    const attributeDefinition = this.htmlCompletionService.createAttributeDefinitionLocation(
      tagName,
      currentWord,
      manifestPath,
      attrPosition
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
    return this.htmlValidationService.provideDiagnostics(
      document,
      this.htmlLanguageService
    );
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
}
