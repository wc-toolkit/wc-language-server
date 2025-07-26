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

export class CustomElementsService {
  private customElements: Map<string, cem.CustomElement> = new Map();
  private manifestWatcher?: fs.StatWatcher;
  private htmlDataProvider: any = null;
  private manifestPath: string | null = null;
  private manifestContent: string = "";

  constructor(
    private workspaceRoot: string,
    private adapter: LanguageServerAdapter = new VSCodeAdapter()
  ) {
    this.loadCustomElementsManifest();
    this.watchManifestFile();
  }

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

  private findManifestFile(): string | null {
    const possiblePaths = [
      path.join(this.workspaceRoot, "custom-elements.json"),
      path.join(this.workspaceRoot, "dist", "custom-elements.json"),
      path.join(this.workspaceRoot, "src", "custom-elements.json"),
      path.join(this.workspaceRoot, "sample", "custom-elements.json"),
    ];

    for (const manifestPath of possiblePaths) {
      if (fs.existsSync(manifestPath)) {
        return manifestPath;
      }
    }
    return null;
  }

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

  private isCustomElementDeclaration(declaration: any): boolean {
    return (
      declaration.kind === "class" &&
      declaration.customElement === true &&
      declaration.tagName
    );
  }

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

  // Helper to extract enum values from type string
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

  // Public methods
  public getCompletionItems(): any[] {
    const items: any[] = [];

    for (const [tagName, element] of this.customElements) {
      const description =
        element.description || element.summary || `Custom element: ${tagName}`;

      items.push({
        // label: tagName,
        // kind: html.CompletionItemKind.Property,
        // documentation: description,
        // insertText: `${tagName}>$0</${tagName}>`,
        // insertTextFormat: html.InsertTextFormat.Snippet,
        // detail: 'Custom Element',
        label: tagName,
        kind: html.CompletionItemKind.Property,
        documentation: {
          kind: "markdown",
          value: description,
        },
        insertText: `<${tagName}>$0</${tagName}>`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: "Custom Element",
        sortText: "0" + tagName, // Sort custom elements first
      });
    }

    return items;
  }

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

  // Legacy methods for backwards compatibility
  public getCustomElements(): cem.CustomElement[] {
    return Array.from(this.customElements.values());
  }

  public getHTMLDataProvider(): any {
    return this.htmlDataProvider;
  }

  public getTagNames(): string[] {
    return Array.from(this.customElements.keys());
  }

  public dispose() {
    if (this.manifestWatcher) {
      this.manifestWatcher.unref();
    }
  }

  // Add a method to get attribute completions for a specific tag
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

  // Add a method to get attribute value completions
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

  // Add a helper to find a string's position in the manifest content
  private findPositionInManifest(searchText: string): number {
    if (!this.manifestContent) return 0;

    const position = this.manifestContent.indexOf(searchText);
    return position >= 0 ? position : 0;
  }

  // Add methods for definition provider
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
   * Validates attribute values against their schema
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
        return `Invalid value "${value}" for attribute "${attributeName}". Allowed values: ${allowedValues.join(", ")}`;
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
   * Validates that a value matches a specified type
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
          return `Invalid enum value "${value}". Expected one of: ${allowedValues.join(", ")}`;
        }
      }
    }

    return null; // No validation errors
  }
}

export function createCustomElementsCompletionService() {
  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: ["<"],
      },
    },
    create(context: any) {
      const workspaceRoot = context.env?.workspaceFolders?.[0]?.uri || "";
      // Create adapter first, then pass it to the service
      const adapter = new VSCodeAdapter();
      const customElementsService = new CustomElementsService(
        workspaceRoot,
        adapter
      );

      return {
        provideCompletionItems(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _document: any,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _position: any,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _completionContext: any
        ) {
          const customElements = customElementsService.getCustomElements();
          // Use the adapter to create the completion list
          return adapter.createCompletionList(customElements);
        },

        dispose() {
          customElementsService.dispose();
        },
      };
    },
  };
}
