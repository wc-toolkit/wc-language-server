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

/**
 * Creates a language service plugin for custom HTML features.
 * @returns Plugin object with capabilities and service creation function
 */
export function vsCodeHtmlAutoCompletePlugin(): LanguageServicePlugin {
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
          "a",
          "b",
          "c",
          "d",
          "e",
          "f",
          "g",
          "h",
          "i",
          "j",
          "k",
          "l",
          "m",
          "n",
          "o",
          "p",
          "q",
          "r",
          "s",
          "t",
          "u",
          "v",
          "w",
          "x",
          "y",
          "z",
        ],
      },
      hoverProvider: true,
      definitionProvider: true,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    /**
     * Creates the custom HTML service instance.
     * @param context - Language service context containing workspace information
     * @returns Service instance with bound methods
     */
    create(context: LanguageServiceContext) {
      const workspaceFolders = context.env?.workspaceFolders;
      // @ts-expect-error the type appears to be incorrect here
      const workspaceRoot = workspaceFolders?.[0]?.uri || "";
      const configService = new ConfigurationService(workspaceRoot);
      const customElementsService = new CustomElementsService(workspaceRoot);
      const htmlCompletionService = new VsCodeHtmlCompletionService(
        customElementsService
      );
      const htmlValidationService = new VsCodeHtmlValidationService(
        customElementsService
      );  
      const service = new CustomHtmlService(
        customElementsService,
        htmlCompletionService,
        htmlValidationService
      );

      configService.loadConfig();

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

/**
 * Creates a simple completion service for custom elements that triggers on any character.
 * This ensures custom element completions work even without the opening `<` bracket.
 * @returns Service plugin configuration object
 */
export function vsCodeCustomSnippetsPlugin(): LanguageServicePlugin {
  return {
    capabilities: {
      completionProvider: {
        triggerCharacters: [], // Empty array means trigger on any character
      },
    },
    create(context: LanguageServiceContext) {
      // @ts-expect-error the type appears to be incorrect here
      const workspaceRoot = context.env?.workspaceFolders?.[0]?.uri || "";
      const customElementsService = new CustomElementsService(workspaceRoot);
      const htmlCompletionService = new VsCodeHtmlCompletionService(
        customElementsService
      );
      const configService = new ConfigurationService(workspaceRoot);
      configService.loadConfig();

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
