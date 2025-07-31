/* eslint-disable @typescript-eslint/no-explicit-any */
import * as html from "vscode-html-languageservice";
import { HTMLDataAttribute, HTMLDataTag } from "..";
import {
  Component,
  getComponentDetailsTemplate,
  getMemberDescription,
} from "@wc-toolkit/cem-utilities";
import { NullableProviderResult } from "@volar/language-server";
import { CustomElementsService } from "../../services/custom-elements-service";

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

  constructor(private customElementsService: CustomElementsService) {
    this.initialize();
    this.customElementsService.onManifestChange(() => this.initialize());
  }

  private initialize(): void {
    this.createHTMLDataProvider();
    this.htmlLanguageService = html.getLanguageService({
      customDataProviders: this.htmlDataProvider ? [this.htmlDataProvider] : [],
      useDefaultDataProvider: true,
    });
  }

  private createHTMLDataProvider(): void {
    const customElements = this.customElementsService.getCustomElementsMap();
    const attributeOptions = this.customElementsService.getAttributeOptions();

    const tags: HTMLDataTag[] = Array.from(customElements.entries()).map(
      ([tagName, element]) => ({
        name: tagName,
        description:
          getComponentDetailsTemplate(element) || `Custom element: ${tagName}`,
        attributes: this.extractAttributesData(element, attributeOptions),
      })
    );

    this.htmlDataProvider = html.newHTMLDataProvider("custom-elements", {
      version: 1.1,
      tags: tags,
    });
  }

  private extractAttributesData(
    element: Component,
    attributeOptions: Map<string, string[] | string>
  ): HTMLDataAttribute[] {
    return (element?.attributes || []).map((attr) => {
      const typeText =
        (attr as any)["parsedType"]?.text || attr.type?.text || "";
      const attrOptions = attributeOptions.get(
        `${element.tagName}:${attr.name}`
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
        sourcePosition: this.customElementsService.findPositionInManifest(
          `"attribute": "${attr.name}"`
        ),
      };
    });
  }

  // This is the main method called by the plugin system
  public provideCompletionItems(
    document: html.TextDocument,
    position: html.Position
  ): NullableProviderResult<html.CompletionList> {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const beforeText = text.substring(0, offset);

    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      text
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    // Get base HTML completions first
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    // Enhance with custom completions based on context
    const context = this.parseCompletionContext(beforeText);

    switch (context.type) {
      case "tag":
        return this.enhanceTagCompletions(htmlCompletions);
      case "attribute":
        return this.enhanceAttributeCompletions(
          htmlCompletions,
          context.tagName
        );
      case "attributeValue":
        return this.enhanceAttributeValueCompletions(
          htmlCompletions,
          context.tagName,
          context.attributeName
        );
      default:
        return htmlCompletions;
    }
  }

  // This method is called by the vsCodeCustomSnippetsPlugin
  public createCustomSnippets(
    elements: Component[],
    beforeText: string
  ): NullableProviderResult<html.CompletionList> {
    // Don't provide snippets in attribute contexts
    if (
      this.parseCompletionContext(beforeText).type === "attribute" ||
      this.parseCompletionContext(beforeText).type === "attributeValue"
    ) {
      return { items: [], isIncomplete: false };
    }

    const completionItems: html.CompletionItem[] = elements.map((element) => ({
      label: element.tagName!,
      kind: html.CompletionItemKind.Snippet,
      documentation: {
        kind: "markdown",
        value: getComponentDetailsTemplate(element),
      },
      insertText: `<${element.tagName}>$0</${element.tagName}>`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      detail: "Custom Element",
      sortText: "0" + element.tagName,
    }));

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
      /<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/
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
      /<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?\s+([a-zA-Z0-9-]*)$/
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
    htmlCompletions: html.CompletionList
  ): html.CompletionList {
    const customElements = this.customElementsService.getCustomElementsMap();

    const customCompletions: html.CompletionItem[] = Array.from(
      customElements.entries()
    ).map(([tagName, element]) => ({
      label: tagName,
      kind: html.CompletionItemKind.Property,
      documentation: {
        kind: "markdown",
        value: getComponentDetailsTemplate(element),
      },
      // Don't include < since it's already typed
      insertText: `${tagName}>$0</${tagName}>`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      detail: "Custom Element",
      sortText: "0" + tagName,
    }));

    htmlCompletions.items.push(...customCompletions);
    return htmlCompletions;
  }

  private enhanceAttributeCompletions(
    htmlCompletions: html.CompletionList,
    tagName: string
  ): html.CompletionList {
    const element = this.customElementsService.getCustomElement(tagName);
    if (!element) return htmlCompletions;

    const attributes = this.extractAttributesData(
      element,
      this.customElementsService.getAttributeOptions()
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
    attributeName: string
  ): html.CompletionList {
    const element = this.customElementsService.getCustomElement(tagName);
    if (!element) return htmlCompletions;

    const attributes = this.extractAttributesData(
      element,
      this.customElementsService.getAttributeOptions()
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
      })
    );

    htmlCompletions.items.push(...customCompletions);
    return htmlCompletions;
  }

  // Enhanced hover with custom logic
  public provideHover(
    document: html.TextDocument,
    position: html.Position
  ): html.Hover | null {
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      document.getText()
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);
    const offset = textDocument.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);

    if (!node?.tag) {
      return this.htmlLanguageService.doHover(
        textDocument,
        position,
        htmlDocument
      );
    }

    const element = this.customElementsService.getCustomElement(node.tag);
    if (!element) {
      return this.htmlLanguageService.doHover(
        textDocument,
        position,
        htmlDocument
      );
    }

    // Check if hovering over an attribute
    if (node.attributes) {
      const cursorOffset = document.offsetAt(position);
      const attributes = this.extractAttributesData(
        element,
        this.customElementsService.getAttributeOptions()
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

  // Legacy methods that might be called by the existing CustomHtmlService
  public getCompletionItems(): html.CompletionItem[] {
    const customElements = this.customElementsService.getCustomElementsMap();
    const items: html.CompletionItem[] = [];

    for (const [tagName, element] of customElements) {
      items.push({
        label: tagName,
        kind: html.CompletionItemKind.Property,
        documentation: {
          kind: "markdown",
          value: getComponentDetailsTemplate(element),
        },
        insertText: `${tagName}>$0</${tagName}>`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: "Custom Element",
        sortText: "0" + tagName,
      });
    }

    return items;
  }

  public getAttributeCompletions(tagName: string): html.CompletionItem[] {
    const element = this.customElementsService.getCustomElement(tagName);
    if (!element) return [];

    const attributes = this.extractAttributesData(
      element,
      this.customElementsService.getAttributeOptions()
    );

    return attributes.map((attr) => {
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
  }

  public getAttributeValueCompletions(
    tagName: string,
    attributeName: string
  ): html.CompletionItem[] {
    const element = this.customElementsService.getCustomElement(tagName);
    if (!element) return [];

    const attributes = this.extractAttributesData(
      element,
      this.customElementsService.getAttributeOptions()
    );
    const attribute = attributes.find((attr) => attr.name === attributeName);

    if (!attribute?.values?.length) return [];

    return attribute.values.map((value) => ({
      label: value.name,
      kind: html.CompletionItemKind.Value,
      documentation: {
        kind: "markdown",
        value: value.description || `Value for ${attribute.name} attribute`,
      },
      insertText: value.name,
      sortText: "0" + value.name,
    }));
  }

  // Definition methods
  public getTagDefinition(tagName: string): html.Location | null {
    const manifestPath = this.customElementsService.getManifestPath();
    if (
      !manifestPath ||
      !this.customElementsService.getCustomElement(tagName)
    ) {
      return null;
    }

    return {
      uri: `file://${manifestPath.startsWith("/") ? manifestPath : "/" + manifestPath}`,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  public getAttributeDefinition(
    tagName: string,
    attributeName: string
  ): html.Location | null {
    const manifestPath = this.customElementsService.getManifestPath();
    const element = this.customElementsService.getCustomElement(tagName);

    if (!manifestPath || !element) return null;

    const position = this.customElementsService.findPositionInManifest(
      `"attribute": "${attributeName}"`
    );

    return {
      uri: `file://${manifestPath}`,
      range: this.positionToRange(position),
    };
  }

  // Method called by CustomHtmlService for attribute definitions
  public createAttributeDefinitionLocation(
    _tagName: string,
    _attributeName: string,
    manifestPath: string,
    position: number
  ): html.Location | null {
    return {
      uri: `file://${manifestPath}`,
      range: this.positionToRange(position),
    };
  }

  private positionToRange(position: number): html.Range {
    const line = Math.floor(position / 40);
    const char = position % 40;
    return {
      start: { line, character: char },
      end: { line, character: char + 10 },
    };
  }

  // Utility methods that might be needed
  public getHTMLDataProvider(): html.IHTMLDataProvider | null {
    return this.htmlDataProvider;
  }
}
