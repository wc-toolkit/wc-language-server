import * as serverProtocol from "@volar/language-server/protocol";
import { activateAutoInsertion, createLabsInfo } from "@volar/vscode";
import * as vscode from "vscode";
import { registerChatParticipant } from "./chat-participant";
import {
  createClient,
  createRestartingWatcher,
  getClientInstance,
  log,
  scheduleRestart,
  setExtensionContext,
  setOnRestartCallback,
} from "./utilities";
import { WebComponentMCPServer } from "./mcp-server";

let restartCommandRegistered = false;

// Store component docs - shared across the extension
const componentDocs: Record<string, string> = {};

// MCP server instance
let mcpServer: WebComponentMCPServer | undefined;

// Load component documentation from language server
async function loadDocs(): Promise<void> {
  const client = getClientInstance();
  if (!client) {
    return;
  }

  try {
    const fetchedDocs =
      await client.sendRequest<Record<string, string>>("wctools/getDocs");

    if (!fetchedDocs || Object.keys(fetchedDocs).length === 0) {
      log("no custom element docs found");
      return;
    }

    log(`loaded ${Object.keys(fetchedDocs).length} component docs`);

    // Clear existing docs and add new ones
    for (const key in componentDocs) {
      delete componentDocs[key];
    }
    Object.assign(componentDocs, fetchedDocs);

    log("component docs updated");
  } catch (error) {
    log(`Error loading docs: ${error}`);
  }
}

export async function activate(context: vscode.ExtensionContext) {
  setExtensionContext(context);
  
  // Create and start the language client
  const client = await createClient();
  await client.start();
  
  // Set up callback for after restart
  setOnRestartCallback(() => {
    void loadDocs();
    // Update MCP server with new docs
    if (mcpServer) {
      mcpServer.setComponentDocs(componentDocs);
    }
  });

  // Start MCP server if enabled
  const mcpEnabled = vscode.workspace.getConfiguration("wctools").get<boolean>("mcp.enabled", false);
  const mcpTransport = vscode.workspace.getConfiguration("wctools").get<"stdio" | "http">("mcp.transport", "http");
  const mcpPort = vscode.workspace.getConfiguration("wctools").get<number>("mcp.port", 3000);
  const mcpHost = vscode.workspace.getConfiguration("wctools").get<string>("mcp.host", "localhost");

  log(`MCP server enabled: ${mcpEnabled}, transport: ${mcpTransport}, port: ${mcpPort}`);

  if (mcpEnabled) {
    try {
      mcpServer = new WebComponentMCPServer({
        transport: mcpTransport,
        port: mcpPort,
        host: mcpHost,
      });
      
      await mcpServer.start();
      log(`MCP server started (${mcpTransport} mode)`);
      
      // Set initial docs (will be empty at first, but will be updated when loadDocs completes)
      mcpServer.setComponentDocs(componentDocs);
    } catch (error) {
      log(`Failed to start MCP server: ${error}`);
      vscode.window.showWarningMessage(
        `Failed to start Web Components MCP server: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Register chat participant and language model tool
  // The chat participant holds a reference to componentDocs, so updates are reflected
  // This handles both VS Code Chat Participant and Cursor/Copilot Language Model Tool
  registerChatParticipant(context, componentDocs);
  log("Chat participant and language model tool registration attempted");

  // Load docs after a short delay to ensure language server is ready
  setTimeout(() => {
    void loadDocs().then(() => {
      // Update MCP server with loaded docs
      if (mcpServer) {
        mcpServer.setComponentDocs(componentDocs);
        log("MCP server updated with component docs");
      }
    });
  }, 1000);

  // Watchers (config, manifest, package.json)
  const configWatcher = createRestartingWatcher(
    "**/wc.config.{js,cjs,mjs,ts,json}",
    "config"
  );
  const manifestWatcher = createRestartingWatcher(
    "**/custom-elements.json",
    "manifest"
  );
  const packageJsonWatcher = createRestartingWatcher(
    "**/package.json",
    "package.json"
  );

  // Watch for node_modules addition/removal
  const nodeModulesWatcher =
    vscode.workspace.createFileSystemWatcher("**/node_modules");
  nodeModulesWatcher.onDidCreate((uri) =>
    scheduleRestart(`node_modules added: ${uri.fsPath}`)
  );
  nodeModulesWatcher.onDidDelete((uri) =>
    scheduleRestart(`node_modules removed: ${uri.fsPath}`)
  );

  context.subscriptions.push(
    configWatcher,
    manifestWatcher,
    packageJsonWatcher,
    nodeModulesWatcher
  );

  // support for auto close tag
  activateAutoInsertion("html", client);

  // support for https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs
  // ref: https://twitter.com/johnsoncodehk/status/1656126976774791168
  const labsInfo = createLabsInfo(serverProtocol);
  labsInfo.addLanguageClient(client);

  // Register command to restart the extension only once
  if (!restartCommandRegistered) {
    const restartCommand = vscode.commands.registerCommand(
      "wcLanguageServer.restart",
      async () => {
        scheduleRestart("manual command");
        vscode.window.showInformationMessage(
          "Web Components Language Server restart requested."
        );
      }
    );
    context.subscriptions.push(restartCommand);
    restartCommandRegistered = true;
  }

  // Command to check MCP server status
  const checkMcpCommand = vscode.commands.registerCommand(
    "wctools.checkMcpStatus",
    () => {
      if (!mcpServer) {
        vscode.window.showInformationMessage(
          "MCP server is not enabled. Enable it in settings: wctools.mcp.enabled"
        );
      } else {
        const transport = vscode.workspace.getConfiguration("wctools").get<string>("mcp.transport", "http");
        const port = vscode.workspace.getConfiguration("wctools").get<number>("mcp.port", 3000);
        const host = vscode.workspace.getConfiguration("wctools").get<string>("mcp.host", "localhost");
        const componentCount = Object.keys(componentDocs).length;
        
        if (transport === "http") {
          vscode.window.showInformationMessage(
            `MCP server is running on http://${host}:${port} with ${componentCount} component(s) loaded`,
            "Open Health Check"
          ).then(selection => {
            if (selection === "Open Health Check") {
              vscode.env.openExternal(vscode.Uri.parse(`http://${host}:${port}/health`));
            }
          });
        } else {
          vscode.window.showInformationMessage(
            `MCP server is running in stdio mode with ${componentCount} component(s) loaded`
          );
        }
      }
    }
  );
  context.subscriptions.push(checkMcpCommand);

  return labsInfo.extensionExports;
}

export async function deactivate(): Promise<void> {
  // Close MCP server
  if (mcpServer) {
    await mcpServer.close();
    log("MCP server closed");
  }
  
  const client = getClientInstance();
  await client?.stop();
}
