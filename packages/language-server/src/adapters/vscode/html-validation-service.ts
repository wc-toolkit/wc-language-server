import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { removeQuotes } from "@wc-toolkit/cem-utilities";
import { CustomElementsService } from "../../services/custom-elements-service";

/**
 * Service dedicated to handling HTML validation for custom elements.
 * Provides diagnostic information and validation for custom element attributes and values.
 */
export class VsCodeHtmlValidationService {
  /**
   * Creates a new HtmlValidationService instance.
   * @param customElementsService - Service for accessing custom elements data
   */
  constructor(private customElementsService: CustomElementsService) {}

  /**
   * Validates an attribute value against the custom element schema.
   * @param tagName - The tag name containing the attribute
   * @param attributeName - The attribute name to validate
   * @param value - The value to validate
   * @returns Error message if validation fails, null if valid
   */
  public validateAttributeValue(
    tagName: string,
    attributeName: string,
    value: string
  ): string | null {
    value = removeQuotes(value);

    const attrOptions = this.customElementsService.getAttributeValueOptions(
      tagName,
      attributeName
    );

    // If no options are defined for this attribute, we cannot validate
    // This allows for attributes that are not defined in the manifest
    // or for attributes that are not meant to have specific values.
    if (
      !value ||
      !attrOptions ||
      attrOptions === "string" ||
      attrOptions.includes("string & {}")
    ) {
      return null; // No validation possible
    }

    if (attrOptions === "boolean") {
      // If the attribute is a boolean, it should not have a value set
      return `The attribute "${attributeName}" is boolean and should not have a value. Just including "${attributeName}" is enough to enable it.`;
    }

    if (attrOptions === "number" && isNaN(Number(value))) {
      return `The value for "${attributeName}" must be a valid number.`;
    }

    // If the attribute has defined values, check against them
    if (Array.isArray(attrOptions) && !attrOptions.includes(value)) {
      return `The value "${value}" is not valid for "${attributeName}". Allowed values: ${attrOptions.join(" | ")}`;
    }

    return null; // No validation errors
  }

  public provideDiagnostics(
    document: html.TextDocument,
    htmlLanguageService: html.LanguageService
  ): html.Diagnostic[] {
    const text = document.getText();
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      text
    );
    const htmlDocument = htmlLanguageService.parseHTMLDocument(textDocument);

    const diagnostics: html.Diagnostic[] = [];

    // Process each element in the document
    for (const node of htmlDocument.roots) {
      this.validateNode(node, document, diagnostics);
    }

    return diagnostics;
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
  ): void {
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
        const errorMessage = this.validateAttributeValue(
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
    const attrRegex = new RegExp(
      `\\s(${attrName})\\s*=\\s*["']([^"']*)["']`,
      "g"
    );
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

  /**
   * Checks if a tag name represents a known custom element.
   * @param tagName - The tag name to check
   * @returns True if it's a known custom element
   */
  public isKnownCustomElement(tagName: string): boolean {
    return this.customElementsService.hasCustomElement(tagName);
  }

  /**
   * Gets all validation errors for a specific custom element's attributes.
   * @param tagName - The custom element tag name
   * @param attributes - Object containing attribute name-value pairs
   * @returns Array of validation error messages
   */
  public validateElementAttributes(
    tagName: string,
    attributes: Record<string, string>
  ): Array<{ attributeName: string; error: string }> {
    const errors: Array<{ attributeName: string; error: string }> = [];

    if (!this.customElementsService.hasCustomElement(tagName)) {
      return errors;
    }

    for (const [attrName, attrValue] of Object.entries(attributes)) {
      const errorMessage = this.validateAttributeValue(
        tagName,
        attrName,
        attrValue
      );

      if (errorMessage) {
        errors.push({
          attributeName: attrName,
          error: errorMessage,
        });
      }
    }

    return errors;
  }

  /**
   * Creates a diagnostic object for a validation error.
   * @param range - The text range where the error occurs
   * @param message - The error message
   * @param severity - The severity level (defaults to Error)
   * @returns A diagnostic object
   */
  public createDiagnostic(
    range: html.Range,
    message: string,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error
  ): html.Diagnostic {
    return {
      severity,
      range,
      message,
      source: "web-components",
    };
  }

  /**
   * Finds attribute ranges for all attributes in a node.
   * @param document - The text document
   * @param node - The HTML node
   * @returns Map of attribute names to their ranges
   */
  public findAllAttributeRanges(
    document: html.TextDocument,
    node: html.Node
  ): Map<string, html.Range> {
    const ranges = new Map<string, html.Range>();

    if (!node.attributes || !node.tag) {
      return ranges;
    }

    for (const attrName of Object.keys(node.attributes)) {
      const range = this.findAttributeRange(document, node, attrName);
      if (range) {
        ranges.set(attrName, range);
      }
    }

    return ranges;
  }

  /**
   * Validates all custom elements in a document and returns a summary.
   * @param document - The text document to validate
   * @param htmlLanguageService - The HTML language service for parsing
   * @returns Validation summary with counts and details
   */
  public validateDocument(
    document: html.TextDocument,
    htmlLanguageService: html.LanguageService
  ): {
    totalErrors: number;
    totalWarnings: number;
    customElementsFound: number;
    diagnostics: html.Diagnostic[];
  } {
    const diagnostics = this.provideDiagnostics(document, htmlLanguageService);

    const totalErrors = diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Error
    ).length;

    const totalWarnings = diagnostics.filter(
      (d) => d.severity === DiagnosticSeverity.Warning
    ).length;

    // Count custom elements in the document
    const text = document.getText();
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      text
    );
    const htmlDocument = htmlLanguageService.parseHTMLDocument(textDocument);

    const customElementsFound = this.countCustomElements(htmlDocument.roots);

    return {
      totalErrors,
      totalWarnings,
      customElementsFound,
      diagnostics,
    };
  }

  /**
   * Recursively counts custom elements in HTML nodes.
   * @param nodes - Array of HTML nodes to process
   * @returns Number of custom elements found
   */
  private countCustomElements(nodes: html.Node[]): number {
    let count = 0;

    for (const node of nodes) {
      if (node.tag && this.customElementsService.hasCustomElement(node.tag)) {
        count++;
      }

      if (node.children) {
        count += this.countCustomElements(node.children);
      }
    }

    return count;
  }
}
