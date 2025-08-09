import { CodeMapping, VirtualCode } from "@volar/language-core";
import type * as ts from "typescript";
import * as html from "vscode-html-languageservice";
import { customElementsService } from "./services/custom-elements-service";

/**
 * Enhanced virtual code that creates better mappings for Web Components
 * This leverages Volar's mapping system for more precise positioning
 */
export class WebComponentsVirtualCode implements VirtualCode {
  id = "wc-root";
  languageId = "html";
  mappings: CodeMapping[];
  embeddedCode: VirtualCode[] = [];
  htmlDocument: html.HTMLDocument;

  constructor(public snapshot: ts.IScriptSnapshot) {
    const text = snapshot.getText(0, snapshot.getLength());
    this.htmlDocument = html.getLanguageService().parseHTMLDocument(
      html.TextDocument.create("", "html", 0, text)
    );
    
    // Create more granular mappings for custom elements
    this.mappings = this.createCustomElementMappings(text);
    this.embeddedCode = [...this.extractEmbeddedCode(snapshot)];
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
      data: {
        completion: true,
        format: true,
        navigation: true,
        semantic: true,
        structure: true,
        verification: true,
      },
    });

    // Create specific mappings for custom elements to enable better features
    this.htmlDocument.roots.forEach(node => {
      if (node.tag && customElementsService.hasCustomElement(node.tag)) {
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
          const element = customElementsService.getCustomElement(node.tag);
          Object.keys(node.attributes).forEach(attrName => {
            const isCustomAttribute = element?.attributes?.some(
              attr => attr.name === attrName
            );
            
            if (isCustomAttribute) {
              const attrMatch = text.substring(node.start, node.end).match(
                new RegExp(`\\s(${attrName})(?:=|\\s|>)`)
              );
              
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
                  }
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
    // Enhanced embedded code extraction that preserves Web Components context
    const text = snapshot.getText(0, snapshot.getLength());
    const embeddedCodes: VirtualCode[] = [];
    
    this.htmlDocument.roots.forEach((node, index) => {
      // Extract script tags with better context awareness
      if (node.tag === "script" && node.startTagEnd !== undefined && node.endTagStart !== undefined) {
        const scriptContent = text.substring(node.startTagEnd, node.endTagStart);
        const languageId = this.getScriptLanguageId(node);
        
        const embeddedCode: VirtualCode = {
          id: `script_${index}`,
          languageId,
          snapshot: this.createTextSnapshot(scriptContent),
          mappings: [{
            sourceOffsets: [node.startTagEnd],
            generatedOffsets: [0],
            lengths: [scriptContent.length],
            data: {
              completion: true,
              navigation: true,
              semantic: true,
              verification: true,
            },
          }],
          embeddedCode: [],
        };
        
        embeddedCodes.push(embeddedCode);
      }
      
      // Extract style tags with CSS support
      if (node.tag === "style" && node.startTagEnd !== undefined && node.endTagStart !== undefined) {
        const styleContent = text.substring(node.startTagEnd, node.endTagStart);
        
        const embeddedCode: VirtualCode = {
          id: `style_${index}`,
          languageId: "css",
          snapshot: this.createTextSnapshot(styleContent),
          mappings: [{
            sourceOffsets: [node.startTagEnd],
            generatedOffsets: [0],
            lengths: [styleContent.length],
            data: {
              completion: true,
              format: true,
              verification: true,
            },
          }],
          embeddedCode: [],
        };
        
        embeddedCodes.push(embeddedCode);
      }
    });

    return embeddedCodes;
  }

  private getScriptLanguageId(script: html.Node): string {
    const lang = script.attributes?.lang;
    const type = script.attributes?.type;
    
    if (lang === "ts" || lang === '"ts"' || lang === "'ts'") return "typescript";
    if (type?.includes("typescript")) return "typescript";
    
    return "javascript";
  }

  private createTextSnapshot(text: string) {
    return {
      getText: (start: number, end: number) => text.substring(start, end),
      getLength: () => text.length,
      getChangeRange: () => undefined,
    };
  }
}
