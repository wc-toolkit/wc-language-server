// /* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from "fs";
import * as path from "path";
import type * as cem from "custom-elements-manifest/schema" with { "resolution-mode": "require" };
import {
  Component,
  getAllComponents,
  removeQuotes,
} from "@wc-toolkit/cem-utilities";
import { getAttributeValueOptions } from "./utilities/cem-utils";

/**
 * Generic attribute information interface
 */
export interface AttributeInfo {
  name: string;
  description?: string;
  type?: string;
  sourcePosition?: number;
}

/**
 * Key type for attribute options map, formatted as "tagName:attributeName".
 * This allows for namespaced attributes if needed in the future.
 */
export type AttributeKey = `${string}:${string}`;

/**
 * Map of attribute names to their types.
 */
export type AttributeTypes = Map<AttributeKey, string[] | string>;

/**
 * Pure data service for managing custom elements manifest data.
 * This service only handles loading, parsing, and providing access to the raw data.
 * All language features (completions, hover, definitions) are handled by adapters.
 */
export class CustomElementsService {
  /** Map of custom element tag names to their definitions */
  private customElements: Map<string, Component> = new Map();

  /** File watcher for the custom elements manifest file */
  private manifestWatcher?: fs.StatWatcher;

  /** Absolute path to the custom elements manifest file */
  private manifestPath: string | null = null;

  /** Content of the manifest file as a string for position finding */
  private manifestContent: string = "";

  /** Map of attribute names to their options data */
  private attributeOptions: AttributeTypes = new Map();

  /** Array of change listeners */
  private changeListeners: (() => void)[] = [];

  /**
   * Creates a new CustomElementsService instance.
   * @param workspaceRoot - Root directory of the workspace
   */
  constructor(private workspaceRoot: string) {
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
      this.notifyChange();
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
      path.join(this.workspaceRoot, "demos", "html", "custom-elements.json"),
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
   * Notifies all registered callbacks that the manifest has changed.
   */
  private notifyChange() {
    this.changeListeners.forEach((callback) => callback());
  }

  /**
   * Registers a callback to be called when the manifest changes.
   * @param callback - Function to call when the manifest changes
   * @returns A function to unregister the callback
   */
  public onManifestChange(callback: () => void): () => void {
    this.changeListeners.push(callback);
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Gets all custom element definitions (legacy method for backwards compatibility).
   * @returns Array of all custom element definitions
   */
  public getCustomElements(): Component[] {
    return Array.from(this.customElements.values());
  }

  /**
   * Gets the raw custom elements map.
   * @returns Map of custom element tag names to their definitions
   */
  public getCustomElementsMap(): Map<string, Component> {
    return new Map(this.customElements);
  }

  /**
   * Gets the attribute options map.
   * @returns Map of attribute names to their options data
   */
  public getAttributeOptions(): AttributeTypes {
    return new Map(this.attributeOptions);
  }

  /**
   * Gets all custom element tag names.
   * @returns Array of custom element tag names
   */
  public getTagNames(): string[] {
    return Array.from(this.customElements.keys());
  }

  /**
   * Checks if a custom element with the given tag name exists.
   * @param tagName - The tag name to check
   * @returns True if the custom element exists
   */
  public hasCustomElement(tagName: string): boolean {
    return this.customElements.has(tagName);
  }

  /**
   * Gets a custom element by tag name.
   * @param tagName - The tag name to get
   * @returns The custom element definition or null if not found
   */
  public getCustomElement(tagName: string): Component | null {
    return this.customElements.get(tagName) || null;
  }

  /**
   * Gets the path to the custom elements manifest file.
   * @returns The absolute path to the manifest file or null if not found
   */
  public getManifestPath(): string | null {
    return this.manifestPath;
  }

  /**
   * Gets attribute information for a specific custom element tag.
   * @param tagName - The tag name to get attribute info for
   * @returns Array of attribute information objects
   */
  public getAttributeInfo(tagName: string): AttributeInfo[] {
    const element = this.customElements.get(tagName);
    if (!element || !element.attributes) return [];

    return element.attributes.map((attr) => ({
      name: attr.name!,
      description: attr.description || attr.summary,
      type: attr.type?.text || "string",
      sourcePosition: this.findPositionInManifest(attr.name!),
    }));
  }

  /**
   * Gets attribute value options for a specific attribute.
   * @param tagName - The tag name containing the attribute
   * @param attributeName - The attribute name to get value options for
   * @returns Array of possible values or type information
   */
  public getAttributeValueOptions(
    tagName: string,
    attributeName: string
  ): string[] | string | null {
    const key: AttributeKey = `${tagName}:${attributeName}`;
    const options = this.attributeOptions.get(key);
    return options || null;
  }

  /**
   * Finds the character position of a search string in the manifest content.
   * @param searchText - The text to search for
   * @returns The character position or 0 if not found
   */
  public findPositionInManifest(searchText: string): number {
    if (!this.manifestContent) return 0;

    const position = this.manifestContent.indexOf(searchText);
    return position >= 0 ? position : 0;
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

  /**
   * Disposes of the service and cleans up resources.
   * Stops file watching and clears data.
   */
  public dispose() {
    if (this.manifestWatcher) {
      this.manifestWatcher.unref();
    }
    this.changeListeners.length = 0;
  }
}
