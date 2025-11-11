/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LanguageServiceContext,
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-server";
import { manifestService } from "../../services/manifest-service.js";
import { configurationService } from "../../services/configuration-service.js";
import * as html from "vscode-html-languageservice";
import { getHoverContent } from "./hover.js";
import { getAutoCompleteSuggestions } from "./autocomplete.js";
import { getGoToDefinition } from "./go-to-definition.js";
import { getValidation } from "./validation.js";

/**
 * Consolidated Web Components HTML service that leverages Volar's built-in HTML service
 * while adding comprehensive custom element support including:
 * - Enhanced completions with custom data providers
 * - Deprecation warnings in hover
 * - Go-to-definition for custom elements
 * - Validation diagnostics
 */
export function webComponentHtmlPlugin(): LanguageServicePlugin {
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
          "?",
          ".",
          ":",
          "[",
          "@",
          "(",
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

    create(context: LanguageServiceContext): LanguageServicePluginInstance {
      // Helper function to check if we should provide enhanced functionality
      const shouldProvideEnhancedService = (document: any) => {
        return configurationService.shouldIncludeFile(document.uri);
      };

      // Watch for changes to custom-elements.json and wc.config.js files
      context.env?.onDidChangeWatchedFiles?.((changes) => {
        const shouldReload = changes.changes.some(
          (change) =>
            change.uri.endsWith("custom-elements.json") ||
            change.uri.endsWith("wc.config.js") ||
            change.uri.endsWith("wc.config.ts") ||
            change.uri.endsWith("wc.config.mjs")
        );

        if (shouldReload) {
          manifestService.reload();
        }
      });

      return {
        /**
         * Enhanced completion provider for HTML with web component support
         */
        provideCompletionItems(document, position) {
          // Only provide custom completions if this file should be enhanced
          // Return undefined (not null) to let other plugins handle it
          if (!shouldProvideEnhancedService(document)) {
            return undefined;
          }

          // Get custom web component completions
          const customCompletions = getAutoCompleteSuggestions(document, position);

          // Return completions or undefined to let other plugins handle it
          return customCompletions || undefined;
        },

        /**
         * Enhanced hover with deprecation warnings and attribute information
         */
        provideHover(document, position) {
          return shouldProvideEnhancedService(document)
            ? getHoverContent(document, position)
            : null;
        },

        /**
         * Definition provider for custom elements using manifest locations
         */
        provideDefinition(document, position) {
          return shouldProvideEnhancedService(document)
            ? getGoToDefinition(document, position)
            : null;
        },

        /**
         * Enhanced diagnostics with deprecation and validation
         */
        provideDiagnostics(document) {
          return shouldProvideEnhancedService(document)
            ? getValidation(document, html.getLanguageService())
            : [];
        },

        dispose() {
          manifestService.dispose();
        },
      };
    },
  };
}
