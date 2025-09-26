import * as serverProtocol from "@volar/language-server/protocol";
import { activateAutoInsertion, createLabsInfo, getTsdk } from "@volar/vscode";
import {
  BaseLanguageClient,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "@volar/vscode/node";
import * as vscode from "vscode";

const RESTART_DEBOUNCE_MS = 300;
let restartTimer: NodeJS.Timeout | undefined;
let restarting = false;
let pendingRestart = false;
let client: BaseLanguageClient;
let restartCommandRegistered = false;

const pendingLogs: string[] = [];
function log(msg: string) {
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

function scheduleRestart(reason: string) {
  log(`restart scheduled: ${reason}`);
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    void restartLanguageClient(`debounced: ${reason}`);
  }, RESTART_DEBOUNCE_MS);
}

async function restartLanguageClient(reason: string): Promise<void> {
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
      await client.start();
      log(`restart complete`);
    } while (pendingRestart); // loop if another request arrived during previous cycle
  } finally {
    restarting = false;
  }
}

function createRestartingWatcher(
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

export async function activate(context: vscode.ExtensionContext) {
  const serverModule = vscode.Uri.joinPath(
    context.extensionUri,
    "dist",
    "server.js"
  );
  const runOptions = { execArgv: [] as string[] };
  const debugOptions = { execArgv: ["--nolazy", "--inspect=0"] }; // use dynamic port to avoid collisions
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
      options: runOptions,
    },
    debug: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "*" }],
    initializationOptions: {
      typescript: {
        tsdk: (await getTsdk(context))!.tsdk,
      },
    },
  };
  client = new LanguageClient(
    "wcLanguageServer",
    "Web Components Language Server",
    serverOptions,
    clientOptions
  );
  await client.start();

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

  return labsInfo.extensionExports;
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
