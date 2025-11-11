// import { manifestService } from "../../services/manifest-service.js";
// import { Component } from "@wc-toolkit/cem-utilities";
import * as css from "vscode-css-languageservice";
import { debug } from "../../utilities/logger.js";
import { autocompleteService } from "../../services/autocomplete-service.js";

export function getCssAutoCompleteSuggestions(
  document: css.TextDocument,
  position: css.Position
): css.CompletionList {
  debug("css:autocomplete:getSuggestions:start", {
    uri: document.uri,
    line: position.line,
    character: position.character,
  });

  const text = document.getText();
  const offset = document.offsetAt(position);
  const beforeText = text.substring(0, offset);

  debug("css:autocomplete:context", {
    beforeText: beforeText.slice(-50), // Log last 50 chars
    offset,
  });

  const cssLanguageService = css.getCSSLanguageService();

  const textDocument = css.TextDocument.create(
    document.uri,
    "css",
    0,
    document.getText()
  );
  const stylesheet = cssLanguageService.parseStylesheet(textDocument);

  // Get default CSS completions
  const result = cssLanguageService.doComplete(
    textDocument,
    position,
    stylesheet
  );

  // Add custom completions for web components
  const customCompletions = getCompletions(result);

  return customCompletions;
}

function getCompletions(completions: css.CompletionList) {
  completions.items.push(...autocompleteService.getCssCompletions());

  return completions;
}
