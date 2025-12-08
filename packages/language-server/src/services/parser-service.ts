/* eslint-disable @typescript-eslint/no-explicit-any */
import * as html from "vscode-html-languageservice";
import Parser from "tree-sitter";
import HtmlGrammar from "tree-sitter-html";

export type AttributeSpans = Record<string, { start: number; end: number }>; 

export interface TemplateNode {
  tag: string | null;
  start: number;
  end: number;
  attributes: Record<string, string | undefined>;
  attributeSpans: AttributeSpans;
  children: TemplateNode[];
}

export interface ParsedDocument {
  roots: TemplateNode[];
  findNodeAt(offset: number): TemplateNode | null;
}

function offsetInRange(offset: number, start: number, end: number) {
  return offset >= start && offset <= end;
}

function findDeepestNode(nodes: TemplateNode[], offset: number): TemplateNode | null {
  for (const node of nodes) {
    if (!node.tag) continue;
    if (offsetInRange(offset, node.start, node.end)) {
      const childHit = findDeepestNode(node.children, offset);
      return childHit ?? node;
    }
  }
  return null;
}

function parseAttributeText(attrText: string) {
  const nameMatch = attrText.match(/^\s*([^\s=>]+)/);
  const valueMatch = attrText.match(/=(.*)$/);
  return {
    name: nameMatch ? nameMatch[1] : "",
    value: valueMatch ? valueMatch[1]?.replace(/^\s*["']?|["']?\s*$/g, "") : undefined,
  };
}

function buildAttributeSpans(nodeText: string, absoluteStart: number) {
  const spans: AttributeSpans = {};
  const regex = /([^\s=>]+)(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(nodeText)) !== null) {
    const name = match[1];
    const start = absoluteStart + match.index;
    const end = start + match[0].length;
    spans[name] = { start, end };
  }
  return spans;
}

class ParserService {
  private parser: any | null = null;
  private treeSitterAvailable = false;

  constructor() {
    try {
      this.parser = new (Parser as any)();
      this.parser.setLanguage(HtmlGrammar as any);
      this.treeSitterAvailable = true;
    } catch {
      this.parser = null;
      this.treeSitterAvailable = false;
    }
  }

  public parse(document: html.TextDocument): ParsedDocument {
    const text = document.getText();
    if (this.treeSitterAvailable && this.parser) {
      try {
        const tree = this.parser.parse(text);
        const roots = this.extractFromTreeSitter(tree.rootNode, text);
        return {
          roots,
          findNodeAt: (offset: number) => findDeepestNode(roots, offset),
        };
      } catch {
        // fall through to HTML service
      }
    }

    const fallbackRoots = this.extractWithHtmlService(document);
    return {
      roots: fallbackRoots,
      findNodeAt: (offset: number) => findDeepestNode(fallbackRoots, offset),
    };
  }

  private extractFromTreeSitter(root: any, text: string): TemplateNode[] {
    const nodes: TemplateNode[] = [];
    for (const child of root.namedChildren) {
      if (this.isElementNode(child)) {
        const converted = this.convertElement(child, text);
        if (converted) {
          nodes.push(converted);
        }
      } else {
        nodes.push(...this.extractFromTreeSitter(child, text));
      }
    }
    return nodes;
  }

  private isElementNode(node: any) {
    return node.type === "element" || node.type === "script_element" || node.type === "style_element";
  }

  private convertElement(node: any, text: string): TemplateNode | null {
    const startTag =
      node.childForFieldName("start_tag") ||
      node.childForFieldName("self_closing_tag") ||
      (node.type === "self_closing_tag" ? node : null);
    if (!startTag) return null;

    const rawStartTag = text.slice(startTag.startIndex, startTag.endIndex);
    const tagMatch = rawStartTag.match(/<\s*([\w.-]+)/);
    const tagName = tagMatch ? tagMatch[1] : null;

    const attributes: Record<string, string | undefined> = {};
    const attributeSpans: AttributeSpans = {};

    for (const attrNode of startTag.namedChildren) {
      if (attrNode.type !== "attribute") continue;
      const attrText = text.slice(attrNode.startIndex, attrNode.endIndex);
      const parsed = parseAttributeText(attrText);
      if (!parsed.name) continue;
      attributes[parsed.name] = parsed.value;
      attributeSpans[parsed.name] = {
        start: attrNode.startIndex,
        end: attrNode.endIndex,
      };
    }

    // Fallback span detection if no attribute nodes were found (e.g., grammar mismatch)
    if (Object.keys(attributeSpans).length === 0) {
      Object.assign(attributeSpans, buildAttributeSpans(rawStartTag, startTag.startIndex));
    }

    const children: TemplateNode[] = [];
    for (const child of node.namedChildren) {
      if (this.isElementNode(child)) {
        const converted = this.convertElement(child, text);
        if (converted) {
          children.push(converted);
        }
      }
    }

    return {
      tag: tagName,
      start: startTag.startIndex,
      end: node.endIndex,
      attributes,
      attributeSpans,
      children,
    };
  }

  private extractWithHtmlService(document: html.TextDocument): TemplateNode[] {
    const languageService = html.getLanguageService();
    const htmlDocument = languageService.parseHTMLDocument(document);

    const convert = (node: html.Node): TemplateNode => {
      const tag = node.tag || null;
      const attributes: Record<string, string | undefined> = {};
      for (const [name, value] of Object.entries(node.attributes || {})) {
        attributes[name] = value ?? undefined;
      }
      const attributeSpans = buildAttributeSpans(
        document.getText().slice(node.start, node.end),
        node.start,
      );
      const children = (node.children || []).map(convert);
      return {
        tag,
        start: node.start,
        end: node.end,
        attributes,
        attributeSpans,
        children,
      };
    };

    return htmlDocument.roots.map(convert);
  }
}

export const parserService = new ParserService();
