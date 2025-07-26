import { HTMLDataAttribute, HTMLDataTag, HTMLDataAttributeValue, LanguageServerAdapter } from "./types";
import * as html from 'vscode-html-languageservice';
import type * as cem from 'custom-elements-manifest/schema' with { 'resolution-mode': 'require' };

export class VSCodeAdapter implements LanguageServerAdapter {
  createCompletionItem(tag: string, description: string, _attributes: HTMLDataAttribute[] = []) {
    return {
      label: tag,
      kind: html.CompletionItemKind.Property,
      documentation: {
        kind: 'markdown',
        value: description
      },
      insertText: `<${tag}>$0</${tag}>`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      detail: 'Custom Element',
      sortText: '0' + tag, // Sort custom elements first
    };
  }

  createHTMLDataProvider(tags: HTMLDataTag[]) {
    return html.newHTMLDataProvider('custom-elements', {
      version: 1.1,
      tags: tags
    });
  }

  createHoverInfo(tag: string, description: string) {
    return {
      kind: 'markdown',
      value: `**${tag}** (Custom Element)\n\n${description}`
    };
  }
  
  // New method to create attribute completion items
  createAttributeCompletionItem(attribute: HTMLDataAttribute, tagName: string) {
    const hasValues = attribute.values && attribute.values.length > 0;
    
    const documentation = attribute.description || `Attribute: ${attribute.name}`;
    const typeInfo = attribute.type ? `\n\n**Type:** \`${attribute.type}\`` : '';
    
    return {
      label: attribute.name,
      kind: html.CompletionItemKind.Property,
      documentation: {
        kind: 'markdown',
        value: documentation + typeInfo
      },
      insertText: hasValues ? `${attribute.name}="$1"$0` : `${attribute.name}="$0"`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      sortText: '0' + attribute.name, // Sort at the top
      command: hasValues ? { command: 'editor.action.triggerSuggest', title: 'Suggest' } : undefined
    };
  }
  
  // New method to create attribute value completion items
  createAttributeValueCompletionItem(attribute: HTMLDataAttribute, value: HTMLDataAttributeValue, tagName: string) {
    return {
      label: value.name,
      kind: html.CompletionItemKind.Value,
      documentation: {
        kind: 'markdown',
        value: value.description || `Value for ${attribute.name} attribute`
      },
      insertText: value.name,
      filterText: value.name,
      sortText: '0' + value.name, // Sort at the top
      textEdit: {
        range: {}, // This will be set by the completion provider
        newText: value.name
      }
    };
  }
  
  // Add new methods for definition provider
  createTagDefinitionLocation(tagName: string, manifestPath: string, position: number) {
    try {
      // For macOS, the proper format is file:///absolute/path
      const fullPath = manifestPath.startsWith('/') 
        ? manifestPath 
        : `/${manifestPath}`;
        
      // Format the URI with proper encoding
      const uri = `file://${fullPath}`;
      
      // Create a Location object that VSCode can navigate to
      const location = {
        uri: uri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 }
        }
      };
      
      return location;
    } catch (error) {
      return null;
    }
  }
  
  createAttributeDefinitionLocation(tagName: string, attributeName: string, manifestPath: string, position: number) {
    // Create a Location object that VSCode can navigate to
    return {
      uri: `file://${manifestPath}`,
      range: this.createRangeFromPosition(position)
    };
  }
  
  // Helper to create a range from a position
  private createRangeFromPosition(position: number) {
    try {
      // For a JSON file, we'll convert the flat position to a line/character
      // This is a simplified calculation but might be more accurate
      // than just using the flat position
      
      // Assuming an average line length of 40 characters for JSON
      const averageLineLength = 40;
      const estimatedLine = Math.floor(position / averageLineLength);
      const estimatedChar = position % averageLineLength;
      
      return {
        start: { line: estimatedLine, character: estimatedChar },
        end: { line: estimatedLine, character: estimatedChar + 10 }
      };
    } catch (error) {
      console.error('Error creating range:', error);
      return { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };
    }
  }
  
  // Add this method to your VSCodeAdapter class
  createCompletionList(elements: cem.CustomElement[]): any {
    const completionItems: any[] = [];
    
    for (const element of elements) {
      if (element.tagName) {
        completionItems.push({
          label: element.tagName,
          kind: html.CompletionItemKind.Property,
          documentation: element.description,
          insertText: `<${element.tagName}>$0</${element.tagName}>`,
          insertTextFormat: html.InsertTextFormat.Snippet,
          detail: 'Custom Element',
        });
        // const tag = element.tagName;
        // completionItems.push({
        //   label: tag,
        //   kind: html.CompletionItemKind.Property,
        //   documentation: {
        //     kind: 'markdown',
        //     value: element.description
        //   },
        //   insertText: `${tag}>$0</${tag}>`,
        //   insertTextFormat: html.InsertTextFormat.Snippet,
        //   detail: 'Custom Element',
        //   sortText: '0' + tag, // Sort custom elements first
        // });
      }
    }
    
    return {
      isIncomplete: false,
      items: completionItems,
    };
  }
  
  // Add to your VSCodeAdapter class
  createDiagnostic(range: any, message: string, severity: number = 1) {
    return {
      range,
      message,
      severity,
      source: 'web-components'
    };
  }
}
