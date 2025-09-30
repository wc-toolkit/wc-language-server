import {
  createConnection,
  createServer,
  createTypeScriptProject,
  loadTsdkByPath,
  InitializeParams,
} from "@volar/language-server/node.js";
import { create as createCssService } from "volar-service-css";
import { create as createEmmetService } from "volar-service-emmet";
import { webComponentHtmlPlugin } from "./plugins/html/html-plugin.js";
import { customElementsService } from "./services/custom-elements-service.js";

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
connection.onInitialize((params: InitializeParams) => {
  // Handle case where TypeScript SDK might not be provided
  const tsdkPath =
    params.initializationOptions?.typescript?.tsdk || "typescript/lib";
  const tsdk = loadTsdkByPath(tsdkPath, params.locale);

  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [],
    })),
    [webComponentHtmlPlugin(), createCssService(), createEmmetService()]
  );
});

connection.onRequest('wctoolkit/getDocs', () => {
  return customElementsService.getAllDocs();
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
