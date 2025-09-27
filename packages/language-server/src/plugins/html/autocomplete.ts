import { getComponentDetailsTemplate } from "@wc-toolkit/cem-utilities";
import {
  AttributeInfo,
  customElementsService,
} from "../../services/custom-elements-service.js";
import * as html from "vscode-html-languageservice";
import { configurationService } from "../../services/configuration-service.js";
import {
  ATTR_NAME_REGEX,
  ATTR_VALUE_REGEX,
  BindingPrefix,
  getAttributePrefix,
  getBaseAttributeName,
} from "./utilities.js";
import { debug } from "../../utilities/logger.js";

export function getAutoCompleteSuggestions(
  document: html.TextDocument,
  position: html.Position
) {
  debug("autocomplete:getSuggestions:start", {
    uri: document.uri,
    line: position.line,
    character: position.character,
  });
  const text = document.getText();
  const offset = document.offsetAt(position);
  const beforeText = text.substring(0, offset);
  const htmlLanguageService = html.getLanguageService();

  const textDocument = html.TextDocument.create(
    document.uri,
    "html",
    0,
    document.getText()
  );
  const htmlDocument = htmlLanguageService.parseHTMLDocument(textDocument);

  // Get default completions
  const result = htmlLanguageService.doComplete(
    textDocument,
    position,
    htmlDocument
  );

  // Add snippet completions for custom tags and attributes
  const customCompletions = getCompletions(beforeText, result);

  return customCompletions;
}

function getCompletions(
  beforeText: string,
  completions: html.CompletionList
): html.CompletionList | null {
  // Tag completion: <my-elem|
  const tagMatch = beforeText.match(/<([a-zA-Z0-9-]*)$/);
  if (tagMatch) {
    debug("autocomplete:trigger:tag", { partial: tagMatch[1] });
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
      lastChar !== "=" &&
      lastChar !== "}"
    ) {
      debug("autocomplete:trigger:bareTag", { partial: bareTagMatch[1] });
      addLintSnippets(completions);
      return getTagCompletions(completions, true);
    }
  }

  // Attribute value completion: <my-elem attr="| and with template-binding prefixes: .attr, :attr, [attr], ?attr
  const attrValueMatch = beforeText.match(ATTR_VALUE_REGEX);
  if (attrValueMatch) {
    const tagName = attrValueMatch[1];
    const attributeName = attrValueMatch[2];
    debug("autocomplete:trigger:attrValue", { tagName, attributeName });
    return getAttributeValueCompletions(completions, tagName, attributeName);
  }

  // Attribute name completion: <my-elem | and with template-binding prefixes: .| :| [| ?|
  const attrNameMatch = beforeText.match(ATTR_NAME_REGEX);
  if (attrNameMatch) {
    const tagName = attrNameMatch[1];
    const rawAttr = attrNameMatch[2] || "";
    const attrPrefix = getAttributePrefix(rawAttr);
    debug("autocomplete:trigger:attrName", {
      tagName,
      raw: rawAttr,
      prefix: attrPrefix,
    });
    return getAttributeCompletions(completions, tagName, attrPrefix);
  }

  // wctools directive completions inside HTML comments, e.g.
  // <!-- wctools-ignore | --> or <!-- wctools-ignore unknownAttribute,| -->
  const wctoolsCommentMatch = beforeText.match(
    /<!--\s*wctools-(ignore|ignore-next-line)(?:\s+([a-zA-Z0-9_,\-\s]*)?)?$/
  );
  if (wctoolsCommentMatch) {
    debug("autocomplete:trigger:directiveComment", {
      directive: wctoolsCommentMatch[1],
    });
    return addLintRuleCompletions(completions);
  }

  return null;
}

function addLintSnippets(completions: html.CompletionList) {
  // Offer full-comment snippets first so users can quickly insert an ignore directive
  const directives = [
    {
      name: "wctools-ignore",
      snippet: "<!-- wctools-ignore ${1} -->",
      detail: "Ignore rule(s) for this file",
    },
    {
      name: "wctools-ignore-next-line",
      snippet: "<!-- wctools-ignore-next-line ${1} -->",
      detail: "Ignore rule(s) for the next line",
    },
  ];

  const directiveCompletions: html.CompletionItem[] = directives.map((d) => ({
    label: d.name,
    kind: html.CompletionItemKind.Snippet,
    detail: d.detail,
    insertText: d.snippet,
    insertTextFormat: html.InsertTextFormat.Snippet,
    sortText: "0" + d.name,
  }));

  completions.items.push(...directiveCompletions);
}

function addLintRuleCompletions(completions: html.CompletionList) {
  const rules = [
    { name: "unknownElement", description: "Element is not defined in CEM" },
    { name: "deprecatedElement", description: "Element is deprecated" },
    {
      name: "duplicateAttribute",
      description: "Duplicate attribute on element",
    },
    {
      name: "invalidBoolean",
      description: "Boolean attribute should not have a value",
    },
    {
      name: "invalidNumber",
      description: "Attribute value must be a number",
    },
    {
      name: "invalidAttributeValue",
      description: "Attribute value is not one of the allowed enum values",
    },
    { name: "deprecatedAttribute", description: "Attribute is deprecated" },
    {
      name: "unknownAttribute",
      description: "Attribute not defined in CEM for this element",
    },
  ];

  const commentCompletions: html.CompletionItem[] = rules.map((r) => ({
    label: r.name,
    kind: html.CompletionItemKind.Text,
    detail: r.description,
    insertText: r.name,
  }));

  completions.items.push(...commentCompletions);
  return {
    isIncomplete: false,
    items: commentCompletions,
  };
}

function getTagCompletions(
  htmlCompletions: html.CompletionList,
  includeOpeningBrackets: boolean = false
): html.CompletionList {
  const customElements = customElementsService.getCustomElements();
  debug("autocomplete:build:tagCompletions", customElements.length);

  const customCompletions: html.CompletionItem[] = customElements.map(
    (element) => {
      const formattedTagName = configurationService.getFormattedTagName(
        element.tagName!,
        element.dependency as string
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
    }
  );

  htmlCompletions.items.push(...customCompletions);
  return htmlCompletions;
}

function getAttributeCompletions(
  htmlCompletions: html.CompletionList,
  tagName: string,
  attrPrefix?: BindingPrefix
): html.CompletionList {
  const element = customElementsService.getCustomElement(tagName);
  if (!element) {
    debug("autocomplete:attr:noElement", { tagName });
    return htmlCompletions;
  }

  let attributes = getAttributeInfo(tagName);
  const originalCount = attributes.length;
  if (attrPrefix === "?") {
    attributes = attributes.filter((a) => a.type === "boolean");
    debug("autocomplete:attr:booleanFilter", {
      tagName,
      before: originalCount,
      after: attributes.length,
    });
  } else {
    debug("autocomplete:attr:list", {
      tagName,
      count: attributes.length,
      prefix: attrPrefix,
    });
  }

  const customCompletions: Array<html.CompletionItem | undefined> = attributes
    .map((attr) => {
      if (!attr.name) {
        return undefined;
      }
      const hasValues = attr.options && attr.options.length > 0;
      const isBoolean = attr.type === "boolean";
      const nameWithPrefix = !attrPrefix
        ? attr.name
        : attrPrefix === "["
          ? `[${attr.name}]`
          : `${attrPrefix}${attr.name}`;
      const filterWithPrefix = attrPrefix
        ? `${attrPrefix}${attr.name}`
        : attr.name;
      const insertBaseName = attrPrefix === "[" ? `${attr.name}]` : attr.name;

      return {
        label: nameWithPrefix,
        kind: html.CompletionItemKind.Property,
        documentation: {
          kind: html.MarkupKind.Markdown,
          value: `${attr.description}\n\n**Type:** \`${attr.type}\``,
        },
        insertText:
          hasValues || attrPrefix
            ? `${insertBaseName}="$1"$0`
            : isBoolean
              ? insertBaseName
              : `${insertBaseName}="$0"`,
        insertTextFormat: html.InsertTextFormat.Snippet,
        sortText: "0" + attr.name,
        filterText: filterWithPrefix,
        command:
          hasValues || !isBoolean || attrPrefix !== "?"
            ? { command: "editor.action.triggerSuggest", title: "Suggest" }
            : undefined,
        deprecated: !!attr.deprecated,
      };
    })
    .filter(Boolean);

  htmlCompletions.items.push(...customCompletions as html.CompletionItem[]);
  debug("autocomplete:attr:added", {
    tagName,
    added: customCompletions.length,
  });
  return htmlCompletions;
}

function getAttributeValueCompletions(
  htmlCompletions: html.CompletionList,
  tagName: string,
  attributeName: string
): html.CompletionList {
  const attributes = getAttributeInfo(tagName);
  const baseName = getBaseAttributeName(attributeName);
  const attribute = attributes.find((attr) => attr.name === baseName);

  if (!attribute?.options?.length) {
    debug("autocomplete:attrValue:none", { tagName, attribute: baseName });
    return htmlCompletions;
  }
  debug("autocomplete:attrValue:options", {
    tagName,
    attribute: baseName,
    values: attribute.options,
  });

  const customCompletions: html.CompletionItem[] = attribute?.options.map(
    (value) => ({
      label: value,
      kind: html.CompletionItemKind.Value,
      documentation: {
        kind: "markdown",
        value: `Value for ${baseName} attribute`,
      },
      insertText: value,
      sortText: "0" + value,
    })
  );

  htmlCompletions.items.push(...customCompletions);
  return htmlCompletions;
}

function getAttributeInfo(tagName: string): AttributeInfo[] {
  return Array.from(customElementsService.attributeData?.entries())
    .filter(([key]) => key.startsWith(`${tagName}:`))
    .map(([, value]) => value);
}
