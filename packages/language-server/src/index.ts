import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByPath,
} from "@volar/language-server/node";
import { create as createCssService } from "volar-service-css";
import { create as createEmmetService } from "volar-service-emmet";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { URI } from "vscode-uri";
import {
  wcLanguagePlugin,
  WcLanguageServerVirtualCode,
} from "./language-plugin";
import { createCustomElementsCompletionService } from "./custom-elements-service";
import { createCustomHtmlService } from "./html-service";

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize((params) => {
  // Handle case where TypeScript SDK might not be provided
  const tsdkPath =
    params.initializationOptions?.typescript?.tsdk || "typescript/lib";
  const tsdk = loadTsdkByPath(tsdkPath, params.locale);

  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [wcLanguagePlugin],
    })),
    [
      createCustomHtmlService(), // HTML service now includes definition provider
      createCssService(),
      createEmmetService(),
      createCustomElementsCompletionService(),
      ...createTypeScriptServices(tsdk.typescript),
      {
        capabilities: {
          diagnosticProvider: {
            interFileDependencies: false,
            workspaceDiagnostics: false,
          },
        },
        create(context) {
          return {
            provideDiagnostics(document) {
              const decoded = context.decodeEmbeddedDocumentUri(
                URI.parse(document.uri)
              );
              if (!decoded) {
                // Not a embedded document
                return;
              }
              const virtualCode = context.language.scripts
                .get(decoded[0])
                ?.generated?.embeddedCodes.get(decoded[1]);
              if (!(virtualCode instanceof WcLanguageServerVirtualCode)) {
                return;
              }
              const styleNodes = virtualCode.htmlDocument.roots.filter(
                (root) => root.tag === "style"
              );
              if (styleNodes.length <= 1) {
                return;
              }
              const errors: Diagnostic[] = [];
              for (let i = 1; i < styleNodes.length; i++) {
                errors.push({
                  severity: 2,
                  range: {
                    start: document.positionAt(styleNodes[i].start),
                    end: document.positionAt(styleNodes[i].end),
                  },
                  source: "wc-language-server",
                  message: "Only one style tag is allowed.",
                });
              }
              return errors;
            },
          };
        },
      },
    ]
  );
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
