import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { removeQuotes } from "@wc-toolkit/cem-utilities";
import { customElementsService } from "../../services/custom-elements-service";
import { configurationService } from "../../services/configuration-service";

/**
 * Service for validating custom element attributes in HTML documents.
 */
export class VsCodeHtmlValidationService {
  /**
   * Main entry point - provides all diagnostics for a document.
   */
  public provideDiagnostics(
    document: html.TextDocument,
    htmlLanguageService: html.LanguageService
  ): html.Diagnostic[] {
    const textDocument = html.TextDocument.create(document.uri, "html", 0, document.getText());
    const htmlDocument = htmlLanguageService.parseHTMLDocument(textDocument);
    const diagnostics: html.Diagnostic[] = [];

    this.validateNodes(htmlDocument.roots, document, diagnostics);
    return diagnostics;
  }

  /**
   * Recursively validates all nodes in the document.
   */
  private validateNodes(nodes: html.Node[], document: html.TextDocument, diagnostics: html.Diagnostic[]): void {
    for (const node of nodes) {
      this.validateSingleNode(node, document, diagnostics);
      
      if (node.children) {
        this.validateNodes(node.children, document, diagnostics);
      }
    }
  }

  /**
   * Validates a single node's attributes if it's a custom element.
   */
  private validateSingleNode(node: html.Node, document: html.TextDocument, diagnostics: html.Diagnostic[]): void {
    if (!node.tag || !node.attributes || !customElementsService.hasCustomElement(node.tag)) {
      return;
    }

    for (const [attrName, attrValue] of Object.entries(node.attributes)) {
      if (typeof attrValue !== "string") continue;

      const validation = this.validateAttributeValue(node.tag, attrName, attrValue);
      if (!validation) continue;

      const range = this.findAttributeRange(document, node, attrName);
      if (!range) continue;

      diagnostics.push({
        severity: this.getSeverityLevel(validation.type),
        range,
        message: validation.error,
        source: "web-components",
      });
    }
  }

  /**
   * Validates a single attribute value against its schema.
   */
  private validateAttributeValue(tagName: string, attributeName: string, value: string): { error: string; type: 'invalidBoolean' | 'invalidNumber' | 'invalidAttributeValue' } | null {
    const cleanValue = removeQuotes(value);
    const attrOptions = customElementsService.getAttributeValueOptions(tagName, attributeName);

    // No validation possible or needed
    if (!cleanValue || !attrOptions || attrOptions === "string" || attrOptions.includes("string & {}")) {
      return null;
    }

    // Boolean attributes shouldn't have values
    if (attrOptions === "boolean") {
      return {
        error: `The attribute "${attributeName}" is boolean and should not have a value.`,
        type: 'invalidBoolean'
      };
    }

    // Number validation
    if (attrOptions === "number" && isNaN(Number(cleanValue))) {
      return {
        error: `The value for "${attributeName}" must be a valid number.`,
        type: 'invalidNumber'
      };
    }

    // Enum validation
    if (Array.isArray(attrOptions) && !attrOptions.includes(cleanValue)) {
      return {
        error: `The value "${cleanValue}" is not valid for "${attributeName}". Allowed values: ${attrOptions.join(" | ")}`,
        type: 'invalidAttributeValue'
      };
    }

    return null;
  }

  /**
   * Maps configuration severity to VSCode DiagnosticSeverity.
   */
  private getSeverityLevel(type: 'invalidBoolean' | 'invalidNumber' | 'invalidAttributeValue'): DiagnosticSeverity {
    const configSeverity = configurationService?.config?.diagnosticSeverity?.[type] || 'error';
    
    switch (configSeverity) {
      case 'error': return DiagnosticSeverity.Error;
      case 'warning': return DiagnosticSeverity.Warning;
      case 'info': return DiagnosticSeverity.Information;
      case 'hint': return DiagnosticSeverity.Hint;
      default: return DiagnosticSeverity.Error;
    }
  }

  /**
   * Finds the text range of an attribute within its element.
   */
  private findAttributeRange(document: html.TextDocument, node: html.Node, attrName: string): html.Range | null {
    const text = document.getText();
    const elementText = text.substring(node.start, node.end);
    
    // Simple regex to find attribute position
    const attrRegex = new RegExp(`\\s(${attrName})\\s*=\\s*["']([^"']*)["']`, "g");
    const match = attrRegex.exec(elementText);

    if (!match) return null;

    const attrStart = node.start + match.index + 1; // +1 to skip leading space
    const attrEnd = attrStart + match[0].length - 1; // -1 to not include trailing space

    return {
      start: document.positionAt(attrStart),
      end: document.positionAt(attrEnd),
    };
  }

  // Legacy methods that might be called by other services
  public validateElementAttributes(
    tagName: string,
    attributes: Record<string, string>
  ): Array<{ attributeName: string; error: string }> {
    const errors: Array<{ attributeName: string; error: string }> = [];

    if (!customElementsService.hasCustomElement(tagName)) {
      return errors;
    }

    for (const [attrName, attrValue] of Object.entries(attributes)) {
      const validation = this.validateAttributeValue(tagName, attrName, attrValue);
      if (validation) {
        errors.push({ attributeName: attrName, error: validation.error });
      }
    }

    return errors;
  }

  public isKnownCustomElement(tagName: string): boolean {
    return customElementsService.hasCustomElement(tagName);
  }
}

// Singleton instance holder and factory
let _singletonService: VsCodeHtmlValidationService | undefined;

/**
 * Returns a singleton instance of CustomHtmlService for the given services.
 * If called multiple times with the same arguments, returns the same instance.
 */
function getVsCodeHtmlValidationService(): VsCodeHtmlValidationService {
  if (!_singletonService) {
    _singletonService = new VsCodeHtmlValidationService();
  }
  return _singletonService;
}

export const htmlValidationService = getVsCodeHtmlValidationService();
