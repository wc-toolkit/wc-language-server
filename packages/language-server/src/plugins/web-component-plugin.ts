/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LanguageServiceContext,
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-server";
import { manifestService } from "../services/manifest-service.js";
import { configurationService } from "../services/configuration-service.js";
import { getHoverContent } from "./html/hover.js";
import { getAutoCompleteSuggestions } from "./html/autocomplete.js";
import { getGoToDefinition } from "./html/go-to-definition.js";
import { getValidation } from "./html/validation.js";
import { getCssAutoCompleteSuggestions } from "./css/css-autocomplete.js";
import { getCssHoverContent } from "./css/css-hover.js";

/**
 * Consolidated Web Components HTML service that leverages Volar's built-in HTML service
 * while adding comprehensive custom element support including:
 * - Enhanced completions with custom data providers
 * - Deprecation warnings in hover
 * - Go-to-definition for custom elements
 * - Validation diagnostics
 */
export function webComponentPlugin(): LanguageServicePlugin {
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
        resolveProvider: true,
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
         * 
         * Note: This provider only returns custom web component completions.
         * Volar automatically merges these with completions from other services
         * (HTML, CSS, Emmet) at the LSP layer.
         */
        provideCompletionItems(document, position) {
          // Only provide custom completions if this file should be enhanced
          if (!shouldProvideEnhancedService(document)) {
            return undefined;
          }

          // Get custom web component completions
          const htmlCompletions = getAutoCompleteSuggestions(
            document,
            position
          );

          const cssCompletions = getCssAutoCompleteSuggestions(
            document,
            position
          );

          // Combine our custom completions
          const allItems = [
            ...(htmlCompletions || []),
            ...(cssCompletions || []),
          ];

          // Return our completions - Volar will merge with other services
          return {
            isIncomplete: false,
            items: allItems,
          };
        },

        /**
         * Enhanced hover with deprecation warnings and attribute information
         */
        provideHover(document, position) {
          if (!shouldProvideEnhancedService(document)) {
            return;
          }

          const htmlHover = getHoverContent(document, position);
          if (htmlHover) {
            return htmlHover;
          }

          const cssHover = getCssHoverContent(document, position);
          if (cssHover) {
            return cssHover;
          }

          return;
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
        async provideDiagnostics(document) {
          if (!shouldProvideEnhancedService(document)) {
            return [];
          }
          
          // Wait for manifests to be loaded before validating
          await manifestService.waitForManifestsLoaded();
          
          return getValidation(document);
        },

        dispose() {
          manifestService.dispose();
        },
      };
    },
  };
}
