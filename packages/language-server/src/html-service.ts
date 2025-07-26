/* eslint-disable @typescript-eslint/no-explicit-any */
import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { CustomElementsService } from "./custom-elements-service";
import { VSCodeAdapter } from "./adapters";

export class CustomHtmlService {
  private customElementsService: CustomElementsService;
  private htmlLanguageService: html.LanguageService;

  constructor(workspaceRoot: string, adapter?: VSCodeAdapter) {
    // Create custom elements service with adapter
    this.customElementsService = new CustomElementsService(
      workspaceRoot,
      adapter || new VSCodeAdapter()
    );

    // Get HTML data provider from custom elements service
    const htmlDataProvider = this.customElementsService.getHTMLDataProvider();

    // Create HTML language service with custom data
    this.htmlLanguageService = html.getLanguageService({
      customDataProviders: htmlDataProvider ? [htmlDataProvider] : [],
      useDefaultDataProvider: true,
    });
  }

  // Public API methods
  public provideCompletionItems(
    document: any,
    position: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _completionContext?: any
  ) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const beforeText = text.substring(0, offset);

    // Create text document for HTML service
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      text
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    // Handle different completion scenarios
    if (this.isTagCompletion(beforeText)) {
      return this.handleTagCompletion(textDocument, position, htmlDocument);
    }

    if (this.isAttributeNameCompletion(beforeText)) {
      return this.handleAttributeNameCompletion(
        beforeText,
        textDocument,
        position,
        htmlDocument
      );
    }

    if (this.isAttributeValueCompletion(beforeText)) {
      return this.handleAttributeValueCompletion(
        beforeText,
        textDocument,
        position,
        htmlDocument
      );
    }

    // Default: Let HTML service handle all other completion scenarios
    return this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );
  }

  public provideHover(document: any, position: any) {
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      document.getText()
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    return this.htmlLanguageService.doHover(
      textDocument,
      position,
      htmlDocument
    );
  }

  public provideDefinition(document: any, position: any) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const currentWord = this.getCurrentWord(text, offset);

    if (!currentWord) {
      return null;
    }

    // Check if the word is a custom element tag
    if (this.customElementsService.getTagNames().includes(currentWord)) {
      return this.customElementsService.getTagDefinition(currentWord);
    }

    // Check if the word is an attribute
    const tagName = this.findContainingTag(text, position, offset);
    if (!tagName) {
      return null;
    }

    const attributeDefinition =
      this.customElementsService.getAttributeDefinition(tagName, currentWord);

    return attributeDefinition || null;
  }

  public provideDiagnostics(document: any) {
    const text = document.getText();
    const textDocument = html.TextDocument.create(
      document.uri,
      "html",
      0,
      text
    );
    const htmlDocument =
      this.htmlLanguageService.parseHTMLDocument(textDocument);

    const diagnostics: html.Diagnostic[] = [];

    // Process each element in the document
    for (const node of htmlDocument.roots) {
      this.validateNode(node, document, diagnostics);
    }

    return diagnostics;
  }

  public dispose() {
    this.customElementsService.dispose();
  }

  // Private helper methods
  private isTagCompletion(beforeText: string): boolean {
    return !!beforeText.match(/<([a-zA-Z0-9-]*)$/);
  }

  private isAttributeNameCompletion(beforeText: string): boolean {
    return !!beforeText.match(
      /<([a-zA-Z0-9-]+)(?:\s+[a-zA-Z0-9-]+(=(?:["'][^"']*["'])?))*\s+([a-zA-Z0-9-]*)$/
    );
  }

  private isAttributeValueCompletion(beforeText: string): boolean {
    return !!beforeText.match(
      /<([a-zA-Z0-9-]+)\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/
    );
  }

  private handleTagCompletion(
    textDocument: html.TextDocument,
    position: any,
    htmlDocument: html.HTMLDocument
  ) {
    // Get completions from HTML service
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    // Add custom element completions
    const customCompletions = this.customElementsService.getCompletionItems();
    htmlCompletions.items.push(...customCompletions);

    return htmlCompletions;
  }

  private handleAttributeNameCompletion(
    beforeText: string,
    textDocument: html.TextDocument,
    position: any,
    htmlDocument: html.HTMLDocument
  ) {
    const attrNameMatch = beforeText.match(
      /<([a-zA-Z0-9-]+)(?:\s+[a-zA-Z0-9-]+(=(?:["'][^"']*["'])?))*\s+([a-zA-Z0-9-]*)$/
    );

    if (!attrNameMatch) {
      return null;
    }

    const tagName = attrNameMatch[1];

    // Get default HTML attribute completions
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    // Add custom element attribute completions
    const customAttrCompletions =
      this.customElementsService.getAttributeCompletions(tagName);
    htmlCompletions.items.push(...customAttrCompletions);

    return htmlCompletions;
  }

  private handleAttributeValueCompletion(
    beforeText: string,
    textDocument: html.TextDocument,
    position: any,
    htmlDocument: html.HTMLDocument
  ) {
    const attrValueMatch = beforeText.match(
      /<([a-zA-Z0-9-]+)\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/
    );

    if (!attrValueMatch) {
      return null;
    }

    const tagName = attrValueMatch[1];
    const attrName = attrValueMatch[2];

    // Let HTML service handle it first for standard attributes
    const htmlCompletions = this.htmlLanguageService.doComplete(
      textDocument,
      position,
      htmlDocument
    );

    // Add custom attribute value completions
    const customValueCompletions =
      this.customElementsService.getAttributeValueCompletions(
        tagName,
        attrName
      );

    // Set the range for each completion item for proper replacement
    if (customValueCompletions.length === 0) {
      return htmlCompletions;
    }

    const attrValuePos = position.character - (attrValueMatch[3]?.length || 0);
    const valueRange = {
      start: { line: position.line, character: attrValuePos },
      end: position,
    };

    // Apply the range to each completion item's textEdit
    customValueCompletions.forEach((item) => {
      if (item.textEdit) {
        item.textEdit.range = valueRange;
      }
    });

    htmlCompletions.items.push(...customValueCompletions);
    return htmlCompletions;
  }

  private getCurrentWord(text: string, offset: number): string | null {
    const wordPattern = /[a-zA-Z0-9-]+/;
    let wordStart = offset;
    let wordEnd = offset;

    // Find word start
    while (wordStart > 0 && wordPattern.test(text[wordStart - 1])) {
      wordStart--;
    }

    // Find word end
    while (wordEnd < text.length && wordPattern.test(text[wordEnd])) {
      wordEnd++;
    }

    if (wordStart === wordEnd) {
      return null;
    }

    return text.substring(wordStart, wordEnd);
  }

  private findContainingTag(
    text: string,
    position: any,
    offset: number
  ): string | null {
    const textDocument = html.TextDocument.create("", "html", 0, text);
    const scanner = this.htmlLanguageService.createScanner(text);
    let tagName = "";
    let token = scanner.scan();

    while (token !== html.TokenType.EOS) {
      if (token !== html.TokenType.StartTag) {
        token = scanner.scan();
        continue;
      }

      const currentTagName = scanner.getTokenText();
      const tagRange = {
        start: textDocument.positionAt(scanner.getTokenOffset()),
        end: textDocument.positionAt(scanner.getTokenEnd()),
      };

      // If the tag contains our position
      if (
        position.line >= tagRange.start.line &&
        position.character >= tagRange.start.character &&
        scanner.getTokenEnd() > offset
      ) {
        tagName = currentTagName;
        break;
      }

      token = scanner.scan();
    }

    return tagName || null;
  }

  private validateNode(
    node: any,
    document: any,
    diagnostics: html.Diagnostic[]
  ) {
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
    if (!this.customElementsService.getTagNames().includes(tagName)) {
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
        const errorMessage = this.customElementsService.validateAttributeValue(
          tagName,
          attrName,
          attrValue
        );

        // If there's no error, continue
        if (!errorMessage) {
          continue;
        }

        // Find the attribute position in the document
        const startOffset = this.findAttributeOffset(
          document.getText(),
          node,
          attrName
        );

        if (startOffset === -1) {
          continue;
        }

        const startPos = document.positionAt(startOffset);
        const endPos = document.positionAt(
          startOffset + attrName.length + attrValue.length + 3
        ); // +3 for ="

        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: startPos,
            end: endPos,
          },
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

  private findAttributeOffset(
    text: string,
    node: any,
    attrName: string
  ): number {
    // Find the start of the element
    const elementStart = node.start;
    const elementEnd = node.end;

    // Extract the element text
    const elementText = text.substring(elementStart, elementEnd);

    // Look for the attribute
    const attrRegex = new RegExp(`\\s${attrName}\\s*=\\s*["']`, "g");
    const match = attrRegex.exec(elementText);

    if (!match) {
      return -1;
    }

    return elementStart + match.index + 1; // +1 to skip the initial space
  }
}

// Add a static method to create the service plugin
export function createCustomHtmlServicePlugin() {
  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: ["<", " ", "=", '"', "'", ">"],
      },
      hoverProvider: true,
      definitionProvider: true,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create(context: any) {
      const workspaceFolders = context.env?.workspaceFolders;
      const workspaceRoot = workspaceFolders?.[0]?.uri || "";

      const service = new CustomHtmlService(workspaceRoot);

      return {
        provideCompletionItems: service.provideCompletionItems.bind(service),
        provideHover: service.provideHover.bind(service),
        provideDefinition: service.provideDefinition.bind(service),
        provideDiagnostics: service.provideDiagnostics.bind(service),
        dispose: service.dispose.bind(service),
      };
    },
  };
}
