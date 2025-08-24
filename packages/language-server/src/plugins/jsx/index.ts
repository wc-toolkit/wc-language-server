import {
  LanguageServiceContext,
  LanguageServicePlugin,
} from "@volar/language-server";
import { customElementsService } from "../../services/custom-elements-service";
import { configurationService } from "../../services/configuration-service";
import type { Package } from "custom-elements-manifest" with { "resolution-mode": "import" };
import { generateJsxTypes } from "@wc-toolkit/jsx-types";

export function webComponentJsxPlugin(): LanguageServicePlugin {
  return {
    name: "WebComponentJsxPlugin",
    create(context: LanguageServiceContext) {
      console.debug("Loading JSX types...");
      for (const [depName, manifest] of customElementsService.manifests) {
        generateTypes(manifest, depName, context);
      }

      customElementsService.onManifestLoad(
        (depName: string, manifest: Package) => {
          generateTypes(manifest, depName, context);
        }
      );

      return {
        dispose() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tsService: any = context.project.typescript;

          tsService.languageServiceHost.__wc_restore();
          customElementsService.dispose();
        },
      };
    },
    capabilities: {
      executeCommandProvider: undefined,
      selectionRangeProvider: undefined,
      foldingRangeProvider: undefined,
      linkedEditingRangeProvider: undefined,
      colorProvider: false,
      documentSymbolProvider: undefined,
      documentFormattingProvider: undefined,
      referencesProvider: undefined,
      implementationProvider: undefined,
      declarationProvider: undefined,
      definitionProvider: undefined,
      typeDefinitionProvider: undefined,
      callHierarchyProvider: undefined,
      typeHierarchyProvider: undefined,
      hoverProvider: true,
      documentHighlightProvider: undefined,
      monikerProvider: undefined,
      inlineValueProvider: undefined,
      workspaceSymbolProvider: undefined,
      renameProvider: undefined,
      signatureHelpProvider: undefined,
      completionProvider: undefined,
      autoInsertionProvider: undefined,
      documentOnTypeFormattingProvider: undefined,
      documentLinkProvider: undefined,
      codeLensProvider: undefined,
      inlayHintProvider: undefined,
      semanticTokensProvider: undefined,
      codeActionProvider: undefined,
      diagnosticProvider: undefined,
      fileReferencesProvider: undefined,
      fileRenameEditsProvider: undefined,
      documentDropEditsProvider: undefined,
    },
  };
}

function generateTypes(
  manifest: Package,
  depName: string,
  context: LanguageServiceContext
) {
  const tsService = context.project.typescript;
  console.debug("generating types for:", depName);

  const config =
    !depName || depName === "global"
      ? configurationService.config
      : configurationService.config.libraries?.[depName];
  const typeFileName = `virtual://${depName}/jsx-types.d.ts`;
  const typesContent = generateJsxTypes(manifest, {
    tagFormatter: (tag) => config?.tagFormatter?.(tag) ?? tag,
    fileName: "",
  });

  console.debug("Generated JSX types:", typesContent);

  // Override TypeScript's file system to include our generated types
  if (tsService) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const host: any = tsService.languageServiceHost;
    const originalGetScriptSnapshot =
      tsService.languageServiceHost.getScriptSnapshot;
    const originalGetScriptFileNames =
      tsService.languageServiceHost.getScriptFileNames;

    // Add our virtual file to the list of script files
    tsService.languageServiceHost.getScriptFileNames = function () {
      const fileNames = originalGetScriptFileNames?.call(this) || [];
      return [...fileNames, typeFileName];
    };

    // Provide content for our virtual file
    tsService.languageServiceHost.getScriptSnapshot = function (fileName) {
      if (fileName === typeFileName) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ts = require("typescript");
        return ts.ScriptSnapshot.fromString(typesContent);
      }
      return originalGetScriptSnapshot?.call(this, fileName);
    };

    if (!host.__wc_jsx_map) host.__wc_jsx_map = new Map();
    host.__wc_jsx_map.set(depName, typesContent);
    if (!host.__wc_installed) {
      const origNames = host.getScriptFileNames?.bind(host);
      const origSnap = host.getScriptSnapshot?.bind(host);
      host.getScriptFileNames = () => {
        const names = origNames?.() || [];
        for (const k of host.__wc_jsx_map.keys())
          if (!names.includes(k)) names.push(k);
        return names;
      };
      host.getScriptSnapshot = (fileName: string) => {
        if (host.__wc_jsx_map.has(fileName)) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const ts = require("typescript");
          return ts.ScriptSnapshot.fromString(
            host.__wc_jsx_map.get(fileName) || ""
          );
        }
        return origSnap?.(fileName);
      };
      host.__wc_installed = true;
      host.__wc_restore = () => {
        host.getScriptFileNames = origNames;
        host.getScriptSnapshot = origSnap;
        host.__wc_jsx_map = undefined;
        host.__wc_installed = false;
      };
    }
  }
}
