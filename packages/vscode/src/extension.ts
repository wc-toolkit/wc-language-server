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

let client: BaseLanguageClient;
let restartCommandRegistered = false;

// Helpers: shared output channel and restart + watcher utilities
let outputChannel: vscode.OutputChannel | undefined;
function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Web Components Language Server");
  }
  return outputChannel;
}

async function restartLanguageClient(reason: string): Promise<void> {
  const output = getOutputChannel();
  try {
    output.appendLine(`[web components language server] restarting - ${reason}`);
    await client.stop();
  } catch {
    // ignore
  }
  await client.start();
  output.appendLine("[web components language server] restart complete");
}

function createRestartingWatcher(glob: string, label: string): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher(glob);
  watcher.onDidChange((uri) => { void restartLanguageClient(`${label} changed: ${uri.fsPath}`); });
  watcher.onDidCreate((uri) => { void restartLanguageClient(`${label} created: ${uri.fsPath}`); });
  watcher.onDidDelete((uri) => { void restartLanguageClient(`${label} deleted: ${uri.fsPath}`); });
  return watcher;
}

export async function activate(context: vscode.ExtensionContext) {
  const serverModule = vscode.Uri.joinPath(
    context.extensionUri,
    "dist",
    "server.js",
  );
  const runOptions = { execArgv: [] as string[] };
  const debugOptions = { execArgv: ["--nolazy", "--inspect=" + 6009] };
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
    clientOptions,
  );
  await client.start();

  // Watchers (config, manifest, package.json)
  const configWatcher = createRestartingWatcher("**/wc.config.{js,cjs,mjs,ts,json}", "config");
  const manifestWatcher = createRestartingWatcher("**/custom-elements.json", "manifest");
  const packageJsonWatcher = createRestartingWatcher("**/package.json", "package.json");
  context.subscriptions.push(configWatcher, manifestWatcher, packageJsonWatcher, getOutputChannel());

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
        await client?.stop();
        await client?.start();
        vscode.window.showInformationMessage("Web Components Language Server restarted.");
      },
    );
    context.subscriptions.push(restartCommand);
    restartCommandRegistered = true;
  }

  return labsInfo.extensionExports;
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
