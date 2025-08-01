import {
  LanguageServiceContext,
  LanguageServicePlugin,
} from "@volar/language-server";
import { CustomHtmlService } from "./adapters/vscode/html-service";
import { CustomElementsService } from "./services/custom-elements-service";
import { ConfigurationService } from "./services/configuration-service";
import * as html from "vscode-html-languageservice";
import { VsCodeHtmlCompletionService } from "./adapters/vscode/html-completion-service";
import { VsCodeHtmlValidationService } from "./adapters/vscode/html-validation-service";

type ServiceCache = Map<
    string,
    {
      configService: ConfigurationService;
      customElementsService: CustomElementsService;
      htmlCompletionService: VsCodeHtmlCompletionService;
      htmlValidationService: VsCodeHtmlValidationService;
      htmlService: CustomHtmlService;
    }
  >;

/**
 * Creates a language service plugin for custom HTML features.
 * @returns Plugin object with capabilities and service creation function
 */
export function vsCodeHtmlAutoCompletePlugin(): LanguageServicePlugin {
  // Shared service instances per workspace root
  const serviceCache: ServiceCache = new Map();

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
    create(context: LanguageServiceContext) {
      const workspaceFolders = context.env?.workspaceFolders;
      // @ts-expect-error the type appears to be incorrect here
      const workspaceRoot = workspaceFolders?.[0]?.uri || "";
      if (!serviceCache.has(workspaceRoot)) {
        const configService = new ConfigurationService(workspaceRoot);
        const customElementsService = new CustomElementsService(
          workspaceRoot,
          configService
        );
        const htmlCompletionService = new VsCodeHtmlCompletionService(
          customElementsService,
          configService
        );
        const htmlValidationService = new VsCodeHtmlValidationService(
          customElementsService
        );
        const htmlService = new CustomHtmlService(
          customElementsService,
          htmlCompletionService,
          htmlValidationService
        );
        serviceCache.set(workspaceRoot, {
          configService,
          customElementsService,
          htmlCompletionService,
          htmlValidationService,
          htmlService,
        });
      }
      const { htmlService } = serviceCache.get(workspaceRoot)!;
      return {
        provideCompletionItems:
          htmlService.provideCompletionItems.bind(htmlService),
        provideHover: htmlService.provideHover.bind(htmlService),
        provideDefinition: htmlService.provideDefinition.bind(htmlService),
        provideDiagnostics: htmlService.provideDiagnostics.bind(htmlService),
        dispose: htmlService.dispose.bind(htmlService),
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
  const serviceCache: ServiceCache = new Map();

  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: [],
      },
    },
    create(context: LanguageServiceContext) {
      // @ts-expect-error the type appears to be incorrect here
      const workspaceRoot = context.env?.workspaceFolders?.[0]?.uri || "";
      if (!serviceCache.has(workspaceRoot)) {
        const configService = new ConfigurationService(workspaceRoot);
        const customElementsService = new CustomElementsService(
          workspaceRoot,
          configService
        );
        const htmlCompletionService = new VsCodeHtmlCompletionService(
          customElementsService,
          configService
        );
        const htmlValidationService = new VsCodeHtmlValidationService(
          customElementsService
        );
        const htmlService = new CustomHtmlService(
          customElementsService,
          htmlCompletionService,
          htmlValidationService
        );
        serviceCache.set(workspaceRoot, {
          configService,
          customElementsService,
          htmlCompletionService,
          htmlValidationService,
          htmlService,
        });
      }

      const { customElementsService, htmlCompletionService } =
        serviceCache.get(workspaceRoot)!;
      return {
        provideCompletionItems(
          document: html.TextDocument,
          position: html.Position
        ) {
          // Only provide completions in HTML-like contexts
          const text = document.getText();
          const offset = document.offsetAt(position);
          const beforeText = text.substring(0, offset);

          // Don't provide completions if we're clearly in an attribute context
          if (beforeText.match(/\s+\w+=[^>]*$/)) {
            return { items: [], isIncomplete: false };
          }

          const customElements = customElementsService.getCustomElements();
          return htmlCompletionService.createCustomSnippets(
            customElements,
            beforeText
          );
        },

        dispose() {
          customElementsService.dispose();
        },
      };
    },
  };
}
