import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { removeQuotes } from "@wc-toolkit/cem-utilities";
import { customElementsService } from "../../services/custom-elements-service";
import { configurationService } from "../../services/configuration-service";

/**
 * Main entry point - provides all diagnostics for a document.
 */
export function getValidation(
  document: html.TextDocument,
  htmlLanguageService: html.LanguageService,
): html.Diagnostic[] {
  const textDocument = html.TextDocument.create(
    document.uri,
    "html",
    0,
    document.getText(),
  );
  const htmlDocument = htmlLanguageService.parseHTMLDocument(textDocument);
  const diagnostics: html.Diagnostic[] = [];

  validateNodes(htmlDocument.roots, document, diagnostics);
  return diagnostics;
}

/**
 * Recursively validates all nodes in the document.
 */
function validateNodes(
  nodes: html.Node[],
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
): void {
  for (const node of nodes) {
    validateSingleNode(node, document, diagnostics);
    if (node.children) {
      validateNodes(node.children, document, diagnostics);
    }
  }
}

/**
 * Validates a single node's attributes if it's a custom element.
 */
function validateSingleNode(
  node: html.Node,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
): void {
  if (
    !node.tag ||
    !node.attributes ||
    !customElementsService.hasCustomElement(node.tag)
  ) {
    return;
  }

  // Check if the element itself is deprecated
  const elementDeprecation = checkElementDeprecation(node.tag);
  if (elementDeprecation) {
    const elementRange = findElementTagRange(document, node);
    if (elementRange) {
      diagnostics.push({
        severity: getSeverityLevel("deprecatedElement"),
        range: elementRange,
        message: elementDeprecation.error,
        source: "web-components",
      });
    }
  }

  for (const [attrName, attrValue] of Object.entries(node.attributes)) {
    // Check attribute value validation
    const validation = validateAttributeValue(
      node.tag,
      attrName,
      attrValue,
    );
    if (validation) {
      const range = findAttributeRange(document, node, attrName);
      if (range) {
        diagnostics.push({
          severity: getSeverityLevel(validation.type),
          range,
          message: validation.error,
          source: "web-components",
        });
      }
    }

    // Check attribute deprecation
    const deprecation = checkAttributeDeprecation(node.tag, attrName);
    if (deprecation) {
      const range = findAttributeNameRange(document, node, attrName);
      if (range) {
        diagnostics.push({
          severity: getSeverityLevel("deprecatedAttribute"),
          range,
          message: deprecation.error,
          source: "web-components",
        });
      }
    }
  }
}

/**
 * Validates a single attribute value against its schema.
 */
function validateAttributeValue(
  tagName: string,
  attributeName: string,
  value?: string | null,
): {
  error: string;
  type: "invalidBoolean" | "invalidNumber" | "invalidAttributeValue";
} | null {
  const cleanValue = removeQuotes(value || "");
  const attrOptions = customElementsService.getAttributeValueOptions(
    tagName,
    attributeName,
  );

  // No validation possible or needed
  if (
    !cleanValue ||
    !attrOptions ||
    attrOptions === "string" ||
    attrOptions.includes("string & {}")
  ) {
    return null;
  }

  // Boolean attributes shouldn't have values
  if (attrOptions === "boolean") {
    return {
      error: `The attribute "${attributeName}" is boolean and should not have a value.`,
      type: "invalidBoolean",
    };
  }

  // Number validation
  if (attrOptions === "number" && isNaN(Number(cleanValue))) {
    return {
      error: `The value for "${attributeName}" must be a valid number.`,
      type: "invalidNumber",
    };
  }

  // Enum validation
  if (Array.isArray(attrOptions) && !attrOptions.includes(cleanValue)) {
    return {
      error: `"${cleanValue}" is not a valid value for "${attributeName}".`,
      type: "invalidAttributeValue",
    };
  }

  return null;
}

/**
 * Maps configuration severity to VSCode DiagnosticSeverity.
 */
function getSeverityLevel(
  type:
    | "invalidBoolean"
    | "invalidNumber"
    | "invalidAttributeValue"
    | "deprecatedAttribute"
    | "deprecatedElement",
): DiagnosticSeverity {
  const configSeverity =
    configurationService?.config?.diagnosticSeverity?.[type] || "error";

  switch (configSeverity) {
    case "error":
      return DiagnosticSeverity.Error;
    case "warning":
      return DiagnosticSeverity.Warning;
    case "info":
      return DiagnosticSeverity.Information;
    case "hint":
      return DiagnosticSeverity.Hint;
    default:
      return DiagnosticSeverity.Error;
  }
}

/**
 * Finds the text range of an attribute within its element.
 */
function findAttributeRange(
  document: html.TextDocument,
  node: html.Node,
  attrName: string,
): html.Range | null {
  const text = document.getText();
  const elementText = text.substring(node.start, node.end);

  // Simple regex to find attribute position
  const attrRegex = new RegExp(
    `\\s(${attrName})\\s*=\\s*["']([^"']*)["']`,
    "g",
  );
  const match = attrRegex.exec(elementText);

  if (!match) return null;

  const attrStart = node.start + match.index + 1; // +1 to skip leading space
  const attrEnd = attrStart + match[0].length - 1; // -1 to not include trailing space

  return {
    start: document.positionAt(attrStart),
    end: document.positionAt(attrEnd),
  };
}

/**
 * Finds the text range of an attribute name within its element.
 */
function findAttributeNameRange(
  document: html.TextDocument,
  node: html.Node,
  attrName: string,
): html.Range | null {
  const text = document.getText();
  const elementText = text.substring(node.start, node.end);

  // Simple regex to find attribute name position
  const attrRegex = new RegExp(`\\s(${attrName})(?:\\s*=|\\s|>)`, "g");
  const match = attrRegex.exec(elementText);

  if (!match) return null;

  const attrStart = node.start + match.index + 1; // +1 to skip leading space
  const attrEnd = attrStart + match[1].length; // just the attribute name

  return {
    start: document.positionAt(attrStart),
    end: document.positionAt(attrEnd),
  };
}

/**
 * Finds the text range of the element tag name.
 */
function findElementTagRange(
  document: html.TextDocument,
  node: html.Node,
): html.Range | null {
  if (!node.tag) return null;

  const text = document.getText();
  const elementText = text.substring(node.start, node.end);

  // Find the tag name position
  const tagRegex = new RegExp(`<(${node.tag})(?:\\s|>|/>)`, "g");
  const match = tagRegex.exec(elementText);

  if (!match) return null;

  const tagStart = node.start + match.index + 1; // +1 to skip '<'
  const tagEnd = tagStart + match[1].length;

  return {
    start: document.positionAt(tagStart),
    end: document.positionAt(tagEnd),
  };
}

/**
 * Checks if an element is deprecated.
 */
function checkElementDeprecation(tagName: string): { error: string } | null {
  const element = customElementsService.getCustomElement(tagName);
  if (!element?.deprecated) return null;

  const deprecationMessage =
    typeof element.deprecated === "string"
      ? element.deprecated
      : `The element "${tagName}" is deprecated.`;

  return {
    error: deprecationMessage,
  };
}

/**
 * Checks if an attribute is deprecated.
 */
function checkAttributeDeprecation(
  tagName: string,
  attributeName: string,
): { error: string } | null {
  const element = customElementsService.getCustomElement(tagName);
  if (!element?.attributes) return null;

  const attribute = element.attributes.find(
    (attr) => attr.name === attributeName,
  );
  if (!attribute?.deprecated) {
    return null;
  }

  const deprecationMessage =
    typeof attribute.deprecated === "string"
      ? attribute.deprecated
      : `The attribute "${attributeName}" is deprecated.`;

  return {
    error: deprecationMessage,
  };
}

/**
 * Validates element attributes (legacy API).
 */
export function validateElementAttributes(
  tagName: string,
  attributes: Record<string, string>,
): Array<{ attributeName: string; error: string }> {
  const errors: Array<{ attributeName: string; error: string }> = [];

  if (!customElementsService.hasCustomElement(tagName)) {
    return errors;
  }

  for (const [attrName, attrValue] of Object.entries(attributes)) {
    const validation = validateAttributeValue(
      tagName,
      attrName,
      attrValue,
    );
    if (validation) {
      errors.push({ attributeName: attrName, error: validation.error });
    }
  }

  return errors;
}

/**
 * Checks if a tag is a known custom element.
 */
export function isKnownCustomElement(tagName: string): boolean {
  return customElementsService.hasCustomElement(tagName);
}
