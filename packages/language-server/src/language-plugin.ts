/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CodeMapping,
  forEachEmbeddedCode,
  LanguagePlugin,
  VirtualCode,
} from "@volar/language-core";
import type { TypeScriptExtraServiceScript } from "@volar/typescript";
import type * as ts from "typescript";
import * as html from "vscode-html-languageservice";
import { URI } from "vscode-uri";

// Constants for better maintainability
const SUPPORTED_EXTENSIONS = {
  HTML: ".html",
} as const;

const LANGUAGE_IDS = {
  HTML: "html",
  CSS: "css",
  JAVASCRIPT: "javascript",
  TYPESCRIPT: "typescript",
} as const;

const SCRIPT_KINDS = {
  JS: 1 satisfies ts.ScriptKind.JS,
  TS: 3 satisfies ts.ScriptKind.TS,
  DEFERRED: 7 satisfies ts.ScriptKind.Deferred,
} as const;

// Default code mapping capabilities
const DEFAULT_CAPABILITIES = {
  completion: true,
  format: true,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true,
} as const;

export const wcLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    return uri.path.endsWith(SUPPORTED_EXTENSIONS.HTML)
      ? LANGUAGE_IDS.HTML
      : undefined;
  },

  createVirtualCode(_uri, languageId, snapshot) {
    return languageId === LANGUAGE_IDS.HTML
      ? new WcLanguageServerVirtualCode(snapshot)
      : undefined;
  },

  typescript: {
    extraFileExtensions: [
      {
        extension: "html",
        isMixedContent: true,
        scriptKind: SCRIPT_KINDS.DEFERRED,
      },
    ],
    getServiceScript: () => undefined,
    getExtraServiceScripts(fileName, root) {
      const scripts: TypeScriptExtraServiceScript[] = [];

      for (const code of forEachEmbeddedCode(root)) {
        const scriptConfig = getScriptConfig(
          code.languageId,
          fileName,
          code.id
        );
        if (scriptConfig) {
          scripts.push({ ...scriptConfig, code });
        }
      }

      return scripts;
    },
  },
};

// Helper function for script configuration
function getScriptConfig(languageId: string, fileName: string, codeId: string) {
  switch (languageId) {
    case LANGUAGE_IDS.JAVASCRIPT:
      return {
        fileName: `${fileName}.${codeId}.js`,
        extension: ".js",
        scriptKind: SCRIPT_KINDS.JS,
      };
    case LANGUAGE_IDS.TYPESCRIPT:
      return {
        fileName: `${fileName}.${codeId}.ts`,
        extension: ".ts",
        scriptKind: SCRIPT_KINDS.TS,
      };
    default:
      return null;
  }
}

const htmlLs = html.getLanguageService();

export class WcLanguageServerVirtualCode implements VirtualCode {
  id = "root";
  languageId = LANGUAGE_IDS.HTML;
  mappings: CodeMapping[];
  embeddedCode: VirtualCode[] = [];
  htmlDocument: html.HTMLDocument;

  constructor(public snapshot: ts.IScriptSnapshot) {
    const text = snapshot.getText(0, snapshot.getLength());

    this.mappings = [createFullDocumentMapping(snapshot.getLength())];
    this.htmlDocument = htmlLs.parseHTMLDocument(
      html.TextDocument.create("", LANGUAGE_IDS.HTML, 0, text)
    );
    this.embeddedCode = [...this.extractEmbeddedCode(snapshot)];
  }

  private *extractEmbeddedCode(
    snapshot: ts.IScriptSnapshot
  ): Generator<VirtualCode> {
    const { styles, scripts } = this.categorizeElements();

    yield* this.createStyleCode(snapshot, styles);
    yield* this.createScriptCode(snapshot, scripts);
  }

  private categorizeElements() {
    return {
      styles: this.htmlDocument.roots.filter((root) => root.tag === "style"),
      scripts: this.htmlDocument.roots.filter((root) => root.tag === "script"),
    };
  }

  private *createStyleCode(
    snapshot: ts.IScriptSnapshot,
    styles: any[]
  ): Generator<VirtualCode> {
    for (const [index, style] of styles.entries()) {
      const code = this.createEmbeddedCode(
        snapshot,
        style,
        `style_${index}`,
        LANGUAGE_IDS.CSS
      );
      if (code) yield code;
    }
  }

  private *createScriptCode(
    snapshot: ts.IScriptSnapshot,
    scripts: any[]
  ): Generator<VirtualCode> {
    for (const [index, script] of scripts.entries()) {
      const languageId = this.getScriptLanguageId(script);
      const code = this.createEmbeddedCode(
        snapshot,
        script,
        `script_${index}`,
        languageId
      );
      if (code) yield code;
    }
  }

  private getScriptLanguageId(script: any): string {
    const lang = script.attributes?.lang;
    const isTypeScript = lang === "ts" || lang === '"ts"' || lang === "'ts'";
    return isTypeScript ? LANGUAGE_IDS.TYPESCRIPT : LANGUAGE_IDS.JAVASCRIPT;
  }

  private createEmbeddedCode(
    snapshot: ts.IScriptSnapshot,
    element: any,
    id: string,
    languageId: string
  ): VirtualCode | null {
    if (
      element.startTagEnd === undefined ||
      element.endTagStart === undefined
    ) {
      return null;
    }

    const text = snapshot.getText(element.startTagEnd, element.endTagStart);

    return {
      id,
      languageId,
      snapshot: createTextSnapshot(text),
      mappings: [createEmbeddedMapping(element.startTagEnd, text.length)],
      embeddedCode: [],
    };
  }
}

// Helper functions
function createFullDocumentMapping(length: number): CodeMapping {
  return {
    sourceOffsets: [0],
    generatedOffsets: [0],
    lengths: [length],
    data: DEFAULT_CAPABILITIES,
  };
}

function createEmbeddedMapping(
  sourceOffset: number,
  length: number
): CodeMapping {
  return {
    sourceOffsets: [sourceOffset],
    generatedOffsets: [0],
    lengths: [length],
    data: DEFAULT_CAPABILITIES,
  };
}

function createTextSnapshot(text: string) {
  return {
    getText: (start: number, end: number) => text.substring(start, end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}
