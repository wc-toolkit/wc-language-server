import {
  createConnection,
  createServer,
  createTypeScriptProject,
  InitializeParams,
  loadTsdkByPath,
} from "@volar/language-server/node.js";
import { create as createEmmetService } from "volar-service-emmet";
import { create as createCssService } from "volar-service-css";
import { create as createHtmlService } from "volar-service-html";
import { manifestService } from "./services/manifest-service.js";
import { webComponentPlugin } from "./plugins/web-component-plugin.js";

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
    [
      // Try without base services first to see if webComponentPlugin gets called
      webComponentPlugin(),
      createHtmlService(),
      createCssService(),
      createEmmetService()
    ]
  );
});

connection.onRequest("wctools/getDocs", () => {
  const docs = manifestService.getAllDocs(); // Map<string,string>
  // Convert Map to plain object so it survives JSON serialization over LSP
  return Object.fromEntries(docs.entries());
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
