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
import { configurationService } from "./services/configuration-service.js";
import { webComponentPlugin } from "./plugins/web-component-plugin.js";

// Add global error handlers to prevent server crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

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

  // Set workspace root from initialization params
  if (params.rootUri) {
    const workspaceRoot = params.rootUri.replace(/^file:\/\//, "");
    console.log("[LS] Setting workspace root to:", workspaceRoot);
    
    // Set workspace root and reload configuration/manifests
    configurationService.setWorkspaceRoot(workspaceRoot);
    manifestService.setWorkspaceRoot(workspaceRoot);
    
    // Reload with the correct workspace root
    void configurationService.loadConfig().then(() => {
      manifestService.reload();
    });
  }

  const result = server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [],
    })),
    [
      // Order matters: base services first, then our custom plugin
      // This ensures HTML/CSS/Emmet completions are available first
      webComponentPlugin(),
      createHtmlService(),
      createCssService(),
      createEmmetService(),
    ]
  );
  
  // Add executeCommandProvider to capabilities
  if (result && typeof result === 'object' && 'capabilities' in result) {
    const serverResult = result as { capabilities: Record<string, unknown> };
    if (!serverResult.capabilities.executeCommandProvider) {
      serverResult.capabilities.executeCommandProvider = {
        commands: ["wctools.getDocs"]
      };
      console.log("[LS] Added executeCommandProvider capability");
    }
  }
  
  return result;
});

// Register workspace/executeCommand handler for getting docs
connection.onExecuteCommand(async (params) => {
  console.log(`[LS] executeCommand received: ${params.command}`);
  
  if (params.command === "wctools.getDocs") {
    console.log("[LS] Getting component docs...");
    const docs = manifestService.getAllDocs(); // Map<string,string>
    const result = Object.fromEntries(docs.entries());
    console.log(`[LS] Returning ${Object.keys(result).length} component docs`);
    return result;
  }
  
  return null;
});

// Also keep the custom request handler for VS Code compatibility
connection.onRequest("wctools/getDocs", () => {
  console.log("[LS] wctools/getDocs custom request received");
  const docs = manifestService.getAllDocs(); // Map<string,string>
  const result = Object.fromEntries(docs.entries());
  console.log(`[LS] Returning ${Object.keys(result).length} component docs`);
  return result;
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
