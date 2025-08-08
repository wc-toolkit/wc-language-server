import { LanguageServicePlugin } from "@volar/language-server";
import { customHtmlService } from "./adapters/vscode/html-service";
import { customElementsService } from "./services/custom-elements-service";
import * as html from "vscode-html-languageservice";
import { htmlCompletionService } from "./adapters/vscode/html-completion-service";

/**
 * Creates a language service plugin for custom HTML features.
 * @returns Plugin object with capabilities and service creation function
 */
export function vsCodeHtmlAutoCompletePlugin(): LanguageServicePlugin {
  // Shared service instances per workspace root
  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: [
          "<",
          " ",
          "=",
          '"',
          "'",
          ">",
          "-",
          ..."abcdefghijklmnopqrstuvwxyz".split(""),
        ],
      },
      hoverProvider: true,
      definitionProvider: true,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create() {
      // const workspaceFolders = context.env?.workspaceFolders;
      // const workspaceRoot = workspaceFolders?.[0]?.uri || "";
      return {
        provideCompletionItems(document, position) {
          return customHtmlService.provideCompletionItems(document, position);
        },
        provideHover(document, position) {
          return customHtmlService.provideHover(document, position);
        },
        provideDefinition(document, position) {
          return customHtmlService.provideDefinition(document, position);
        },
        provideDiagnostics(document) {
          return customHtmlService.provideDiagnostics(document);
        },
        dispose() {
          return customHtmlService.dispose();
        },
      };
    },
  };
}

/**
 * Creates a simple completion service for custom elements that triggers on any character.
 * This ensures custom element completions work even without the opening `<` bracket.
 * @returns Service plugin configuration object
 */
export function vsCodeCustomSnippetsPlugin(): LanguageServicePlugin {
  // Use the same cache as above

  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: [],
      },
    },
    create() {
      // const workspaceRoot = context.env?.workspaceFolders?.[0]?.uri || "";
      return {
        provideCompletionItems(
          document: html.TextDocument,
          position: html.Position,
        ) {
          // Only provide completions in HTML-like contexts
          const text = document.getText();
          const offset = document.offsetAt(position);
          const beforeText = text.substring(0, offset);

          // Don't provide completions if we're clearly in an attribute context
          if (beforeText.match(/\s+\w+=[^>]*$/)) {
            return { items: [], isIncomplete: false };
          }

          return htmlCompletionService.createCustomSnippets(beforeText);
        },

        dispose() {
          customElementsService.dispose();
        },
      };
    },
  };
}
