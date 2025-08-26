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
import { WebComponentsVirtualCode } from "./language-plugin-enhanced.js";

/** File extensions supported by the language plugin */
const SUPPORTED_EXTENSIONS = {
  HTML: ".html",
  MD: ".md",
  MDX: ".mdx",
} as const;

/** Language identifiers used throughout the plugin */
const LANGUAGE_IDS = {
  HTML: "html",
  MD: "markdown",
  MDX: "mdx",
  CSS: "css",
  JAVASCRIPT: "javascript",
  TYPESCRIPT: "typescript",
} as const;

/** TypeScript script kind constants for different file types */
const SCRIPT_KINDS = {
  JS: 1 satisfies ts.ScriptKind.JS,
  TS: 3 satisfies ts.ScriptKind.TS,
  DEFERRED: 7 satisfies ts.ScriptKind.Deferred,
} as const;

/** Default capabilities enabled for code mappings */
const DEFAULT_CAPABILITIES = {
  completion: true,
  format: true,
  navigation: true,
  semantic: true,
  structure: true,
  verification: true,
} as const;

/**
 * Main language plugin for web components that provides HTML language support
 * with embedded CSS and JavaScript/TypeScript extraction.
 */
export const wcLanguagePlugin: LanguagePlugin<URI> = {
  /**
   * Determines the language ID for a given file URI.
   * @param uri - The file URI to check
   * @returns The language ID if supported, undefined otherwise
   */
  getLanguageId(uri) {
    if (uri.path.endsWith(SUPPORTED_EXTENSIONS.HTML)) {
      return LANGUAGE_IDS.HTML;
    }
    if (uri.path.endsWith(SUPPORTED_EXTENSIONS.MD)) {
      return LANGUAGE_IDS.HTML; // treat .md as HTML for plugin purposes
    }
    if (uri.path.endsWith(SUPPORTED_EXTENSIONS.MDX)) {
      return LANGUAGE_IDS.HTML; // treat .mdx as HTML for plugin purposes
    }
    return undefined;
  },

  /**
   * Creates a virtual code instance for the given file.
   * @param _uri - The file URI (unused)
   * @param languageId - The detected language ID
   * @param snapshot - The text snapshot of the file content
   * @returns VirtualCode instance for HTML files, undefined for others
   */
  createVirtualCode(_uri, languageId, snapshot) {
    // treat .md and .mdx as HTML for virtual code
    if (
      languageId === LANGUAGE_IDS.HTML ||
      languageId === LANGUAGE_IDS.MD ||
      languageId === LANGUAGE_IDS.MDX
    ) {
      // Use the enhanced virtual code for better Web Components support
      return new WebComponentsVirtualCode(snapshot);
    }
    return undefined;
  },

  typescript: {
    /** Extra file extensions that TypeScript should handle */
    extraFileExtensions: [
      {
        extension: "html",
        isMixedContent: true,
        scriptKind: SCRIPT_KINDS.DEFERRED,
      },
      {
        extension: "md",
        isMixedContent: true,
        scriptKind: SCRIPT_KINDS.DEFERRED,
      },
      {
        extension: "mdx",
        isMixedContent: true,
        scriptKind: SCRIPT_KINDS.DEFERRED,
      },
    ],

    /**
     * Gets the main service script for TypeScript (not used in this implementation).
     * @returns undefined as we don't provide a main service script
     */
    getServiceScript: () => undefined,

    /**
     * Extracts additional TypeScript service scripts from embedded code.
     * @param fileName - The name of the file being processed
     * @param root - The root virtual code containing embedded scripts
     * @returns Array of TypeScript service scripts for embedded code
     */
    getExtraServiceScripts(fileName, root) {
      const scripts: TypeScriptExtraServiceScript[] = [];

      for (const code of forEachEmbeddedCode(root)) {
        const scriptConfig = getScriptConfig(
          code.languageId,
          fileName,
          code.id,
        );
        if (scriptConfig) {
          scripts.push({ ...scriptConfig, code });
        }
      }

      return scripts;
    },
  },
};

/**
 * Helper function that creates script configuration for TypeScript service.
 * @param languageId - The language ID of the embedded code
 * @param fileName - The base file name
 * @param codeId - The unique ID of the embedded code
 * @returns Script configuration object or null if language not supported
 */
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

/** HTML language service instance for parsing HTML documents */
const htmlLs = html.getLanguageService();

/**
 * Virtual code implementation for web component HTML files.
 * Handles parsing HTML and extracting embedded CSS and JavaScript/TypeScript code.
 */
export class WcLanguageServerVirtualCode implements VirtualCode {
  /** Unique identifier for this virtual code instance */
  id = "root";

  /** Language identifier for this virtual code */
  languageId = LANGUAGE_IDS.HTML;

  /** Code mappings between source and generated positions */
  mappings: CodeMapping[];

  /** Array of embedded virtual code instances (CSS, JS, TS) */
  embeddedCode: VirtualCode[] = [];

  /** Parsed HTML document structure */
  htmlDocument: html.HTMLDocument;

  /**
   * Creates a new virtual code instance for an HTML document.
   * @param snapshot - TypeScript script snapshot containing the HTML content
   */
  constructor(public snapshot: ts.IScriptSnapshot) {
    const text = snapshot.getText(0, snapshot.getLength());

    this.mappings = [createFullDocumentMapping(snapshot.getLength())];
    this.htmlDocument = htmlLs.parseHTMLDocument(
      html.TextDocument.create("", LANGUAGE_IDS.HTML, 0, text),
    );
    this.embeddedCode = [...this.extractEmbeddedCode(snapshot)];
  }

  /**
   * Extracts embedded code (CSS and JavaScript/TypeScript) from the HTML document.
   * @param snapshot - The text snapshot to extract code from
   * @returns Generator yielding virtual code instances for embedded content
   */
  private *extractEmbeddedCode(
    snapshot: ts.IScriptSnapshot,
  ): Generator<VirtualCode> {
    const { styles, scripts } = this.categorizeElements();

    yield* this.createStyleCode(snapshot, styles);
    yield* this.createScriptCode(snapshot, scripts);
  }

  /**
   * Categorizes HTML elements into styles and scripts for processing.
   * @returns Object containing arrays of style and script elements
   */
  private categorizeElements() {
    return {
      styles: this.htmlDocument.roots.filter((root) => root.tag === "style"),
      scripts: this.htmlDocument.roots.filter((root) => root.tag === "script"),
    };
  }

  /**
   * Creates virtual code instances for CSS style elements.
   * @param snapshot - The text snapshot containing the HTML
   * @param styles - Array of style elements to process
   * @returns Generator yielding virtual code for each style element
   */
  private *createStyleCode(
    snapshot: ts.IScriptSnapshot,
    styles: any[],
  ): Generator<VirtualCode> {
    for (const [index, style] of styles.entries()) {
      const code = this.createEmbeddedCode(
        snapshot,
        style,
        `style_${index}`,
        LANGUAGE_IDS.CSS,
      );
      if (code) yield code;
    }
  }

  /**
   * Creates virtual code instances for JavaScript/TypeScript script elements.
   * @param snapshot - The text snapshot containing the HTML
   * @param scripts - Array of script elements to process
   * @returns Generator yielding virtual code for each script element
   */
  private *createScriptCode(
    snapshot: ts.IScriptSnapshot,
    scripts: any[],
  ): Generator<VirtualCode> {
    for (const [index, script] of scripts.entries()) {
      const languageId = this.getScriptLanguageId(script);
      const code = this.createEmbeddedCode(
        snapshot,
        script,
        `script_${index}`,
        languageId,
      );
      if (code) yield code;
    }
  }

  /**
   * Determines the language ID for a script element based on its attributes.
   * @param script - The script element to analyze
   * @returns Language ID (typescript or javascript)
   */
  private getScriptLanguageId(script: any): string {
    const lang = script.attributes?.lang;
    const isTypeScript = lang === "ts" || lang === '"ts"' || lang === "'ts'";
    return isTypeScript ? LANGUAGE_IDS.TYPESCRIPT : LANGUAGE_IDS.JAVASCRIPT;
  }

  /**
   * Creates a virtual code instance for embedded content within an HTML element.
   * @param snapshot - The text snapshot containing the HTML
   * @param element - The HTML element containing the embedded code
   * @param id - Unique identifier for the embedded code
   * @param languageId - Language identifier for the embedded code
   * @returns Virtual code instance or null if element is invalid
   */
  private createEmbeddedCode(
    snapshot: ts.IScriptSnapshot,
    element: any,
    id: string,
    languageId: string,
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

/**
 * Creates a code mapping that covers the entire document.
 * @param length - The length of the document
 * @returns CodeMapping covering the full document with default capabilities
 */
function createFullDocumentMapping(length: number): CodeMapping {
  return {
    sourceOffsets: [0],
    generatedOffsets: [0],
    lengths: [length],
    data: DEFAULT_CAPABILITIES,
  };
}

/**
 * Creates a code mapping for embedded content at a specific offset.
 * @param sourceOffset - The starting offset in the source document
 * @param length - The length of the embedded content
 * @returns CodeMapping for the embedded content with default capabilities
 */
function createEmbeddedMapping(
  sourceOffset: number,
  length: number,
): CodeMapping {
  return {
    sourceOffsets: [sourceOffset],
    generatedOffsets: [0],
    lengths: [length],
    data: DEFAULT_CAPABILITIES,
  };
}

/**
 * Creates a text snapshot from a string for use in virtual code.
 * @param text - The text content to wrap in a snapshot
 * @returns Text snapshot interface compatible with TypeScript
 */
function createTextSnapshot(text: string) {
  return {
    getText: (start: number, end: number) => text.substring(start, end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}
