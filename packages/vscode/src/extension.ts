import * as serverProtocol from "@volar/language-server/protocol";
import { activateAutoInsertion, createLabsInfo } from "@volar/vscode";
import {
  BaseLanguageClient,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "@volar/vscode/node";
import * as vscode from "vscode";

let client: BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  console.log("Activating Web Components Language Server...");

  const serverModule = vscode.Uri.joinPath(
    context.extensionUri,
    "dist",
    "server.js",
  );

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "*" }],
    initializationOptions: {
      // Pass any custom settings here
      html: {
        autoClosingTags: true,
        attributeDefaultValue: "doublequotes",
        completion: {
          attributeDefaultValue: "doublequotes",
        },
      },
      // Explicitly enable definition support
      capabilities: {
        definitionProvider: true,
      },
    },
  };

  client = new LanguageClient(
    "wcLanguageServer",
    "Web Components Language Server",
    serverOptions,
    clientOptions,
  );

  try {
    await client.start();
    console.log("Web Components Language Server started successfully");
  } catch (error) {
    console.error("Failed to start Web Components Language Server:", error);
    throw error;
  }

  // Support for auto close/insert tags and attributes
  activateAutoInsertion("html", client);

  // Support for https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs
  const labsInfo = createLabsInfo(serverProtocol);
  labsInfo.addLanguageClient(client);
  return labsInfo.extensionExports;
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  console.log("Deactivating Web Components Language Server...");
  return client.stop();
}
