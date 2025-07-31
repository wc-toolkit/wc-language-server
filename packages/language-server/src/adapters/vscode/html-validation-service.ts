import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { removeQuotes } from "@wc-toolkit/cem-utilities";
import { CustomElementsService } from "../../services/custom-elements-service";

/**
 * Service for validating custom element attributes in HTML documents.
 * @param customElementsService - Instance of CustomElementsService to access custom element definitions
 */
export class VsCodeHtmlValidationService {
  constructor(private customElementsService: CustomElementsService) {}

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
    if (!node.tag || !node.attributes || !this.customElementsService.hasCustomElement(node.tag)) {
      return;
    }

    for (const [attrName, attrValue] of Object.entries(node.attributes)) {
      if (typeof attrValue !== "string") continue;

      const error = this.validateAttributeValue(node.tag, attrName, attrValue);
      if (!error) continue;

      const range = this.findAttributeRange(document, node, attrName);
      if (!range) continue;

      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range,
        message: error,
        source: "web-components",
      });
    }
  }

  /**
   * Validates a single attribute value against its schema.
   */
  private validateAttributeValue(tagName: string, attributeName: string, value: string): string | null {
    const cleanValue = removeQuotes(value);
    const attrOptions = this.customElementsService.getAttributeValueOptions(tagName, attributeName);

    // No validation possible or needed
    if (!cleanValue || !attrOptions || attrOptions === "string" || attrOptions.includes("string & {}")) {
      return null;
    }

    // Boolean attributes shouldn't have values
    if (attrOptions === "boolean") {
      return `The attribute "${attributeName}" is boolean and should not have a value.`;
    }

    // Number validation
    if (attrOptions === "number" && isNaN(Number(cleanValue))) {
      return `The value for "${attributeName}" must be a valid number.`;
    }

    // Enum validation
    if (Array.isArray(attrOptions) && !attrOptions.includes(cleanValue)) {
      return `The value "${cleanValue}" is not valid for "${attributeName}". Allowed values: ${attrOptions.join(" | ")}`;
    }

    return null;
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

    if (!this.customElementsService.hasCustomElement(tagName)) {
      return errors;
    }

    for (const [attrName, attrValue] of Object.entries(attributes)) {
      const error = this.validateAttributeValue(tagName, attrName, attrValue);
      if (error) {
        errors.push({ attributeName: attrName, error });
      }
    }

    return errors;
  }

  public isKnownCustomElement(tagName: string): boolean {
    return this.customElementsService.hasCustomElement(tagName);
  }
}