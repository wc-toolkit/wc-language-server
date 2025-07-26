/* eslint-disable @typescript-eslint/no-explicit-any */
import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { CustomElementsService } from "./custom-elements-service";
import { VSCodeAdapter } from "./adapters";

export function createCustomHtmlService() {
  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: ["<", " ", "=", '"', "'", ">"],
      },
      hoverProvider: true,
      definitionProvider: true, // Enable definition provider
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create(context: any) {
      // Get workspace root from context
      const workspaceFolders = context.env?.workspaceFolders;
      const workspaceRoot = workspaceFolders?.[0]?.uri || "";

      // Create custom elements service with VSCodeAdapter
      const adapter = new VSCodeAdapter();
      const customElementsService = new CustomElementsService(
        workspaceRoot,
        adapter,
      );

      // Get HTML data provider from custom elements service
      const htmlDataProvider = customElementsService.getHTMLDataProvider();

      // Create HTML language service with custom data
      const htmlLanguageService = html.getLanguageService({
        customDataProviders: htmlDataProvider ? [htmlDataProvider] : [],
        useDefaultDataProvider: true,
      });

      return {
        provideCompletionItems(
          document: any,
          position: any,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          _completionContext: any,
        ) {
          const text = document.getText();
          const offset = document.offsetAt(position);
          const beforeText = text.substring(0, offset);

          // Create text document for HTML service
          const textDocument = html.TextDocument.create(
            document.uri,
            "html",
            0,
            text,
          );
          const htmlDocument =
            htmlLanguageService.parseHTMLDocument(textDocument);

          // Case 1: Handle tag name completion (after <)
          const tagMatch = beforeText.match(/<([a-zA-Z0-9-]*)$/);
          if (tagMatch) {
            // Get completions from HTML service
            const htmlCompletions = htmlLanguageService.doComplete(
              textDocument,
              position,
              htmlDocument,
            );

            // Add custom element completions
            const customCompletions =
              customElementsService.getCompletionItems();
            htmlCompletions.items.push(...customCompletions);

            return htmlCompletions;
          }

          // Case 2: Handle attribute name completion
          // Match: <tag-name |, <tag-name a|, or <tag-name attr="value" |
          const attrNameMatch = beforeText.match(
            /<([a-zA-Z0-9-]+)(?:\s+[a-zA-Z0-9-]+(=(?:["'][^"']*["'])?))*\s+([a-zA-Z0-9-]*)$/,
          );
          if (attrNameMatch) {
            const tagName = attrNameMatch[1];

            // Get default HTML attribute completions
            const htmlCompletions = htmlLanguageService.doComplete(
              textDocument,
              position,
              htmlDocument,
            );

            // Add custom element attribute completions
            const customAttrCompletions =
              customElementsService.getAttributeCompletions(tagName);
            htmlCompletions.items.push(...customAttrCompletions);

            return htmlCompletions;
          }

          // Case 3: Handle attribute value completion
          // Match: <tag attr="|, <tag attr=|, <tag attr='|
          const attrValueMatch = beforeText.match(
            /<([a-zA-Z0-9-]+)\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/,
          );
          if (attrValueMatch) {
            const tagName = attrValueMatch[1];
            const attrName = attrValueMatch[2];

            // Let HTML service handle it first for standard attributes
            const htmlCompletions = htmlLanguageService.doComplete(
              textDocument,
              position,
              htmlDocument,
            );

            // Add custom attribute value completions
            const customValueCompletions =
              customElementsService.getAttributeValueCompletions(
                tagName,
                attrName,
              );

            // Set the range for each completion item for proper replacement
            if (customValueCompletions.length > 0) {
              // Get the start position of the attribute value
              const attrValuePos =
                position.character - (attrValueMatch[3]?.length || 0);
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
            }

            return htmlCompletions;
          }

          // Default: Let HTML service handle all other completion scenarios
          return htmlLanguageService.doComplete(
            textDocument,
            position,
            htmlDocument,
          );
        },

        // Add hover support
        provideHover(document: any, position: any) {
          const textDocument = html.TextDocument.create(
            document.uri,
            "html",
            0,
            document.getText(),
          );
          const htmlDocument =
            htmlLanguageService.parseHTMLDocument(textDocument);

          return htmlLanguageService.doHover(
            textDocument,
            position,
            htmlDocument,
          );
        },

        // Add definition provider
        provideDefinition(document: any, position: any) {
          const text = document.getText();
          const offset = document.offsetAt(position);
          const textDocument = html.TextDocument.create(
            document.uri,
            "html",
            0,
            text,
          );

          // Get the current word under cursor
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

          if (wordStart === wordEnd) return null;

          const currentWord = text.substring(wordStart, wordEnd);

          // Check if the word is a custom element tag
          if (customElementsService.getTagNames().includes(currentWord)) {
            return customElementsService.getTagDefinition(currentWord);
          }

          // Check if the word is an attribute
          // First, find the current tag
          const scanner = htmlLanguageService.createScanner(text);
          let tagName = "";
          let token = scanner.scan();

          while (token !== html.TokenType.EOS) {
            if (token === html.TokenType.StartTag) {
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
            }
            token = scanner.scan();
          }

          // If we found a tag and the current word might be an attribute
          if (tagName && currentWord) {
            const attributeDefinition =
              customElementsService.getAttributeDefinition(
                tagName,
                currentWord,
              );

            if (attributeDefinition) {
              return attributeDefinition;
            }
          }

          // Fall back to standard HTML definition
          return null;
        },

        // Add diagnostic support
        provideDiagnostics(document: any) {
          const text = document.getText();
          const textDocument = html.TextDocument.create(
            document.uri,
            "html",
            0,
            text,
          );
          const htmlDocument =
            htmlLanguageService.parseHTMLDocument(textDocument);

          // Create array to hold diagnostic results
          const diagnostics: html.Diagnostic[] = [];

          // Process each element in the document
          for (const node of htmlDocument.roots) {
            this.validateNode(
              node,
              document,
              diagnostics,
              customElementsService,
            );
          }

          return diagnostics;
        },

        // Helper function to recursively validate nodes
        validateNode(
          node: any,
          document: any,
          diagnostics: html.Diagnostic[],
          customElementsService: CustomElementsService,
        ) {
          // Only process element nodes
          if (node.tag) {
            const tagName = node.tag;

            // Check if this is a custom element we know about
            if (customElementsService.getTagNames().includes(tagName)) {
              // Validate each attribute
              if (node.attributes) {
                for (const [attrName, attrValue] of Object.entries(
                  node.attributes,
                )) {
                  if (typeof attrValue === "string") {
                    // Validate the attribute value
                    const errorMessage =
                      customElementsService.validateAttributeValue(
                        tagName,
                        attrName,
                        attrValue,
                      );

                    // If there's an error, add a diagnostic
                    if (errorMessage) {
                      // Find the attribute position in the document
                      const startOffset = this.findAttributeOffset(
                        document.getText(),
                        node,
                        attrName,
                      );

                      if (startOffset !== -1) {
                        const startPos = document.positionAt(startOffset);
                        const endPos = document.positionAt(
                          startOffset + attrName.length + attrValue.length + 3,
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
                  }
                }
              }
            }
          }

          // Process child nodes recursively
          if (node.children) {
            for (const child of node.children) {
              this.validateNode(
                child,
                document,
                diagnostics,
                customElementsService,
              );
            }
          }
        },

        // Helper to find the offset of an attribute in the document
        findAttributeOffset(text: string, node: any, attrName: string): number {
          // Find the start of the element
          const elementStart = node.start;
          const elementEnd = node.end;

          // Extract the element text
          const elementText = text.substring(elementStart, elementEnd);

          // Look for the attribute
          const attrRegex = new RegExp(`\\s${attrName}\\s*=\\s*["']`, "g");
          const match = attrRegex.exec(elementText);

          if (match) {
            return elementStart + match.index + 1; // +1 to skip the initial space
          }

          return -1;
        },

        dispose() {
          customElementsService.dispose();
        },
      };
    },
  };
}
