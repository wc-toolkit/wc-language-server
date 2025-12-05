import { getTsdk } from "@volar/vscode";
import {
  BaseLanguageClient,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "@volar/vscode/node";
import * as vscode from "vscode";

const pendingLogs: string[] = [];
const RESTART_DEBOUNCE_MS = 300;

let context: vscode.ExtensionContext;
let client: BaseLanguageClient | null = null;
let restartTimer: NodeJS.Timeout | undefined;
let restarting = false;
let pendingRestart = false;

// Callback to be called after restart completes (for loading docs, etc.)
let onRestartCallback: (() => void) | undefined;

/**
 * Sets the extension context for use throughout the extension.
 * Must be called during extension activation.
 * 
 * @param ctx - The VS Code extension context
 */
export function setExtensionContext(ctx: vscode.ExtensionContext) {
  context = ctx;
}

/**
 * Sets the language client instance.
 * 
 * @param newClient - The language client to store
 */
export function setClient(newClient: BaseLanguageClient) {
  client = newClient;
}

/**
 * Gets the current language client instance.
 * 
 * @returns The active language client, or null if not yet initialized
 */
export function getClientInstance() {
  return client;
}

/**
 * Sets a callback to be invoked after the language server restarts.
 * Useful for reloading component documentation or other post-restart operations.
 * 
 * @param callback - The function to call after restart completes
 */
export function setOnRestartCallback(callback: () => void) {
  onRestartCallback = callback;
}

/**
 * Logs a message to the Web Components Language Server output channel.
 * Messages are queued if the output channel is not yet available.
 * 
 * @param msg - The message to log
 */
export function log(msg: string) {
  const line = `[web components language server] ${msg}`;
  const channel: vscode.OutputChannel | undefined = client?.outputChannel;
  
  if (channel) {
    if (pendingLogs.length) {
      for (const l of pendingLogs) channel.appendLine(l);
      pendingLogs.length = 0;
    }
    channel.appendLine(line);
  } else {
    pendingLogs.push(line);
  }
}

/**
 * Schedules a language server restart with debouncing.
 * Multiple restart requests within the debounce period are coalesced into a single restart.
 * 
 * @param reason - Description of why the restart was requested
 */
export function scheduleRestart(reason: string) {
  log(`restart scheduled: ${reason}`);
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    void restartLanguageClient(`debounced: ${reason}`);
  }, RESTART_DEBOUNCE_MS);
}

/**
 * Restarts the language client with the given reason.
 * Handles cleanup of the previous client, starting the new one, and calling restart callbacks.
 * Automatically queues additional restarts if requested during the restart process.
 * 
 * @param reason - Description of why the restart is occurring
 */
export async function restartLanguageClient(reason: string): Promise<void> {
  if (restarting) {
    pendingRestart = true;
    return;
  }
  restarting = true;
  try {
    do {
      pendingRestart = false;
      log(`restarting - ${reason}`);
      try {
        if (client) {
          await client.stop();
          // Allow Node a brief moment to fully release resources (inspector port, ipc handles).
          await new Promise((r) => setTimeout(r, 50));
        }
      } catch {
        // ignore stop errors
      }
      await client?.start();
      log(`restart complete`);
      
      // Call the restart callback if set
      if (onRestartCallback) {
        setTimeout(() => {
          onRestartCallback?.();
        }, 500);
      }
    } while (pendingRestart); // loop if another request arrived during previous cycle
  } finally {
    restarting = false;
  }
}

/**
 * Creates a file system watcher that automatically schedules a language server restart
 * when files matching the glob pattern are changed, created, or deleted.
 * 
 * @param glob - Glob pattern to watch (e.g., '**\/wc.config.js')
 * @param label - Descriptive label for logging (e.g., "config file")
 * @returns A configured file system watcher
 */
export function createRestartingWatcher(
  glob: string,
  label: string
): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher(glob);
  watcher.onDidChange((uri) =>
    scheduleRestart(`${label} changed: ${uri.fsPath}`)
  );
  watcher.onDidCreate((uri) =>
    scheduleRestart(`${label} created: ${uri.fsPath}`)
  );
  watcher.onDidDelete((uri) =>
    scheduleRestart(`${label} deleted: ${uri.fsPath}`)
  );
  return watcher;
}

/**
 * Creates and configures the Web Components Language Server client.
 * Sets up the server module path, transport options, and client capabilities.
 * 
 * @returns A configured language client ready to be started
 */
export async function createClient(): Promise<BaseLanguageClient> {
  // Determine the correct executable based on platform
  let executableName = "wc-language-server-linux-x64"; // default
  
  const platform = process.platform;
  const arch = process.arch;
  
  if (platform === "win32") {
    executableName = "wc-language-server-windows-x64.exe";
  } else if (platform === "darwin") {
    executableName = arch === "arm64" ? "wc-language-server-macos-arm64" : "wc-language-server-macos-x64";
  } else if (platform === "linux") {
    executableName = "wc-language-server-linux-x64";
  }
  
  const serverExecutable = vscode.Uri.joinPath(
    context.extensionUri,
    "dist",
    "server",
    executableName
  );
  
  const serverOptions: ServerOptions = {
    command: serverExecutable.fsPath,
    args: ["--stdio"],
  };
  
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "*" }],
    initializationOptions: {
      typescript: {
        tsdk: (await getTsdk(context))!.tsdk,
      },
    },
  };
  
  const newClient = new LanguageClient(
    "wcLanguageServer",
    "Web Components Language Server",
    serverOptions,
    clientOptions
  );
  
  client = newClient;
  return newClient;
}
