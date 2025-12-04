import {
  createConnection,
  createServer,
  createSimpleProject,
  InitializeParams,
} from "@volar/language-server/node.js";
import { create as createEmmetService } from "volar-service-emmet";
import { create as createCssService } from "volar-service-css";
import { create as createHtmlService } from "volar-service-html";
import { manifestService } from "./services/manifest-service.js";
import { webComponentPlugin } from "./plugins/web-component-plugin.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Handle --version argument
if (process.argv.includes("--version")) {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgPath = join(__dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    console.log(pkg.version);
  } catch {
    // Fallback if package.json not found
    console.log("0.0.2");
  }
  process.exit(0);
}

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
  try {
    return server.initialize(
      params,
      createSimpleProject([]),
      [
        // Order matters: base services first, then our custom plugin
        // This ensures HTML/CSS/Emmet completions are available first
        webComponentPlugin(),
        createHtmlService(),
        createCssService({
          getCustomData: () => [{
            providePseudoClasses: () => [{ name: 'state' }],
            providePseudoElements: () => [{ name: 'state' }],
            provideProperties: () => [],
            provideAtDirectives: () => [],
            provideFunctions: () => []
          }]
        }),
        createEmmetService(),
      ]
    );
  } catch (error) {
    console.error("Error in onInitialize:", error);
    throw error;
  }
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
