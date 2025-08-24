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
import { webComponentHtmlPlugin } from "./plugins/html";
import { webComponentJsxPlugin } from "./plugins/jsx";

/** Language Server Protocol connection instance for communication with the client */
const connection = createConnection();

/** Volar language server instance that manages language services and plugins */
const server = createServer(connection);

// Start listening for client connections
connection.listen();

/**
 * Handles the LSP initialize request from the client.
 * Sets up the TypeScript project, language plugins, and service providers.
 *
 * @param params - Initialization parameters from the client containing workspace info and settings
 * @returns Promise that resolves with server initialization result
 */
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
      webComponentJsxPlugin(),
      webComponentHtmlPlugin(),
      createCssService(),
      createEmmetService(),
      ...createTypeScriptServices(tsdk.typescript),
    ],
  );
});

/**
 * Handles the LSP initialized notification from the client.
 * Called after the server has been successfully initialized.
 */
connection.onInitialized(server.initialized);

/**
 * Handles the LSP shutdown request from the client.
 * Performs cleanup and prepares the server for termination.
 */
connection.onShutdown(server.shutdown);
