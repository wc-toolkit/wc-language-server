/* eslint-disable @typescript-eslint/no-explicit-any */
import { LanguageServicePlugin } from "@volar/language-server";
import { create as createHtmlService } from "volar-service-html";
import { customElementsService } from "../../services/custom-elements-service";
import * as html from "vscode-html-languageservice";
import { getHoverContent } from "./hover";
import { getAutoCompleteSuggestions } from "./autocomplete";
import { getGoToDefinition } from "./go-to-definition";
import { getValidation } from "./validation";

/**
 * Consolidated Web Components HTML service that leverages Volar's built-in HTML service
 * while adding comprehensive custom element support including:
 * - Enhanced completions with custom data providers
 * - Deprecation warnings in hover
 * - Go-to-definition for custom elements
 * - Validation diagnostics
 */
export function webComponentHtmlPlugin(): LanguageServicePlugin {
  // Get the base HTML service from Volar
  const baseHtmlService = createHtmlService();

  return {
    ...baseHtmlService,
    capabilities: {
      ...baseHtmlService.capabilities,
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

    create(context) {
      const baseService = baseHtmlService.create(context);

      // Watch for changes to custom-elements.json files
      context.env?.onDidChangeWatchedFiles?.((changes) => {
        const customElementsChanged = changes.changes.some((change) =>
          change.uri.endsWith("custom-elements.json")
        );

        if (customElementsChanged) {
          // Trigger reload of custom elements data
          customElementsService.onManifestChange(() =>
            customElementsService.getCustomElements()
          );
        }
      });

      return {
        ...baseService,

        /**
         * Enhanced completion provider using Volar's HTML service with custom data
         */
        provideCompletionItems(document, position) {
          return getAutoCompleteSuggestions(document, position);
        },

        /**
         * Enhanced hover with deprecation warnings and attribute information
         */
        provideHover(document, position) {
          return getHoverContent(document, position);
        },

        /**
         * Definition provider for custom elements using manifest locations
         */
        provideDefinition(document, position) {
          return getGoToDefinition(document, position);
        },

        /**
         * Enhanced diagnostics with deprecation and validation
         */
        provideDiagnostics(document) {
          return getValidation(document, html.getLanguageService());
        },

        dispose() {
          baseService.dispose?.();
          customElementsService.dispose();
        },
      };
    },
  };
}
