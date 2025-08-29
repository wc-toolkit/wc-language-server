import { getComponentDetailsTemplate } from "@wc-toolkit/cem-utilities";
import {
  AttributeInfo,
  customElementsService,
} from "../../services/custom-elements-service.js";
import * as html from "vscode-html-languageservice";
import { configurationService } from "../../services/configuration-service.js";

export function getAutoCompleteSuggestions(
  document: html.TextDocument,
  position: html.Position,
) {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const beforeText = text.substring(0, offset);
  const htmlLanguageService = html.getLanguageService();

  const textDocument = html.TextDocument.create(
    document.uri,
    "html",
    0,
    document.getText(),
  );
  const htmlDocument = htmlLanguageService.parseHTMLDocument(textDocument);

  // Get default completions
  const result = htmlLanguageService.doComplete(
    textDocument,
    position,
    htmlDocument,
  );

  // Add snippet completions for custom tags and attributes
  const customCompletions = getCompletions(beforeText, result);

  return customCompletions;
}

function getCompletions(
  beforeText: string,
  completions: html.CompletionList,
): html.CompletionList | null {
  // Tag completion: <my-elem|
  const tagMatch = beforeText.match(/<([a-zA-Z0-9-]*)$/);
  if (tagMatch) {
    return getTagCompletions(completions);
  }

  // Tag name without opening '<': my-ele|
  const bareTagMatch = beforeText.match(/(?:^|\s)([a-zA-Z0-9-]+)$/);
  if (bareTagMatch) {
    // Only trigger if not inside quotes or angle brackets
    const lastChar = beforeText[beforeText.length - 1];
    if (
      lastChar !== '"' &&
      lastChar !== "'" &&
      lastChar !== "<" &&
      lastChar !== "="
    ) {
      return getTagCompletions(completions, true);
    }
  }

  // Attribute value completion: <my-elem attr="|
  const attrValueMatch = beforeText.match(
    /<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?\s+([a-zA-Z0-9-]+)=["']?([^"']*)$/,
  );
  if (attrValueMatch) {
    const tagName = attrValueMatch[1];
    const attributeName = attrValueMatch[2];

    return getAttributeValueCompletions(completions, tagName, attributeName);
  }

  // Attribute name completion: <my-elem |
  const attrNameMatch = beforeText.match(
    /<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?\s+([a-zA-Z0-9-]*)$/,
  );
  if (attrNameMatch) {
    const tagName = attrNameMatch[1];
    return getAttributeCompletions(completions, tagName);
  }

  return null;
}

function getTagCompletions(
  htmlCompletions: html.CompletionList,
  includeOpeningBrackets: boolean = false,
): html.CompletionList {
  const customElements = customElementsService.getCustomElements();

  const customCompletions: html.CompletionItem[] = customElements.map(
    (element) => {
      const formattedTagName = configurationService.getFormattedTagName(
        element.tagName!,
        element.dependency as string,
      );
      const tag = includeOpeningBrackets
        ? `<${formattedTagName}>$0</${formattedTagName}>`
        : `${formattedTagName}>$0</${formattedTagName}>`;
      return {
        label: formattedTagName,
        kind: html.CompletionItemKind.Snippet,
        documentation: {
          kind: "markdown",
          value: getComponentDetailsTemplate(element),
        },
        insertText: tag,
        insertTextFormat: html.InsertTextFormat.Snippet,
        detail: "Custom Element",
        sortText: "0" + formattedTagName,
        deprecated: !!element.deprecated,
      };
    },
  );

  htmlCompletions.items.push(...customCompletions);
  return htmlCompletions;
}

function getAttributeCompletions(
  htmlCompletions: html.CompletionList,
  tagName: string,
): html.CompletionList {
  const element = customElementsService.getCustomElement(tagName);
  if (!element) {
    return htmlCompletions;
  }

  const attributes = getAttributeInfo(tagName);
  const customCompletions: html.CompletionItem[] = attributes.map((attr) => {
    const hasValues = attr.options && attr.options.length > 0;
    const isBoolean = attr.type === "boolean";

    return {
      label: attr.name,
      kind: html.CompletionItemKind.Property,
      documentation: {
        kind: "markdown",
        value: `${attr.description}\n\n**Type:** \`${attr.type}\``,
      },
      insertText: hasValues
        ? `${attr.name}="$1"$0`
        : isBoolean
          ? attr.name
          : `${attr.name}="$0"`,
      insertTextFormat: html.InsertTextFormat.Snippet,
      sortText: "0" + attr.name,
      command:
        hasValues && !isBoolean
          ? { command: "editor.action.triggerSuggest", title: "Suggest" }
          : undefined,
      deprecated: !!attr.deprecated,
    };
  });

  htmlCompletions.items.push(...customCompletions);
  return htmlCompletions;
}

function getAttributeValueCompletions(
  htmlCompletions: html.CompletionList,
  tagName: string,
  attributeName: string,
): html.CompletionList {
  const attributes = getAttributeInfo(tagName);
  const attribute = attributes.find((attr) => attr.name === attributeName);

  if (!attribute?.options?.length) {
    return htmlCompletions;
  }

  const customCompletions: html.CompletionItem[] = attribute?.options.map(
    (value) => ({
      label: value,
      kind: html.CompletionItemKind.Value,
      documentation: {
        kind: "markdown",
        value: `Value for ${attribute.name} attribute`,
      },
      insertText: value,
      sortText: "0" + value,
    }),
  );

  htmlCompletions.items.push(...customCompletions);
  return htmlCompletions;
}

function getAttributeInfo(tagName: string): AttributeInfo[] {
  return Array.from(customElementsService.attributeData?.entries())
    .filter(([key]) => key.startsWith(`${tagName}:`))
    .map(([, value]) => value);
}
