/* eslint-disable @typescript-eslint/no-explicit-any */
import * as html from "vscode-html-languageservice";
import { HTMLDataAttribute, HTMLDataTag } from "..";
import {
  Component,
  getComponentDetailsTemplate,
  getMemberDescription,
} from "@wc-toolkit/cem-utilities";
import { NullableProviderResult } from "@volar/language-server";
import { customElementsService } from "../../services/custom-elements-service";
import { configurationService } from "../../services/configuration-service";
import path from "path";
import fs from "fs";

// Helper type for completion context
type CompletionContext =
  | { type: "tag" }
  | { type: "attribute"; tagName: string }
  | { type: "attributeValue"; tagName: string; attributeName: string }
  | { type: "none" };

/**
 * Service dedicated to handling HTML completions for custom elements.
 * Provides completion items, hover information, and validation for custom element attributes.
 */
export class VsCodeHtmlCompletionService {
  private htmlLanguageService!: html.LanguageService;
  private htmlDataProvider: html.IHTMLDataProvider | null = null;

  constructor() {
    this.initialize();
    customElementsService.onManifestChange(() => this.initialize());
  }

  private initialize(): void {
    this.createHTMLDataProvider();
    this.htmlLanguageService = html.getLanguageService({
      customDataProviders: this.htmlDataProvider ? [this.htmlDataProvider] : [],
      useDefaultDataProvider: true,
    });
  }

  private createHTMLDataProvider(): void {
    const customElements = customElementsService.getCustomElementsMap();
    const attributeOptions = customElementsService.getAttributeOptions();

    const tags: HTMLDataTag[] = Array.from(customElements.entries()).map(
      ([, element]) => {
        const formattedTagName = configurationService.getFormattedTagName(
          element.tagName!,
        );
        return {
          name: formattedTagName,
          description:
            getComponentDetailsTemplate(element) ||
            `Custom element: ${formattedTagName}`,
          attributes: this.extractAttributesData(element, attributeOptions),
        };
      },
    );

    this.htmlDataProvider = html.newHTMLDataProvider("custom-elements", {
      version: 1.1,
      tags: tags,
    });
  }

  private extractAttributesData(
    element: Component,
    attributeOptions: Map<string, string[] | string>,
  ): HTMLDataAttribute[] {
    const formattedTagName = configurationService.getFormattedTagName(
      element.tagName!,
    );
    return (element?.attributes || []).map((attr) => {
      const typeText =
        (attr as any)["parsedType"]?.text || attr.type?.text || "";
      const attrOptions = attributeOptions.get(
        `${formattedTagName}:${attr.name}`,
      );

      return {
        name: attr.name,
        description: getMemberDescription(attr.description, attr.deprecated),
        type: typeText,
        values: Array.isArray(attrOptions)
          ? attrOptions.map((option) => ({
              name: option,
              description: `Value: ${option}`,
            }))
          : [],
        sourcePosition: customElementsService.findPositionInManifest(
          `"attribute": "${attr.name}"`,
        ),
      };
    });
  }

  // This is the main method called by the plugin system
  public provideCompletionItems(
    document: html.TextDocument,
    position: html.Position,
  ): NullableProviderResult<html.CompletionList> {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const beforeText = text.substring(0, offset);

    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      text,
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    // Get base HTML completions first
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument,
    );

    // Enhance with custom completions based on context
    const context = this.parseCompletionContext(beforeText);

    switch (context.type) {
      case "tag":
        return this.enhanceTagCompletions(htmlCompletions);
      case "attribute":
        return this.enhanceAttributeCompletions(
          htmlCompletions,
          context.tagName,
        );
      case "attributeValue":
        return this.enhanceAttributeValueCompletions(
          htmlCompletions,
          context.tagName,
          context.attributeName,
        );
      default:
        return htmlCompletions;
    }
  }

  // This method is called by the vsCodeCustomSnippetsPlugin
  public createCustomSnippets(
    beforeText: string,
  ): NullableProviderResult<html.CompletionList> {
    // Don't provide snippets in attribute contexts
    if (
      this.parseCompletionContext(beforeText).type === "attribute" ||
      this.parseCompletionContext(beforeText).type === "attributeValue"
    ) {
      return { items: [], isIncomplete: false };
    }

    const elements = customElementsService.getCustomElements();
    const completionItems: html.CompletionItem[] = elements.map((element) => {
      const formattedTagName = configurationService.getFormattedTagName(
        element.tagName!,
      );
      return {
        label: formattedTagName,
        kind: html.CompletionItemKind.Snippet,
        documentation: {
          kind: "markdown",
          value: getComponentDetailsTemplate(element),
        },
        insertText: `<${formattedTagName}>$0</${formattedTagName}>`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: "Custom Element",
        sortText: "0" + formattedTagName,
      };
    });

    return {
      isIncomplete: false,
      items: completionItems,
    };
  }

  // Simplified context parsing
  private parseCompletionContext(beforeText: string): CompletionContext {
    // Tag completion: <my-elem|
    const tagMatch = beforeText.match(/<([a-zA-Z0-9-]*)$/);
    if (tagMatch) {
      return { type: "tag" };
    }

    // Attribute value completion: <my-elem attr="|
    const attrValueMatch = beforeText.match(
      /<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/,
    );
    if (attrValueMatch) {
      return {
        type: "attributeValue",
        tagName: attrValueMatch[1],
        attributeName: attrValueMatch[2],
      };
    }

    // Attribute name completion: <my-elem |
    const attrNameMatch = beforeText.match(
      /<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?\s+([a-zA-Z0-9-]*)$/,
    );
    if (attrNameMatch) {
      return {
        type: "attribute",
        tagName: attrNameMatch[1],
      };
    }

    return { type: "none" };
  }

  private enhanceTagCompletions(
    htmlCompletions: html.CompletionList,
  ): html.CompletionList {
    const customElements = customElementsService.getCustomElementsMap();

    const customCompletions: html.CompletionItem[] = Array.from(
      customElements.entries(),
    ).map(([, element]) => {
      const formattedTagName = configurationService.getFormattedTagName(
        element.tagName!,
      );
      return {
        label: formattedTagName,
        kind: html.CompletionItemKind.Snippet,
        documentation: {
          kind: "markdown",
          value: getComponentDetailsTemplate(element),
        },
        // Don't include < since it's already typed
        insertText: `${formattedTagName}>$0</${formattedTagName}>`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: "Custom Element",
        sortText: "0" + formattedTagName,
      };
    });

    htmlCompletions.items.push(...customCompletions);
    return htmlCompletions;
  }

  private enhanceAttributeCompletions(
    htmlCompletions: html.CompletionList,
    tagName: string,
  ): html.CompletionList {
    const formattedTagName = configurationService.getFormattedTagName(tagName);
    const element = customElementsService.getCustomElement(formattedTagName);
    if (!element) return htmlCompletions;

    const attributes = this.extractAttributesData(
      element,
      customElementsService.getAttributeOptions(),
    );

    const customCompletions: html.CompletionItem[] = attributes.map((attr) => {
      const hasValues = attr.values && attr.values.length > 0;
      const isBoolean = attr.type === "boolean";

      return {
        label: attr.name,
        kind: html.CompletionItemKind.Property,
        documentation: {
          kind: "markdown",
          value: `${attr.description}\n\n**Type:** \`${attr.type}\``,
        },
        insertText: hasValues
          ? `${attr.name}="$1"$0`
          : isBoolean
            ? attr.name
            : `${attr.name}="$0"`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        sortText: "0" + attr.name,
        command:
          hasValues && !isBoolean
            ? { command: "editor.action.triggerSuggest", title: "Suggest" }
            : undefined,
      };
    });

    htmlCompletions.items.push(...customCompletions);
    return htmlCompletions;
  }

  private enhanceAttributeValueCompletions(
    htmlCompletions: html.CompletionList,
    tagName: string,
    attributeName: string,
  ): html.CompletionList {
    const formattedTagName = configurationService.getFormattedTagName(tagName);
    const element = customElementsService.getCustomElement(formattedTagName);
    if (!element) return htmlCompletions;

    const attributes = this.extractAttributesData(
      element,
      customElementsService.getAttributeOptions(),
    );
    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (!attribute?.values?.length) return htmlCompletions;

    const customCompletions: html.CompletionItem[] = attribute.values.map(
      (value) => ({
        label: value.name,
        kind: html.CompletionItemKind.Value,
        documentation: {
          kind: "markdown",
          value: value.description || `Value for ${attribute.name} attribute`,
        },
        insertText: value.name,
        sortText: "0" + value.name,
      }),
    );

    htmlCompletions.items.push(...customCompletions);
    return htmlCompletions;
  }

  // Enhanced hover with custom logic
  public provideHover(
    document: html.TextDocument,
    position: html.Position,
  ): html.Hover | null {
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      document.getText(),
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);
    const offset = textDocument.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);

    if (!node?.tag) {
      return this.htmlLanguageService.doHover(
        textDocument,
        position,
        htmlDocument,
      );
    }

    const element = customElementsService.getCustomElement(node.tag);
    if (!element) {
      return this.htmlLanguageService.doHover(
        textDocument,
        position,
        htmlDocument,
      );
    }

    // Check if hovering over an attribute
    if (node.attributes) {
      const cursorOffset = document.offsetAt(position);
      const attributes = this.extractAttributesData(
        element,
        customElementsService.getAttributeOptions(),
      );

      for (const attrName in node.attributes) {
        const attrValue = node.attributes[attrName];
        const tagOffset = node.start;
        const tagText = document.getText().slice(tagOffset, node.end);
        const attrStart = tagText.indexOf(attrName);
        const attrEnd = attrStart + attrName.length + (attrValue?.length || 0);

        if (
          cursorOffset >= tagOffset + attrStart &&
          cursorOffset <= tagOffset + attrEnd
        ) {
          const attribute = attributes.find((a) => a.name === attrName);
          if (attribute) {
            return {
              contents: `${attribute.description}\n\n**Type:** \`${attribute.type}\``,
            };
          }
        }
      }
    }

    // Tag hover
    return {
      contents: getComponentDetailsTemplate(element),
    };
  }

  // Definition methods
  public getTagDefinition(tagName: string): html.Location | null {
    const manifestPath = customElementsService.getManifestPath();
    const element = customElementsService.getCustomElement(tagName);
    if (!manifestPath || !element) {
      return null;
    }

    // Search for the tag name definition in the manifest
    const searchPatterns = [
      `"tagName": "${element.tagName}"`,
      `"name": "${element.name}"`,
      `"tag": "${element.tagName}"`,
    ];

    let position = 0;
    for (const pattern of searchPatterns) {
      position = customElementsService.findPositionInManifest(pattern);
      if (position > 0) break;
    }

    return {
      uri: manifestPath.startsWith("file://")
        ? manifestPath
        : `file://${path.resolve(manifestPath)}`,
      range: this.positionToRange(position, manifestPath),
    };
  }

  public getAttributeDefinition(
    tagName: string,
    attributeName: string,
  ): html.Location | null {
    const manifestPath = customElementsService.getManifestPath();
    const element = customElementsService.getCustomElement(tagName);

    if (!manifestPath || !element) return null;

    try {
      const content = fs.readFileSync(manifestPath, "utf8");
      console.log(
        `Searching for attribute "${attributeName}" in element "${tagName}"`,
      );

      // First find the element definition
      const elementSearchPatterns = [
        `"tagName": "${element.tagName}"`,
        `"name": "${element.name}"`,
        `"tag": "${element.tagName}"`,
      ];

      let elementPosition = -1;
      for (const pattern of elementSearchPatterns) {
        elementPosition = content.indexOf(pattern);
        if (elementPosition !== -1) {
          console.log(
            `Found element at position ${elementPosition} with pattern: ${pattern}`,
          );
          break;
        }
      }

      if (elementPosition === -1) return null;

      // Find the attributes array within this element
      const attributesStart = content.indexOf('"attributes":', elementPosition);
      if (attributesStart === -1) {
        console.log("No attributes array found");
        return null;
      }

      console.log(`Found attributes array at position ${attributesStart}`);

      // Find the end of the attributes array by looking for the closing bracket
      const attributesArrayStart = content.indexOf("[", attributesStart);
      if (attributesArrayStart === -1) return null;

      // Find the matching closing bracket for the attributes array
      let bracketCount = 1;
      let attributesEnd = attributesArrayStart + 1;
      while (bracketCount > 0 && attributesEnd < content.length) {
        if (content[attributesEnd] === "[") bracketCount++;
        else if (content[attributesEnd] === "]") bracketCount--;
        attributesEnd++;
      }

      // Search for the specific attribute within the attributes array only
      const attributesSection = content.substring(
        attributesArrayStart,
        attributesEnd,
      );
      console.log(
        `Attributes section: ${attributesSection.substring(0, 200)}...`,
      );

      // More precise regex to find the attribute object
      const attributeRegex = new RegExp(
        `\\{[^{}]*"name"\\s*:\\s*"${attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^{}]*\\}`,
        "g",
      );
      const match = attributeRegex.exec(attributesSection);

      let attributePosition = attributesStart;
      if (match) {
        attributePosition = attributesArrayStart + match.index;
        console.log(
          `Found attribute match at relative position ${match.index}, absolute position ${attributePosition}`,
        );
        console.log(`Matched text: ${match[0]}`);
      } else {
        console.log(`No regex match found, falling back to simple search`);
        // Fallback: look for just the name field
        const namePattern = `"name": "${attributeName}"`;
        const namePos = attributesSection.indexOf(namePattern);
        if (namePos !== -1) {
          attributePosition = attributesArrayStart + namePos;
          console.log(`Found fallback match at position ${attributePosition}`);
        } else {
          console.log(`No fallback match found either`);
        }
      }

      console.log(`Final attribute position: ${attributePosition}`);

      return {
        uri: manifestPath.startsWith("file://")
          ? manifestPath
          : `file://${path.resolve(manifestPath)}`,
        range: this.positionToRange(attributePosition, manifestPath),
      };
    } catch (error) {
      console.error("Error in getAttributeDefinition:", error);
      return null;
    }
  }

  // Method called by CustomHtmlService for attribute definitions
  public createAttributeDefinitionLocation(
    _tagName: string,
    _attributeName: string,
    manifestPath: string,
    position: number,
  ): html.Location | null {
    return {
      uri: manifestPath.startsWith("file://")
        ? manifestPath
        : `file://${path.resolve(manifestPath)}`,
      range: this.positionToRange(position, manifestPath),
    };
  }

  private positionToRange(position: number, manifestPath?: string): html.Range {
    if (!manifestPath) {
      return {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 },
      };
    }

    try {
      const content = fs.readFileSync(manifestPath, "utf8");
      const lines = content.substring(0, position).split("\n");
      const line = Math.max(0, lines.length - 1);
      const character = lines[line]?.length || 0;

      return {
        start: { line, character },
        end: { line, character: character + 10 },
      };
    } catch {
      return {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 10 },
      };
    }
  }

  // Utility methods that might be needed
  public getHTMLDataProvider(): html.IHTMLDataProvider | null {
    return this.htmlDataProvider;
  }
}

// Singleton instance holder and factory
let _singletonService: VsCodeHtmlCompletionService | undefined;

/**
 * Returns a singleton instance of VsCodeHtmlCompletionService for the given services.
 * If called multiple times with the same arguments, returns the same instance.
 */
function getVsCodeHtmlCompletionService(): VsCodeHtmlCompletionService {
  if (!_singletonService) {
    _singletonService = new VsCodeHtmlCompletionService();
  }
  return _singletonService;
}

export const htmlCompletionService = getVsCodeHtmlCompletionService();
