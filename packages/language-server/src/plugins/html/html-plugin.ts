/* eslint-disable @typescript-eslint/no-explicit-any */
import { LanguageServiceContext, LanguageServicePlugin } from "@volar/language-server";
import { create as createHtmlService } from "volar-service-html";
import { customElementsService } from "../../services/custom-elements-service";
import { configurationService } from "../../services/configuration-service";
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

    create(context: LanguageServiceContext) {
      const baseService = baseHtmlService.create(context);

      // Helper function to check if we should provide enhanced functionality
      const shouldProvideEnhancedService = (document: any) => {
        return configurationService.shouldIncludeFile(document.uri);
      };

      // Watch for changes to custom-elements.json and wc.config.js files
      context.env?.onDidChangeWatchedFiles?.((changes) => {
        const shouldRestart = changes.changes.some((change) =>
          change.uri.endsWith("custom-elements.json") || 
          change.uri.endsWith("wc.config.js")
        );

        if (shouldRestart) {
          // Restart the language server process
          process.exit(0);
        }
      });

      return {
        ...baseService,

        /**
         * Enhanced completion provider using Volar's HTML service with custom data
         */
        provideCompletionItems(document, position, context, token) {
          if (!shouldProvideEnhancedService(document)) {
            return baseService.provideCompletionItems?.(document, position, context, token);
          }
          return getAutoCompleteSuggestions(document, position);
        },

        /**
         * Enhanced hover with deprecation warnings and attribute information
         */
        provideHover(document, position, token) {
          if (!shouldProvideEnhancedService(document)) {
            return baseService.provideHover?.(document, position, token);
          }
          return getHoverContent(document, position);
        },

        /**
         * Definition provider for custom elements using manifest locations
         */
        provideDefinition(document, position, token) {
          if (!shouldProvideEnhancedService(document)) {
            return baseService.provideDefinition?.(document, position, token);
          }
          return getGoToDefinition(document, position);
        },

        /**
         * Enhanced diagnostics with deprecation and validation
         */
        provideDiagnostics(document, token) {
          if (!shouldProvideEnhancedService(document)) {
            return baseService.provideDiagnostics?.(document, token) || [];
          }
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
