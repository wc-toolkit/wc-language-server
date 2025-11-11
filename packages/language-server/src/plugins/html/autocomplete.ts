import * as html from "vscode-html-languageservice";
import {
  ATTR_NAME_REGEX,
  ATTR_VALUE_REGEX,
  BindingPrefix,
  getAttributePrefix,
} from "./utilities.js";
import { debug } from "../../utilities/logger.js";
import { autocompleteService } from "../../services/autocomplete-service.js";

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

  // Only return custom web component completions
  // Volar's built-in HTML service will handle standard HTML completions
  const customCompletions = getCompletions(beforeText);

  return customCompletions;
}

function getCompletions(
  beforeText: string
): html.CompletionList | null {
  const completions: html.CompletionList = {
    isIncomplete: false,
    items: [],
  };

  // Tag completion: <my-elem|
  const tagMatch = beforeText.match(/<([a-zA-Z0-9-]*)$/);
  if (tagMatch) {
    debug("autocomplete:trigger:tag", { partial: tagMatch[1] });
    return getTagCompletions();
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
      const tagCompletions = getTagCompletions(true);
      completions.items.push(...tagCompletions.items);
      return completions;
    }
  }

  // Attribute value completion: <my-elem attr="| and with template-binding prefixes: .attr, :attr, [attr], ?attr
  const attrValueMatch = beforeText.match(ATTR_VALUE_REGEX);
  if (attrValueMatch) {
    const tagName = attrValueMatch[1];
    const attributeName = attrValueMatch[2];
    debug("autocomplete:trigger:attrValue", { tagName, attributeName });
    return getAttributeValueCompletions(tagName, attributeName);
  }

  // Attribute name completion: <my-elem | and with template-binding prefixes: .| :| [| ?| @|
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
    return getAttributeCompletions(
      tagName,
      attrPrefix,
      beforeText
    );
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
  includeOpeningBrackets: boolean = false
): html.CompletionList {
  const customCompletions = autocompleteService.getTagCompletions(
    includeOpeningBrackets
  );
  return {
    isIncomplete: false,
    items: customCompletions,
  };
}

function getAttributeCompletions(
  tagName: string,
  attrPrefix?: BindingPrefix,
  beforeText?: string
): html.CompletionList {
  const items = autocompleteService.getAttributeCompletions(
    tagName,
    attrPrefix,
    beforeText
  );

  return {
    isIncomplete: false,
    items: items,
  };
}

function getAttributeValueCompletions(
  tagName: string,
  attributeName: string
): html.CompletionList {
  const attrValueCompletions = autocompleteService.getAttributeValueCompletions(
    tagName,
    attributeName
  );

  return {
    isIncomplete: false,
    items: attrValueCompletions,
  };
}
