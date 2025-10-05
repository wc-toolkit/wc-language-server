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
import {
  activateAIIntegration,
  answerQuestion,
  getAIStats,
} from "./ai-integration";

interface ChatParticipantFactory {
  createChatParticipant?: (id: string, handler: unknown) => vscode.Disposable;
}

const RESTART_DEBOUNCE_MS = 300;
let restartTimer: NodeJS.Timeout | undefined;
let restarting = false;
let pendingRestart = false;
let client: BaseLanguageClient;
let restartCommandRegistered = false;
let extensionContext: vscode.ExtensionContext | undefined;

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
      // After a restart, pull docs again so AI integration stays current
      try {
        await loadDocs();
      } catch (e) {
        log(`error reloading docs after restart: ${(e as Error).message}`);
      }
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

async function loadDocs(): Promise<void> {
  if (!client || !extensionContext) return;
  const raw =
    await client.sendRequest<Record<string, string>>("wctoolkit/getDocs");
  if (!raw || Object.keys(raw).length === 0) {
    log("no custom element docs found");
    return;
  }
  try {
    log(`received ${Object.keys(raw).length} custom element docs`);
    await activateAIIntegration(raw, extensionContext, log);
    log(
      `sent ${Object.keys(raw).length} custom element docs to AI integration`
    );
  } catch (err) {
    log(`error activating AI integration with docs: ${(err as Error).message}`);
  }
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
  extensionContext = context;
  await client.start();
  // Initial docs load + AI integration
  await loadDocs();

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

  // loadDocs already invoked above

  // Register Chat Participant (Chat View integration) if API is available
  try {
    const chatApi = (vscode as unknown as { chat?: ChatParticipantFactory })
      .chat; // runtime guard
    if (chatApi?.createChatParticipant) {
      const participant = chatApi.createChatParticipant("wcLanguageServerAI", {
        name: "wctools", // matches package.json chatParticipants name
        async provideResponse(request: { prompt?: string; promptText?: string }) {
          const raw = (request.prompt ?? request.promptText ?? "").trim();
          if (!raw) {
            return { contents: [{ kind: 'markdown', value: '**wctools**: Ask a question about your project\nType `/help` for commands.' }] };
          }

          // Slash command handling
          if (raw.startsWith('/')) {
            const [cmd] = raw.slice(1).split(/\s+/);
            const stats = getAIStats();
            switch (cmd.toLowerCase()) {
              case 'help':
                return { contents: [{ kind: 'markdown', value: `**wctools help**\nCommands:\n- /list : list all detected web components\n- /stats : show AI ingestion stats\n- /help : this help\n\nAsk natural questions too (e.g. *How do I use <my-element>?*).` }] };
              case 'stats':
                return { contents: [{ kind: 'markdown', value: `**wctools stats**\nChunks: ${stats.chunks}\nEmbeddings: ${stats.embeddings}\nModel: ${stats.model}` }] };
              case 'list': {
                try {
                  const listAnswer = await answerQuestion('what web components are available in this project?');
                  return { contents: [{ kind: 'markdown', value: `**Component List**\n${listAnswer.trim()}` }] };
                } catch (e) {
                  return { contents: [{ kind: 'markdown', value: `Error listing components: ${(e as Error).message}` }] };
                }
              }
              default:
                return { contents: [{ kind: 'markdown', value: `Unknown command: /${cmd}. Try /help.` }] };
            }
          }

          try {
            const answer = await answerQuestion(raw);
            const stats = getAIStats();
            return {
              contents: [
                { kind: 'markdown', value: `**Q:** ${raw}\n\n**A:**\n${answer.trim()}` },
                { kind: 'markdown', value: `_(chunks=${stats.chunks} embeddings=${stats.embeddings} model=${stats.model})_` }
              ]
            };
          } catch (e) {
            return { contents: [{ kind: 'markdown', value: `Error: ${(e as Error).message}` }] };
          }
        }
      });
      context.subscriptions.push(participant);
      log("Registered Chat Participant: wctools (Web Components AI)");
    } else {
      log(
        "Chat API not available (createChatParticipant missing) - using command only"
      );
    }
  } catch (e) {
    log("Failed to register chat participant: " + (e as Error).message);
  }

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

    const askCommand = vscode.commands.registerCommand(
      "wcLanguageServer.askAI",
      async () => {
        const question = await vscode.window.showInputBox({
          prompt: "Ask about your Web Components",
        });
        if (!question) return;
        try {
          const answer = await answerQuestion(question);
          const channel =
            vscode.window.createOutputChannel("Web Components AI");
          channel.show(true);
          const stats = getAIStats();
          channel.appendLine(`Question: ${question}`);
          channel.appendLine("---");
          channel.appendLine(answer.trim());
          channel.appendLine(
            "\n[context stats] chunks=" +
              stats.chunks +
              " embeddings=" +
              stats.embeddings +
              " model=" +
              stats.model
          );
        } catch (err) {
          vscode.window.showErrorMessage(`AI error: ${(err as Error).message}`);
        }
      }
    );

    context.subscriptions.push(restartCommand, askCommand);
    restartCommandRegistered = true;
  }

  return labsInfo.extensionExports;
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
