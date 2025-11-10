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
import { manifestService } from "./services/manifest-service.js";

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

/**
 * Enhanced virtual code implementation for web component HTML files.
 * Creates better mappings for Web Components and extracts embedded CSS and JavaScript/TypeScript code.
 */
export class WebComponentsVirtualCode implements VirtualCode {
  id = "wc-root";
  languageId = "html";
  mappings: CodeMapping[];
  embeddedCode: VirtualCode[] = [];
  htmlDocument: html.HTMLDocument;
  snapshot: ts.IScriptSnapshot;

  constructor(_snapshot: ts.IScriptSnapshot) {
    this.snapshot = _snapshot;
    const text = this.snapshot.getText(0, this.snapshot.getLength());
    this.htmlDocument = html
      .getLanguageService()
      .parseHTMLDocument(html.TextDocument.create("", "html", 0, text));

    // Create more granular mappings for custom elements
    this.mappings = this.createCustomElementMappings(text);
    this.embeddedCode = [...this.extractEmbeddedCode(this.snapshot)];
  }

  /**
   * Creates mappings that enable better navigation and hover for custom elements
   */
  private createCustomElementMappings(text: string): CodeMapping[] {
    const mappings: CodeMapping[] = [];

    // Default full document mapping
    mappings.push({
      sourceOffsets: [0],
      generatedOffsets: [0],
      lengths: [text.length],
      data: DEFAULT_CAPABILITIES,
    });

    // Create specific mappings for custom elements to enable better features
    this.htmlDocument.roots.forEach((node) => {
      if (node.tag && manifestService.hasCustomElement(node.tag)) {
        // Map the tag name for go-to-definition
        const tagStart = node.start + 1; // Skip '<'

        mappings.push({
          sourceOffsets: [tagStart],
          generatedOffsets: [tagStart],
          lengths: [node.tag.length],
          data: {
            navigation: true,
            completion: true,
            verification: true,
          },
        });

        // Map custom attributes for better IntelliSense
        if (node.attributes) {
          const element = manifestService.getCustomElement(node.tag);
          Object.keys(node.attributes).forEach((attrName) => {
            const isCustomAttribute = element?.attributes?.some(
              (attr: { name: string }) => attr.name === attrName,
            );

            if (isCustomAttribute) {
              const attrMatch = text
                .substring(node.start, node.end)
                .match(new RegExp(`\\s(${attrName})(?:=|\\s|>)`));

              if (attrMatch) {
                const attrStart = node.start + attrMatch.index! + 1;
                const attrLength = attrMatch[1].length;

                mappings.push({
                  sourceOffsets: [attrStart],
                  generatedOffsets: [attrStart],
                  lengths: [attrLength],
                  data: {
                    completion: true,
                    verification: true,
                  },
                });
              }
            }
          });
        }
      }
    });

    return mappings;
  }

  private extractEmbeddedCode(snapshot: ts.IScriptSnapshot): VirtualCode[] {
    const text = snapshot.getText(0, snapshot.getLength());
    const embeddedCodes: VirtualCode[] = [];

    this.htmlDocument.roots.forEach((node, index) => {
      // Extract script tags with better context awareness
      if (
        node.tag === "script" &&
        node.startTagEnd !== undefined &&
        node.endTagStart !== undefined
      ) {
        const scriptContent = text.substring(
          node.startTagEnd,
          node.endTagStart,
        );
        const languageId = this.getScriptLanguageId(node);

        const embeddedCode: VirtualCode = {
          id: `script_${index}`,
          languageId,
          snapshot: createTextSnapshot(scriptContent),
          mappings: [
            {
              sourceOffsets: [node.startTagEnd],
              generatedOffsets: [0],
              lengths: [scriptContent.length],
              data: {
                completion: true,
                navigation: true,
                semantic: true,
                verification: true,
              },
            },
          ],
        };

        embeddedCodes.push(embeddedCode);
      }

      // Extract style tags with CSS support
      if (
        node.tag === "style" &&
        node.startTagEnd !== undefined &&
        node.endTagStart !== undefined
      ) {
        const styleContent = text.substring(node.startTagEnd, node.endTagStart);

        const embeddedCode: VirtualCode = {
          id: `style_${index}`,
          languageId: "css",
          snapshot: createTextSnapshot(styleContent),
          mappings: [
            {
              sourceOffsets: [node.startTagEnd],
              generatedOffsets: [0],
              lengths: [styleContent.length],
              data: {
                completion: true,
                format: true,
                verification: true,
              },
            },
          ],
        };

        embeddedCodes.push(embeddedCode);
      }
    });

    return embeddedCodes;
  }

  private getScriptLanguageId(script: html.Node): string {
    const lang = script.attributes?.lang;
    const type = script.attributes?.type;

    if (lang === "ts" || lang === '"ts"' || lang === "'ts'")
      return "typescript";
    if (type?.includes("typescript")) return "typescript";

    return "javascript";
  }
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
