// import { manifestService } from "../../services/manifest-service.js";
// import { Component } from "@wc-toolkit/cem-utilities";
import * as css from "vscode-css-languageservice";
import { debug } from "../../utilities/logger.js";
import { autocompleteService, ExtendedCssCompletionItem } from "../../services/autocomplete-service.js";

export function getCssAutoCompleteSuggestions(
  document: css.TextDocument,
  position: css.Position
): ExtendedCssCompletionItem[] | null {
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

  // Only return custom web component completions
  // Volar's built-in CSS service will handle standard CSS completions

  return autocompleteService.getCssCompletions();
}
