// import { manifestService } from "../../services/manifest-service.js";
// import { Component } from "@wc-toolkit/cem-utilities";
import * as css from "vscode-css-languageservice";
// import { getCSSLanguageService } from "vscode-css-languageservice";
import { debug } from "../../utilities/logger.js";
import { autocompleteService } from "../../services/autocomplete-service.js";

export function getCssAutoCompleteSuggestions(
  document: css.TextDocument,
  position: css.Position
): css.CompletionItem[] | null {
  debug("css:autocomplete:getSuggestions:start", {
    uri: document.uri,
    line: position.line,
    character: position.character,
  });

  // return autocompleteService.getCssCompletions();


  const text = document.getText();
  const offset = document.offsetAt(position);
  const beforeText = text.substring(0, offset);

  if (isInStyleAttribute(beforeText)) {
    return autocompleteService.getCssVariableCompletions();
  }

  return isCssContext(document, position)
    ? autocompleteService.getCssCompletions()
    : null;
}

// --- CSS context detection helper ---
function isCssContext(
  document: css.TextDocument,
  position: css.Position
): boolean {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const beforeText = text.substring(0, offset);

  // Inside CSS attribute value: <div style="|">
  if (isInStyleAttribute(beforeText)) {
    console.log("isInStyleAttribute true for", document.uri);
    return true;
  }

  // Inside <style> tag (very basic, not perfect)
  if (isInStyleTag(beforeText)) {
    console.log("isInStyleTag true for", document.uri);
    return true;
  }

  // Inside css tag template literal: css`...|...`
  if (isInCssTemplateLiteral(beforeText)) {
    console.log("isInCssTemplateLiteral true for", document.uri);
    return true;
  }

  // if(isStyleFile(document.uri)) {
  //   return true;
  // }

  // Inside CSS file based on languageId
  if (isStyleLanguage(document.languageId)) {
    console.log("isStyleLanguage true for", document.uri);
    return true;
  }

  // Could add more advanced checks here
  return false;
}

/**
 * Checks if the current position is inside a CSS attribute value -- e.g., <div style="|">
 * @param beforeText
 * @returns boolean indicating if inside a CSS attribute value
 */
export function isInStyleAttribute(beforeText: string): boolean {
  const attrMatch = beforeText.match(/style\s*=\s*['"][^'"]*$/i);
  return !!attrMatch;
}

/**
 * Checks if the current position is inside a <style> tag
 * @param beforeText
 * @returns boolean indicating if inside a <style> tag
 */
export function isInStyleTag(beforeText: string): boolean {
  const styleOpen = beforeText.lastIndexOf("<style");
  const styleClose = beforeText.lastIndexOf("</style>");
  return styleOpen > styleClose;
}

/**
 * Checks if the current position is inside a css`...` template literal
 * @param beforeText
 * @returns boolean indicating if inside a css template literal
 */
export function isInCssTemplateLiteral(beforeText: string): boolean {
  // Inside css tag template literal: css`...|...`
  // Looks for the nearest backtick and checks if it's preceded by 'css'
  const lastBacktick = beforeText.lastIndexOf("`");
  if (lastBacktick !== -1) {
    const beforeBacktick = beforeText.slice(0, lastBacktick);
    if (/css\s*`\s*$/m.test(beforeBacktick)) {
      return true;
    }
  }
  return false;
}

export function isStyleLanguage(languageId: string): boolean {
  console.log("Checking isStyleLanguage for", languageId);
  return ["css", "scss", "sass", "less", "stylus"].includes(languageId);
}

export function isStyleFile(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) {
    return false;
  }
  return ["css", "scss", "sass", "less", "stylus"].includes(extension);
}
