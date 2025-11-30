import {
  createConnection,
  createServer,
  createTypeScriptProject,
  InitializeParams,
  loadTsdkByPath,
} from "@volar/language-server/node.js";
import { existsSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";
import { URI } from "vscode-uri";
import { create as createEmmetService } from "volar-service-emmet";
import { create as createCssService } from "volar-service-css";
import { create as createHtmlService } from "volar-service-html";
import { manifestService } from "./services/manifest-service.js";
import { webComponentPlugin } from "./plugins/web-component-plugin.js";

// Add global error handlers to prevent server crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

const EXECUTION_DIR = process.argv[1] ? dirname(process.argv[1]) : process.cwd();
const DEFAULT_TYPESCRIPT_SUBPATH = join("typescript", "lib");
const TSDK_ENV_VAR = "WC_LANGUAGE_SERVER_TSDK";
const REQUIRED_TS_FILES = ["typescript.js", "tsserverlibrary.js"];

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
  const tsdkPath = resolveTsdkPath(params);
  const tsdk = loadTsdkByPath(tsdkPath, params.locale);

  return server.initialize(
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

function resolveTsdkPath(params: InitializeParams): string {
  const initializationOptions = (params.initializationOptions ?? {}) as {
    typescript?: {
      tsdk?: string;
      tsdkSearchPaths?: string[];
    };
  };

  const explicitTsdk = initializationOptions.typescript?.tsdk;
  if (explicitTsdk) {
    const normalized = normalizeTsdkPath(explicitTsdk);
    if (hasTypeScriptRuntime(normalized)) {
      return normalized;
    }
    connection.console.warn(
      `[wc-language-server] Provided tsdk path is invalid: ${explicitTsdk}`
    );
  }

  const candidates = new Set<string>();

  const envTsdk = process.env[TSDK_ENV_VAR];
  if (envTsdk) {
    candidates.add(normalizeTsdkPath(envTsdk));
  }

  initializationOptions.typescript?.tsdkSearchPaths?.forEach((candidate) => {
    candidates.add(normalizeTsdkPath(candidate));
  });

  collectWorkspaceDirs(params).forEach((workspaceDir) => {
    candidates.add(resolve(workspaceDir, "node_modules", DEFAULT_TYPESCRIPT_SUBPATH));
  });

  candidates.add(
    resolve(process.cwd(), "node_modules", DEFAULT_TYPESCRIPT_SUBPATH)
  );

  candidates.add(
    resolve(EXECUTION_DIR, "..", "node_modules", DEFAULT_TYPESCRIPT_SUBPATH)
  );

  candidates.add(DEFAULT_TYPESCRIPT_SUBPATH);

  for (const candidate of candidates) {
    if (hasTypeScriptRuntime(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    [
      "Unable to locate a TypeScript runtime.",
      "Tried the following locations:",
      ...Array.from(candidates).map((candidate) => ` - ${candidate}`),
      "Set initializationOptions.typescript.tsdk or the",
      `${TSDK_ENV_VAR} environment variable to point to a valid TypeScript installation.`,
    ].join("\n")
  );
}

function collectWorkspaceDirs(params: InitializeParams): string[] {
  const workspaceDirs = new Set<string>();
  params.workspaceFolders?.forEach((folder) => {
    workspaceDirs.add(uriToFsPath(folder.uri));
  });

  if (params.rootUri) {
    workspaceDirs.add(uriToFsPath(params.rootUri));
  } else if (params.rootPath) {
    workspaceDirs.add(params.rootPath);
  }

  return Array.from(workspaceDirs);
}

function normalizeTsdkPath(candidate: string): string {
  if (!candidate) {
    return candidate;
  }
  const expanded = candidate.startsWith("~")
    ? join(process.env.HOME ?? "", candidate.slice(1))
    : candidate;
  return isAbsolute(expanded) ? expanded : resolve(expanded);
}

function hasTypeScriptRuntime(tsdkPath: string): boolean {
  try {
    return REQUIRED_TS_FILES.every((file) => existsSync(join(tsdkPath, file)));
  } catch {
    return false;
  }
}

function uriToFsPath(uri: string): string {
  return URI.parse(uri).fsPath;
}
