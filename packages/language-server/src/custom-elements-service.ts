// /* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs";
import * as path from "path";
import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };
import { LanguageServerAdapter, VSCodeAdapter } from "./adapters";
import * as html from "vscode-html-languageservice";
import {
  Component,
  getAllComponents,
  removeQuotes,
} from "@wc-toolkit/cem-utilities";
import { getAttributeValueOptions } from "./utilities/cem-utils";

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
  private htmlDataProvider: html.IHTMLDataProvider | null = null;

  /** Absolute path to the custom elements manifest file */
  private manifestPath: string | null = null;

  /** Content of the manifest file as a string for position finding */
  private manifestContent: string = "";

  /** Map of attribute names to their options data */
  private attributeOptions: Map<string, string[] | string> = new Map();

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
    if (!manifest.modules) {
      return;
    }
    const components = getAllComponents(manifest);
    components.forEach((element) => {
      this.customElements.set(element.tagName!, element);
      this.setAttributeOptions(element);
    });
  }

  /** Sets the attribute options for a custom element. */
  private setAttributeOptions(component: Component) {
    component.attributes?.forEach((attr) => {
      const options = getAttributeValueOptions(attr);
      console.log(component.tagName, attr.name, options);
      this.attributeOptions.set(`${component.tagName}:${attr.name}`, options);
    });
  }

  /**
   * Creates HTML data for VS Code HTML language service integration.
   * Converts custom element definitions to HTML data format.
   */
  private createHTMLData() {
    // If the adapter doesn't support creating HTML data providers, we can't proceed
    if (!this.adapter.createHTMLDataFromCustomElements) {
      console.warn("Adapter does not support creating HTML data providers");
      return;
    }

    // Use the adapter to create the HTML data provider
    this.htmlDataProvider = this.adapter.createHTMLDataFromCustomElements(
      this.customElements,
      this.attributeOptions,
      this.findPositionInManifest.bind(this)
    );
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
  public getCompletionItems(): html.CompletionItem[] {
    if (this.adapter.createCustomElementCompletionItems) {
      return this.adapter.createCustomElementCompletionItems(
        this.customElements
      );
    }

    // Fallback for adapters that don't implement the new method
    const items: html.CompletionItem[] = [];
    for (const [tagName, element] of this.customElements) {
      const description =
        element.description || element.summary || `Custom element: ${tagName}`;
      items.push(this.adapter.createCompletionItem(tagName, description));
    }
    return items;
  }

  /**
   * Gets hover information for a specific custom element tag.
   * @param tagName - The tag name to get hover info for
   * @returns Hover information object or null if not found
   */
  public getHoverInfo(tagName: string): html.Hover | null {
    const element = this.customElements.get(tagName);
    if (!element) return null;

    if (this.adapter.createElementHoverInfo) {
      return this.adapter.createElementHoverInfo(tagName, element);
    }

    // Fallback
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
  public getHTMLDataProvider(): html.IHTMLDataProvider | null {
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
  public getAttributeCompletions(tagName: string): html.CompletionItem[] {
    const element = this.customElements.get(tagName);
    if (!element || !this.adapter.createAttributeCompletionItems) return [];

    return this.adapter.createAttributeCompletionItems(
      element,
      tagName,
      this.attributeOptions,
      this.findPositionInManifest.bind(this)
    );
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
  ): html.CompletionItem[] {
    const element = this.customElements.get(tagName);
    if (!element || !this.adapter.createAttributeValueCompletionItems)
      return [];

    return this.adapter.createAttributeValueCompletionItems(
      element,
      tagName,
      attributeName,
      this.attributeOptions,
      this.findPositionInManifest.bind(this)
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

    const position = 0;

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
    if (!element || !this.adapter.extractAttributesForAutoComplete) return null;

    const attributes = this.adapter.extractAttributesForAutoComplete(
      element,
      this.attributeOptions,
      this.findPositionInManifest.bind(this)
    );

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
    value = removeQuotes(value);
    const attrOptions = this.attributeOptions.get(
      `${tagName}:${attributeName}`
    );

    if (!attrOptions) {
      return null; // No validation possible
    }

    if (attrOptions === "boolean") {
      // If the attribute is a boolean, it should not have a value set
      return value
        ? `Invalid value ${value} for attribute "${attributeName}". This attribute is a boolean and should not have a value. The presence of this attribute itself will be "true" regardless of the value that is set.`
        : null;
    }

    if (attrOptions === "string") {
      // If the attribute is a string, no specific validation needed
      return null;
    }

    if (attrOptions === "number") {
      if (isNaN(Number(value))) {
        return `Value must be a valid number.`;
      }
    }

    // If the attribute has defined values, check against them
    if (Array.isArray(attrOptions)) {
      if (attrOptions.includes("string & {}")) {
        return null;
      }

      if (!attrOptions.includes(value)) {
        return `Invalid value "${value}" for attribute "${attributeName}". \nAllowed values: \`${attrOptions.join(
          " | "
        )}\``;
      }
    }

    return null; // No validation errors
  }
}
