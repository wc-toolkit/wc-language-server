import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { removeQuotes, Component } from "@wc-toolkit/cem-utilities";
import { customElementsService } from "../../services/custom-elements-service.js";
import {
  configurationService,
  DiagnosticSeverityOptions,
} from "../../services/configuration-service.js";

// Compatible document interface that matches both vscode-languageserver-textdocument and html.TextDocument
interface DocumentLike {
  uri: string;
  languageId: string;
  version: number;
  lineCount: number;
  getText(): string;
  positionAt(offset: number): { line: number; character: number };
  offsetAt(position: { line: number; character: number }): number;
}

/**
 * Main entry point - provides all diagnostics for a document.
 */
export function getValidation(
  document: DocumentLike,
  htmlLanguageService: html.LanguageService,
): html.Diagnostic[] {
  // Use the document directly for parsing
  const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
  const diagnostics: html.Diagnostic[] = [];

  validateNodes(htmlDocument.roots, document, diagnostics);
  return diagnostics;
}

/**
 * Recursively validates all nodes in the document.
 */
export function validateNodes(
  nodes: html.Node[],
  document: DocumentLike,
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
 * Validates a single node - checks for unknown elements and validates attributes.
 */
export function validateSingleNode(
  node: html.Node,
  document: DocumentLike,
  diagnostics: html.Diagnostic[],
): void {
  if (!node.tag) {
    return;
  }

  // Check if this looks like a custom element (contains hyphen)
  const isCustomElement = node.tag.includes("-");
  if (!isCustomElement) {
    return; // Only validate custom elements
  }

  const element = customElementsService.getCustomElement(node.tag);

  // Handle unknown custom elements
  if (!element) {
    validateUnknownElement(node, document, diagnostics);
    return; // Can't validate attributes on unknown elements
  }

  // Check if the element itself is deprecated
  validateElementDeprecation(node, document, diagnostics, element);

  // Parse and validate all raw attributes (handles duplicates and validation)
  validateRawAttributes(
    node,
    document,
    diagnostics,
    element.package as string,
    element,
  );
}

/**
 * Validates and reports unknown custom elements.
 */
function validateUnknownElement(
  node: html.Node,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
): void {
  const elementRange = findElementTagRange(document, node);
  const severity = getSeverityLevel("unknownElement");

  if (elementRange && severity) {
    diagnostics.push({
      severity: severity,
      range: elementRange,
      message: `'${node.tag}' is an unknown custom element. Verify that your dependencies have been correctly installed and that the element is defined in the Custom Elements Manifest.`,
      source: "wc-toolkit",
    });
  }
}

/**
 * Validates and reports deprecated elements.
 */
function validateElementDeprecation(
  node: html.Node,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
  element: Component,
): void {
  const elementDeprecationSeverity = getSeverityLevel(
    "deprecatedElement",
    element.package as string,
  );

  if (elementDeprecationSeverity) {
    const elementDeprecation = checkElementDeprecation(node.tag!);
    if (elementDeprecation) {
      const elementRange = findElementTagRange(document, node);
      if (elementRange) {
        diagnostics.push({
          severity: elementDeprecationSeverity,
          range: elementRange,
          message: elementDeprecation.error,
          source: "wc-toolkit",
        });
      }
    }
  }
}

/**
 * Validates all raw attributes by parsing the element text directly.
 * This handles both duplicate detection and individual attribute validation.
 */
function validateRawAttributes(
  node: html.Node,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
  packageName?: string,
  element?: Component,
): void {
  const elementText = extractElementOpeningTag(node, document.getText());
  const attributes = parseAttributesFromText(elementText, node);

  validateAttributeList(
    attributes,
    document,
    diagnostics,
    packageName,
    element,
    node,
  );
}

/**
 * Extracts the opening tag text from the full element text.
 */
function extractElementOpeningTag(node: html.Node, text: string): string {
  let elementText = text.substring(node.start, node.end);
  const openTagEnd = elementText.indexOf(">");
  if (openTagEnd !== -1) {
    elementText = elementText.substring(0, openTagEnd + 1);
  }
  return elementText;
}

/**
 * Parses attributes from element text and returns attribute information.
 */
function parseAttributesFromText(
  elementText: string,
  node: html.Node,
): Array<{
  name: string;
  value: string | null;
  start: number;
  end: number;
  match: RegExpExecArray;
}> {
  const firstSpace = elementText.indexOf(" ");
  if (firstSpace === -1) {
    return [];
  }

  const attrText = elementText.slice(firstSpace);
  const attrRegex =
    /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;

  const attributes: Array<{
    name: string;
    value: string | null;
    start: number;
    end: number;
    match: RegExpExecArray;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrText)) !== null) {
    const attrName = match[1];

    // Skip the tag name if present
    if (attrName === node.tag) continue;

    const matchIndexInElement = firstSpace + match.index;
    const attrStart = node.start + matchIndexInElement;
    const attrNameEnd = attrStart + attrName.length;

    const value =
      match[2] !== undefined
        ? match[2]
        : match[3] !== undefined
          ? match[3]
          : match[4] !== undefined
            ? match[4]
            : null;

    // match is already a RegExpExecArray relative to attrText; callers expect
    // match.index to be relative to the element start, so adjust by firstSpace.
    const adjustedMatch = match as RegExpExecArray;
    Object.defineProperty(adjustedMatch, "index", {
      value: matchIndexInElement,
    });

    attributes.push({
      name: attrName,
      value,
      start: attrStart,
      end: attrNameEnd,
      match: adjustedMatch,
    });
  }

  return attributes;
}

/**
 * Validates a list of parsed attributes.
 */
function validateAttributeList(
  attributes: Array<{
    name: string;
    value: string | null;
    start: number;
    end: number;
    match: RegExpExecArray;
  }>,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
  packageName?: string,
  element?: Component,
  node?: html.Node,
): void {
  const seenAttrs = new Set<string>();

  for (const attr of attributes) {
    // Check for duplicate attributes
    validateDuplicateAttribute(
      attr.name,
      seenAttrs,
      document,
      diagnostics,
      attr.start,
      attr.end,
      packageName,
    );

    seenAttrs.add(attr.name);

    // Validate attribute value
    if (node) {
      validateSingleAttributeValue(
        node,
        document,
        diagnostics,
        attr.name,
        attr.value,
        attr.start,
        attr.match,
        packageName,
      );

      // Check attribute deprecation
      validateAttributeDeprecation(
        node,
        document,
        diagnostics,
        attr.name,
        attr.start,
        attr.end,
        packageName,
      );

      // Check for unknown attributes on known elements
      validateUnknownAttribute(
        element,
        document,
        diagnostics,
        attr.name,
        node.tag!,
        attr.start,
        attr.end,
        packageName,
      );
    }
  }
}

/**
 * Validates and reports duplicate attributes.
 */
function validateDuplicateAttribute(
  attrName: string,
  seenAttrs: Set<string>,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
  attrStart: number,
  attrNameEnd: number,
  packageName?: string,
): void {
  if (seenAttrs.has(attrName)) {
    const severity = getSeverityLevel("duplicateAttribute", packageName);
    if (severity) {
      diagnostics.push({
        severity: severity,
        range: {
          start: document.positionAt(attrStart),
          end: document.positionAt(attrNameEnd),
        },
        message: `Duplicate attribute "${attrName}" found.`,
        source: "wc-toolkit",
      });
    }
  }
}

/**
 * Extracts the value of an attribute from the element text.
 */

/**
 * Validates a single attribute's value.
 */
function validateSingleAttributeValue(
  node: html.Node,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
  attrName: string,
  attrValue: string | null,
  attrStart: number,
  match: RegExpExecArray,
  packageName?: string,
): void {
  const validation = validateAttributeValue(
    node.tag || "",
    attrName,
    attrValue,
  );

  if (validation) {
    const afterAttrName = document
      .getText()
      .substring(node.start + match.index + match[0].length);
    const valueMatch = afterAttrName.match(
      /^\s*=\s*(?:["']([^"']*)["']|([^\s>"'/]+))/,
    );
    const fullMatchLength =
      match[0].length + (valueMatch ? valueMatch[0].length : 0);
    const range = {
      start: document.positionAt(attrStart),
      end: document.positionAt(attrStart + fullMatchLength - 1),
    };
    const severity = getSeverityLevel(validation.type, packageName);
    if (severity) {
      diagnostics.push({
        severity,
        range,
        message: validation.error,
        source: "wc-toolkit",
      });
    }
  }
}

/**
 * Validates and reports deprecated attributes.
 */
function validateAttributeDeprecation(
  node: html.Node,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
  attrName: string,
  attrStart: number,
  attrNameEnd: number,
  packageName?: string,
): void {
  const attributeDeprecationSeverity = getSeverityLevel(
    "deprecatedAttribute",
    packageName,
  );
  if (attributeDeprecationSeverity) {
    const deprecation = checkAttributeDeprecation(node.tag || "", attrName);
    if (deprecation) {
      const severity = getSeverityLevel("deprecatedAttribute", packageName);
      if (severity) {
        diagnostics.push({
          severity,
          range: {
            start: document.positionAt(attrStart),
            end: document.positionAt(attrNameEnd),
          },
          message: deprecation.error,
          source: "wc-toolkit",
        });
      }
    }
  }
}

/**
 * Validates and reports unknown attributes on known elements.
 */
function validateUnknownAttribute(
  element: Component | undefined,
  document: html.TextDocument,
  diagnostics: html.Diagnostic[],
  attrName: string,
  tagName: string,
  attrStart: number,
  attrNameEnd: number,
  packageName?: string,
): void {
  if (element && element.attributes) {
    const isKnownAttribute = element.attributes.some(
      (attr: { name: string }) => attr.name === attrName,
    );
    if (!isKnownAttribute) {
      const severity = getSeverityLevel("unknownAttribute", packageName);
      if (severity) {
        diagnostics.push({
          severity: severity,
          range: {
            start: document.positionAt(attrStart),
            end: document.positionAt(attrNameEnd),
          },
          message: `'${attrName}' is not a defined attribute for '${tagName}', so this may not behave as expected.`,
          source: "wc-toolkit",
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
  type: DiagnosticSeverityOptions;
} | null {
  const attrOptions = customElementsService.getAttributeValueOptions(
    tagName,
    attributeName,
  );

  // No validation possible or needed
  if (
    !attrOptions ||
    attrOptions === "string" ||
    attrOptions.includes("string & {}")
  ) {
    return null;
  }

  // Boolean attributes shouldn't have values
  if (attrOptions === "boolean" && value !== null) {
    return {
      error: `The attribute "${attributeName}" is boolean and should not have a value.`,
      type: "invalidBoolean",
    };
  }

  // If no value provided, skip further validation (valid for boolean attributes)
  if (!value) {
    return null;
  }

  const cleanValue = removeQuotes(value);

  // Skip validation if empty value
  if (!cleanValue) {
    return null;
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
  type: DiagnosticSeverityOptions,
  packageName?: string,
): DiagnosticSeverity | 0 {
  const libraryConfig = packageName
    ? configurationService?.config?.libraries?.[packageName]
        ?.diagnosticSeverity?.[type]
    : undefined;
  const globalConfig =
    configurationService?.config?.diagnosticSeverity?.[type] || "error";
  const configSeverity = libraryConfig || globalConfig;

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
      return 0;
  }
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
