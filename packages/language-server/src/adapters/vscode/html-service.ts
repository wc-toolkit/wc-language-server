import * as html from "vscode-html-languageservice";
import { LocationLink } from "vscode-languageserver-types";
import { htmlCompletionService } from "./html-completion-service";
import { htmlValidationService } from "./html-validation-service";
import { customElementsService } from "../../services/custom-elements-service";

/**
 * Simplified service that provides HTML language features with custom element support.
 * Acts as a thin coordinator between the plugin system and specialized services.
 */
export class CustomHtmlService {
  private htmlLanguageService = html.getLanguageService({
    useDefaultDataProvider: true,
  });

  // Direct delegation - no additional logic needed
  public provideCompletionItems(
    document: html.TextDocument,
    position: html.Position,
  ) {
    return htmlCompletionService.provideCompletionItems(document, position);
  }

  public provideHover(
    document: html.TextDocument,
    position: html.Position,
  ): html.Hover | null {
    return htmlCompletionService.provideHover(document, position);
  }

  public provideDiagnostics(document: html.TextDocument) {
    return htmlValidationService.provideDiagnostics(
      document,
      this.htmlLanguageService,
    );
  }

  // Simplified definition provider using HTML parsing
  public provideDefinition(
    document: html.TextDocument,
    position: html.Position,
  ): LocationLink[] | null {
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      document.getText(),
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);
    const offset = textDocument.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);

    if (!node) return null;

    // Handle tag definitions
    if (node.tag && customElementsService.hasCustomElement(node.tag)) {
      const definition = htmlCompletionService.getTagDefinition(node.tag);
      return definition ? [this.locationToLocationLink(definition)] : null;
    }

    // Handle attribute definitions
    if (node.tag && node.attributes) {
      const element = customElementsService.getCustomElement(node.tag);
      if (!element) return null;

      // Find which attribute we're hovering over
      const attributeName = this.findAttributeAtPosition(
        document,
        node,
        position,
      );
      if (
        !attributeName ||
        !element.attributes?.some((attr) => attr.name === attributeName)
      ) {
        return null;
      }

      const definition = htmlCompletionService.getAttributeDefinition(
        node.tag,
        attributeName,
      );
      return definition ? [this.locationToLocationLink(definition)] : null;
    }

    return null;
  }

  public dispose() {
    customElementsService.dispose();
  }

  // Helper to find which attribute is at the cursor position
  private findAttributeAtPosition(
    document: html.TextDocument,
    node: html.Node,
    position: html.Position,
  ): string | null {
    if (!node.attributes) return null;

    const text = document.getText();
    const cursorOffset = document.offsetAt(position);

    // Simple approach: find attribute names around the cursor position
    for (const attrName in node.attributes) {
      const tagText = text.slice(node.start, node.end);
      const attrIndex = tagText.indexOf(attrName);

      if (attrIndex !== -1) {
        const attrStart = node.start + attrIndex;
        const attrEnd = attrStart + attrName.length;

        if (cursorOffset >= attrStart && cursorOffset <= attrEnd) {
          return attrName;
        }
      }
    }

    return null;
  }

  // Helper to convert Location to LocationLink
  private locationToLocationLink(location: html.Location): LocationLink {
    return {
      targetUri: location.uri,
      targetRange: location.range,
      targetSelectionRange: location.range,
    };
  }
}

// Singleton instance holder and factory
let _singletonService: CustomHtmlService | undefined;

/**
 * Returns a singleton instance of CustomHtmlService for the given services.
 * If called multiple times with the same arguments, returns the same instance.
 */
function getVsCodeHtmlCompletionService(): CustomHtmlService {
  if (!_singletonService) {
    _singletonService = new CustomHtmlService();
  }
  return _singletonService;
}

export const customHtmlService = getVsCodeHtmlCompletionService();
