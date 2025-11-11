/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LanguageServiceContext,
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-server";
import { manifestService } from "../../services/manifest-service.js";
import { configurationService } from "../../services/configuration-service.js";
import { getCssAutoCompleteSuggestions } from "./css-autocomplete.js";
import { getCssHoverContent } from "./css-hover.js";

/**
 * Consolidated Web Components CSS service that leverages Volar's built-in CSS service
 * while adding comprehensive custom element CSS support including:
 * - CSS custom properties (--property-name) completions
 * - CSS parts (::part(name)) completions
 * - CSS custom states (:state(name)) completions
 * - Component selector completions
 * - Enhanced hover information for web component CSS features
 */
export function webComponentCssPlugin(): LanguageServicePlugin {
  // Get the base CSS service from Volar
  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: [
          "-",
          ":",
          "(",
          " ",
          ..."abcdefghijklmnopqrstuvwxyz".split(""),
        ],
      },
      hoverProvider: true,
      definitionProvider: true,
    },

    create(context: LanguageServiceContext): LanguageServicePluginInstance {
      // Helper function to check if we should provide enhanced functionality
      const shouldProvideEnhancedService = (document: any) => {
        return configurationService.shouldIncludeFile(document.uri);
      };

      // Watch for changes to custom-elements.json and wc.config files
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
         * Enhanced completion provider for CSS with web component support:
         * - CSS custom properties (--*)
         * - CSS parts (::part())
         * - CSS custom states (:state())
         * - Component selectors
         */
        provideCompletionItems(document, position) {
          if (!shouldProvideEnhancedService(document)) {
            return null;
          }

          // Get enhanced completions for web components
          const customCompletions = getCssAutoCompleteSuggestions(
            document,
            position
          );

          if (customCompletions) {
            return customCompletions;
          }

          return null;
        },

        /**
         * Enhanced hover with information about:
         * - CSS custom properties defined by components
         * - CSS parts exposed by components
         * - CSS custom states
         * - Component selector documentation
         */
        provideHover(document, position) {
          return shouldProvideEnhancedService(document)
            ? getCssHoverContent(document, position)
            : null;
        },

        /**
         * Definition provider for navigating to:
         * - CSS custom property definitions in custom-elements.json
         * - CSS part definitions in custom-elements.json
         * - Component definitions
         */
        // provideDefinition(document, position, token) {
        //   if (!shouldProvideEnhancedService(document)) {
        //     return baseService.provideDefinition?.(document, position, token);
        //   }

        //   // TODO: Implement CSS go-to-definition for web components
        //   // For now, use base service
        //   return baseService.provideDefinition?.(document, position, token);
        // },

        /**
         * Diagnostics for CSS with web component validation:
         * - Invalid CSS custom property usage
         * - Invalid CSS part names
         * - Invalid CSS state names
         * - Deprecated CSS features
         */
        // provideDiagnostics(document, token) {
        //   if (!shouldProvideEnhancedService(document)) {
        //     return baseService.provideDiagnostics?.(document, token) || [];
        //   }

        //   // TODO: Implement CSS validation for web components
        //   // For now, use base service
        //   return baseService.provideDiagnostics?.(document, token) || [];
        // },

        dispose() {
          manifestService.dispose();
        },
      };
    },
  };
}
