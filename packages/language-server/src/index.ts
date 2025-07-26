import {
  createConnection,
  createServer,
  createTypeScriptProject,
  loadTsdkByPath,
} from "@volar/language-server/node";
import { create as createCssService } from "volar-service-css";
import { create as createEmmetService } from "volar-service-emmet";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { wcLanguagePlugin } from "./language-plugin";
import { createCustomElementsCompletionService } from "./custom-elements-service";
import { createCustomHtmlServicePlugin } from "./html-service";

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
      createCustomHtmlServicePlugin(), // HTML service now includes definition provider
      createCssService(),
      createEmmetService(),
      createCustomElementsCompletionService(),
      ...createTypeScriptServices(tsdk.typescript),
    ]
  );
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
