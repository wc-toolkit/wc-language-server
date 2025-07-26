/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs";
import * as path from "path";
import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };
import {
  HTMLDataAttribute,
  HTMLDataAttributeValue,
  HTMLDataTag,
  LanguageServerAdapter,
  VSCodeAdapter,
} from "./adapters";
import * as html from "vscode-html-languageservice";

/**
 * Service for managing custom elements manifest data and providing language features
 * for custom elements including completions, validation, and definitions.
 */
export class CustomElementsService {
  /** Map of custom element tag names to their definitions */
  private customElements: Map<string, cem.CustomElement> = new Map();

  /** File watcher for the custom elements manifest file */
  private manifestWatcher?: fs.StatWatcher;

  /** HTML data provider for VS Code HTML language service integration */
  private htmlDataProvider: any = null;

  /** Absolute path to the custom elements manifest file */
  private manifestPath: string | null = null;

  /** Content of the manifest file as a string for position finding */
  private manifestContent: string = "";

  /**
   * Creates a new CustomElementsService instance.
   * @param workspaceRoot - Root directory of the workspace
   * @param adapter - Language server adapter for creating completions and definitions
   */
  constructor(
    private workspaceRoot: string,
    private adapter: LanguageServerAdapter = new VSCodeAdapter()
  ) {
    this.loadCustomElementsManifest();
    this.watchManifestFile();
  }

  /**
   * Loads and parses the custom elements manifest file.
   * Searches for the manifest in common locations and initializes the service.
   */
  private loadCustomElementsManifest() {
    console.log("Loading custom elements manifest...");
    this.manifestPath = this.findManifestFile();
    if (!this.manifestPath) {
      console.log("No custom-elements.json found");
      return;
    }

    console.log("Found manifest at:", this.manifestPath);
    try {
      this.manifestContent = fs.readFileSync(this.manifestPath, "utf8");
      const manifest: cem.Package = JSON.parse(this.manifestContent);
      this.parseManifest(manifest);
      this.createHTMLData();
    } catch (error) {
      console.error("Error loading custom elements manifest:", error);
    }
  }

  /**
   * Searches for a custom elements manifest file in common locations.
   * @returns The path to the manifest file or null if not found
   */
  private findManifestFile(): string | null {
    const possiblePaths = [
      path.join(this.workspaceRoot, "custom-elements.json"),
      path.join(this.workspaceRoot, "dist", "custom-elements.json"),
      path.join(this.workspaceRoot, "src", "custom-elements.json"),
      path.join(this.workspaceRoot, "demo", "html", "custom-elements.json"),
    ];

    for (const manifestPath of possiblePaths) {
      if (fs.existsSync(manifestPath)) {
        return manifestPath;
      }
    }
    return null;
  }

  /**
   * Parses the custom elements manifest and extracts element definitions.
   * @param manifest - The parsed custom elements manifest package
   */
  private parseManifest(manifest: cem.Package) {
    this.customElements.clear();
    if (!manifest.modules) return;

    for (const module of manifest.modules) {
      if (!module.declarations) continue;

      for (const declaration of module.declarations) {
        if (this.isCustomElementDeclaration(declaration)) {
          const customElement = declaration as cem.CustomElement;
          const tagName = customElement.tagName;
          if (tagName) {
            // Find position in the manifest file
            const tagPosition = this.findPositionInManifest(
              `"tagName": "${tagName}"`
            );

            // Store the position with the custom element
            (customElement as any).sourcePosition = tagPosition;

            // Store the element
            this.customElements.set(tagName, customElement);
          }
        }
      }
    }
  }

  /**
   * Checks if a declaration is a custom element class.
   * @param declaration - The declaration to check
   * @returns True if the declaration is a custom element
   */
  private isCustomElementDeclaration(declaration: any): boolean {
    return (
      declaration.kind === "class" &&
      declaration.customElement === true &&
      declaration.tagName
    );
  }

  /**
   * Extracts attribute definitions from a custom element.
   * @param element - The custom element to extract attributes from
   * @returns Array of HTML data attributes with metadata
   */
  private extractAttributes(element: cem.CustomElement): HTMLDataAttribute[] {
    const attributes: HTMLDataAttribute[] = [];

    if (element.members) {
      for (const member of element.members) {
        if (member.kind === "field" && (member as any).attribute) {
          const attrName = (member as any).attribute;
          if (typeof attrName === "string") {
            // Find position in the manifest file
            const attrPosition = this.findPositionInManifest(
              `"attribute": "${attrName}"`
            );

            // Get the attribute type from the field
            const typeText = (member as any).type?.text || "";
            const memberName = (member as any).name || "";

            // Create attribute with more info
            attributes.push({
              name: attrName,
              description:
                member.description ||
                `Attribute for property '${memberName}' in ${element.tagName}`,
              type: typeText,
              // Add possible values for enum types
              values: this.extractPossibleValues(typeText),
              // Store the position
              sourcePosition: attrPosition,
            });
          }
        }
      }
    }

    return attributes;
  }

  /**
   * Extracts possible values from a type string for enum-like types.
   * @param typeText - The type string to parse
   * @returns Array of possible attribute values or undefined if not an enum
   */
  private extractPossibleValues(
    typeText: string
  ): HTMLDataAttributeValue[] | undefined {
    // Look for enum-like types using regex
    const enumMatch = typeText.match(/'([^']+)'(\s*\|\s*'([^']+)')+/);
    if (enumMatch) {
      // Extract all quoted values
      const valueMatches = typeText.match(/'([^']+)'/g);
      if (valueMatches) {
        return valueMatches.map((match) => {
          const value = match.replace(/'/g, "");
          return {
            name: value,
            description: `Value: ${value}`,
          };
        });
      }
    }
    return undefined;
  }

  /**
   * Creates HTML data for VS Code HTML language service integration.
   * Converts custom element definitions to HTML data format.
   */
  private createHTMLData() {
    const tags: HTMLDataTag[] = [];

    for (const [tagName, element] of this.customElements) {
      const attributes = this.extractAttributes(element);

      tags.push({
        name: tagName,
        description: element.description || `Custom element: ${tagName}`,
        attributes: attributes,
      });
    }

    // Create HTML data provider
    this.htmlDataProvider = html.newHTMLDataProvider("custom-elements", {
      version: 1.1,
      tags: tags,
    });
  }

  /**
   * Sets up file watching for the custom elements manifest.
   * Automatically reloads the manifest when it changes.
   */
  private watchManifestFile() {
    const manifestPath = this.findManifestFile();
    if (!manifestPath) return;

    try {
      this.manifestWatcher = fs.watchFile(manifestPath, () => {
        console.log("Custom elements manifest changed, reloading...");
        this.loadCustomElementsManifest();
      });
    } catch (error) {
      console.error("Error watching manifest file:", error);
    }
  }

  /**
   * Gets completion items for all custom elements.
   * @returns Array of completion items for custom element tags
   */
  public getCompletionItems(): any[] {
    const items: any[] = [];

    for (const [tagName, element] of this.customElements) {
      const description =
        element.description || element.summary || `Custom element: ${tagName}`;

      items.push({
        label: tagName,
        kind: html.CompletionItemKind.Property,
        documentation: {
          kind: "markdown",
          value: description,
        },
        insertText: `${tagName}>$0</${tagName}>`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: "Custom Element",
        sortText: "0" + tagName, // Sort custom elements first
      });
    }

    return items;
  }

  /**
   * Gets hover information for a specific custom element tag.
   * @param tagName - The tag name to get hover info for
   * @returns Hover information object or null if not found
   */
  public getHoverInfo(tagName: string): any | null {
    const element = this.customElements.get(tagName);
    if (!element) return null;

    const description = element.description || `Custom element: ${tagName}`;
    return {
      contents: {
        kind: "markdown",
        value: description,
      },
    };
  }

  /**
   * Gets all custom element definitions (legacy method for backwards compatibility).
   * @returns Array of all custom element definitions
   */
  public getCustomElements(): cem.CustomElement[] {
    return Array.from(this.customElements.values());
  }

  /**
   * Gets the HTML data provider for VS Code integration.
   * @returns The HTML data provider instance
   */
  public getHTMLDataProvider(): any {
    return this.htmlDataProvider;
  }

  /**
   * Gets all custom element tag names.
   * @returns Array of custom element tag names
   */
  public getTagNames(): string[] {
    return Array.from(this.customElements.keys());
  }

  /**
   * Disposes of the service and cleans up resources.
   * Stops file watching and clears data.
   */
  public dispose() {
    if (this.manifestWatcher) {
      this.manifestWatcher.unref();
    }
  }

  /**
   * Gets attribute completion items for a specific custom element tag.
   * @param tagName - The tag name to get attribute completions for
   * @returns Array of attribute completion items
   */
  public getAttributeCompletions(tagName: string): any[] {
    const element = this.customElements.get(tagName);
    if (!element || !this.adapter.createAttributeCompletionItem) return [];

    const attributes = this.extractAttributes(element);
    const completions: any[] = [];

    for (const attr of attributes) {
      completions.push(
        this.adapter.createAttributeCompletionItem(attr, tagName)
      );
    }

    return completions;
  }

  /**
   * Gets attribute value completion items for a specific attribute.
   * @param tagName - The tag name containing the attribute
   * @param attributeName - The attribute name to get value completions for
   * @returns Array of attribute value completion items
   */
  public getAttributeValueCompletions(
    tagName: string,
    attributeName: string
  ): any[] {
    const element = this.customElements.get(tagName);
    if (!element || !this.adapter.createAttributeValueCompletionItem) return [];

    const attributes = this.extractAttributes(element);
    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (!attribute || !attribute.values) return [];

    return attribute.values.map((value) =>
      this.adapter.createAttributeValueCompletionItem!(
        attribute,
        value,
        tagName
      )
    );
  }

  /**
   * Finds the character position of a search string in the manifest content.
   * @param searchText - The text to search for
   * @returns The character position or 0 if not found
   */
  private findPositionInManifest(searchText: string): number {
    if (!this.manifestContent) return 0;

    const position = this.manifestContent.indexOf(searchText);
    return position >= 0 ? position : 0;
  }

  /**
   * Gets definition location for a custom element tag.
   * @param tagName - The tag name to get definition for
   * @returns Definition location or null if not found
   */
  public getTagDefinition(tagName: string) {
    if (!this.manifestPath) {
      return null;
    }

    const element = this.customElements.get(tagName);
    if (!element) {
      return null;
    }

    const position = (element as any).sourcePosition || 0;

    // Use absolute path
    const absoluteManifestPath = this.manifestPath;
    const location = this.adapter.createTagDefinitionLocation?.(
      tagName,
      absoluteManifestPath,
      position
    );

    return location;
  }

  /**
   * Gets definition location for a custom element attribute.
   * @param tagName - The tag name containing the attribute
   * @param attributeName - The attribute name to get definition for
   * @returns Definition location or null if not found
   */
  public getAttributeDefinition(tagName: string, attributeName: string) {
    if (!this.manifestPath) return null;

    const element = this.customElements.get(tagName);
    if (!element) return null;

    const attributes = this.extractAttributes(element);
    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (!attribute) return null;

    return this.adapter.createAttributeDefinitionLocation?.(
      tagName,
      attributeName,
      this.manifestPath,
      attribute.sourcePosition || 0
    );
  }

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
    const element = this.customElements.get(tagName);
    if (!element) return null; // No validation possible

    const attributes = this.extractAttributes(element);
    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (!attribute) return null; // Attribute not defined in schema

    // If the attribute has defined values, check against them
    if (attribute.values && attribute.values.length > 0) {
      const allowedValues = attribute.values.map((v) => v.name);
      if (!allowedValues.includes(value)) {
        return `Invalid value "${value}" for attribute "${attributeName}". Allowed values: ${allowedValues.join(
          ", "
        )}`;
      }
    }

    // Type validation based on attribute.type
    if (attribute.type) {
      const validationError = this.validateTypeMatch(value, attribute.type);
      if (validationError) {
        return `${validationError} for attribute "${attributeName}"`;
      }
    }

    return null; // No validation errors
  }

  /**
   * Validates that a value matches a specified type definition.
   * @param value - The value to validate
   * @param typeText - The type definition to validate against
   * @returns Error message if validation fails, null if valid
   */
  private validateTypeMatch(value: string, typeText: string): string | null {
    // Handle boolean type
    if (typeText === "boolean") {
      if (value !== "true" && value !== "false") {
        return `Invalid boolean value "${value}". Expected "true" or "false"`;
      }
    }

    // Handle number type
    else if (typeText === "number") {
      if (isNaN(Number(value))) {
        return `Invalid number value "${value}"`;
      }
    }

    // Handle enum types (e.g., 'primary' | 'secondary' | 'success')
    else if (typeText.includes("|") && typeText.includes("'")) {
      const valueMatches = typeText.match(/'([^']+)'/g);
      if (valueMatches) {
        const allowedValues = valueMatches.map((match) =>
          match.replace(/'/g, "")
        );
        if (!allowedValues.includes(value)) {
          return `Invalid enum value "${value}". Expected one of: ${allowedValues.join(
            ", "
          )}`;
        }
      }
    }

    return null; // No validation errors
  }
}

/**
 * Creates a simple completion service for custom elements that triggers on any character.
 * This ensures custom element completions work even without the opening `<` bracket.
 * @returns Service plugin configuration object
 */
export function createCustomElementsCompletionService() {
  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: [], // Empty array means trigger on any character
      },
    },
    create(context: any) {
      const workspaceRoot = context.env?.workspaceFolders?.[0]?.uri || "";
      const adapter = new VSCodeAdapter();
      const customElementsService = new CustomElementsService(
        workspaceRoot,
        adapter
      );

      return {
        provideCompletionItems(
          document: any,
          position: any,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _completionContext: any
        ) {
          // Only provide completions in HTML-like contexts
          const text = document.getText();
          const offset = document.offsetAt(position);
          const beforeText = text.substring(0, offset);

          // Don't provide completions if we're clearly in an attribute context
          if (beforeText.match(/\s+\w+=[^>]*$/)) {
            return { items: [] };
          }

          const customElements = customElementsService.getCustomElements();
          return adapter.createCompletionList(customElements);
        },

        dispose() {
          customElementsService.dispose();
        },
      };
    },
  };
}
