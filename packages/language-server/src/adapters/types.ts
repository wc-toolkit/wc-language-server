import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };
import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";

/**
 * Adapter interface for language server operations related to web components.
 * Provides methods for creating completion items, hover information, definition providers,
 * and diagnostic capabilities for custom elements.
 */
export interface LanguageServerAdapter {
  /**
   * Creates a completion item for a custom element tag
   * @param tag The name of the custom element tag
   * @param description A description of the custom element
   * @param attributes Optional list of attributes supported by the element
   * @returns A completion item for the tag
   */
  createCompletionItem(
    tag: string,
    description: string,
    attributes?: HTMLDataAttribute[]
  ): html.CompletionItem;

  /**
   * Creates completion items for all custom elements
   * @param customElements Map of custom element tag names to their definitions
   * @returns Array of completion items for custom element tags
   */
  createCustomElementCompletionItems?(
    customElements: Map<string, cem.CustomElement>
  ): html.CompletionItem[];

  /**
   * Creates hover information for a custom element tag
   * @param tagName The tag name to get hover info for
   * @param element The custom element definition
   * @returns Hover information object
   */
  createElementHoverInfo?(tagName: string, element: cem.CustomElement): html.Hover;

  /**
   * Creates an HTML data provider for custom elements
   * @param tags Array of custom element tag data
   * @returns An HTML data provider instance
   */
  createHTMLDataProvider?(tags: HTMLDataTag[]): html.IHTMLDataProvider;
  
  /**
   * Creates HTML data from custom elements manifest data
   * @param customElements Map of custom element tag names to their definitions
   * @param attributeOptions Map of attribute names to their options data
   * @param findPositionInManifest Function to find position of attributes in the manifest
   * @returns HTML data provider for VS Code integration
   */
  createHTMLDataFromCustomElements?(
    customElements: Map<string, cem.CustomElement>,
    attributeOptions: Map<string, string[] | string>,
    findPositionInManifest: (searchText: string) => number
  ): html.IHTMLDataProvider;

  /**
   * Extracts attribute definitions from a custom element for autocompletion
   * @param element The custom element to extract attributes from
   * @param attributeOptions Map of attribute names to their options data
   * @param findPositionInManifest Function to find position of attributes in the manifest
   * @returns Array of HTML data attributes with metadata
   */
  extractAttributesForAutoComplete?(
    element: cem.CustomElement,
    attributeOptions: Map<string, string[] | string>,
    findPositionInManifest: (searchText: string) => number
  ): HTMLDataAttribute[];
  
  /**
   * Creates completion items for attributes of a custom element
   * @param element The custom element
   * @param tagName The tag name
   * @param attributeOptions Map of attribute names to their options
   * @param findPositionInManifest Function to find position in manifest
   * @returns Array of attribute completion items
   */
  createAttributeCompletionItems?(
    element: cem.CustomElement,
    tagName: string,
    attributeOptions: Map<string, string[] | string>,
    findPositionInManifest: (searchText: string) => number
  ): html.CompletionItem[];

  /**
   * Creates completion items for attribute values
   * @param element The custom element
   * @param tagName The tag name
   * @param attributeName The attribute name
   * @param attributeOptions Map of attribute names to their options
   * @param findPositionInManifest Function to find position in manifest
   * @returns Array of attribute value completion items
   */
  createAttributeValueCompletionItems?(
    element: cem.CustomElement,
    tagName: string,
    attributeName: string,
    attributeOptions: Map<string, string[] | string>,
    findPositionInManifest: (searchText: string) => number
  ): html.CompletionItem[];

  /**
   * Creates hover information for a custom element
   * @param tag The name of the custom element tag
   * @param description A description of the custom element
   * @returns Markup content for hover information
   */
  createHoverInfo?(tag: string, description: string): html.MarkupContent;

  /**
   * Creates a completion item for an attribute of a custom element
   * @param attribute The attribute data
   * @param tagName The name of the parent custom element
   * @returns A completion item for the attribute
   */
  createAttributeCompletionItem?(
    attribute: HTMLDataAttribute,
    tagName: string
  ): html.CompletionItem;

  /**
   * Creates a completion item for an attribute value
   * @param attribute The parent attribute data
   * @param value The attribute value data
   * @param tagName The name of the parent custom element
   * @returns A completion item for the attribute value
   */
  createAttributeValueCompletionItem?(
    attribute: HTMLDataAttribute,
    value: HTMLDataAttributeValue,
    tagName: string
  ): html.CompletionItem;

  /**
   * Creates a location object for tag definition lookup
   * @param tagName The name of the custom element tag
   * @param manifestPath Path to the custom elements manifest file
   * @param position Position in the manifest file
   * @returns Location object or null if not found
   */
  createTagDefinitionLocation?(
    tagName: string,
    manifestPath: string,
    position: number
  ): html.Location | null;

  /**
   * Creates a location object for attribute definition lookup
   * @param tagName The name of the custom element tag
   * @param attributeName The name of the attribute
   * @param manifestPath Path to the custom elements manifest file
   * @param position Position in the manifest file
   * @returns Location object or null if not found
   */
  createAttributeDefinitionLocation?(
    tagName: string,
    attributeName: string,
    manifestPath: string,
    position: number
  ): html.Location | null;

  /**
   * Creates a completion list from custom elements
   * @param elements Array of custom element definitions
   * @returns A completion list containing items for each element
   */
  createCompletionList(elements: cem.CustomElement[]): html.CompletionList;

  /**
   * Creates a diagnostic for reporting issues
   * @param range The text range where the issue occurs
   * @param message The diagnostic message
   * @param severity The severity level of the diagnostic
   * @returns A diagnostic object
   */
  createDiagnostic(
    range: html.Range,
    message: string,
    severity: DiagnosticSeverity
  ): html.Diagnostic;
}

/**
 * Represents a custom element tag for HTML data provider
 */
export interface HTMLDataTag {
  /**
   * The name of the custom element tag
   */
  name: string;
  /**
   * Optional description of the custom element tag
   */
  description?: string;
  /**
   * List of attributes available for this custom element
   */
  attributes: HTMLDataAttribute[];
  /**
   * Position in the source manifest file for definition lookup
   */
  sourcePosition?: number;
}

/**
 * Represents an attribute of a custom element
 */
export interface HTMLDataAttribute {
  /**
   * The name of the attribute
   */
  name: string;
  /**
   * Optional description of the attribute
   */
  description?: string;
  /**
   * Optional identifier for predefined value sets
   */
  valueSet?: string;
  /**
   * Optional list of possible values for this attribute
   */
  values?: HTMLDataAttributeValue[];
  /**
   * Optional type information for the attribute
   */
  type?: string;
  /**
   * Position in the source manifest file for definition lookup
   */
  sourcePosition?: number;
}

/**
 * Represents a possible value for an attribute
 */
export interface HTMLDataAttributeValue {
  /**
   * The name of the attribute value
   */
  name: string;
  /**
   * Optional description of the attribute value
   */
  description?: string;
}
