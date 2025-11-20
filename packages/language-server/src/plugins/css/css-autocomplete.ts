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
  // Count backticks to determine if we're inside a template literal
  let backtickCount = 0;
  let lastCssPosition = -1;
  
  // Find all backticks and the last 'css' keyword
  for (let i = 0; i < beforeText.length; i++) {
    if (beforeText[i] === "`") {
      backtickCount++;
    }
    // Check for 'css' keyword followed by whitespace/backtick
    if (i >= 2 && beforeText.substring(i - 2, i + 1) === "css") {
      const nextChar = beforeText[i + 1];
      if (!nextChar || /\s/.test(nextChar) || nextChar === "`") {
        lastCssPosition = i + 1;
      }
    }
  }
  
  // If odd number of backticks and we found a 'css' keyword, check if it's recent
  if (backtickCount % 2 === 1 && lastCssPosition !== -1) {
    // Check if there's a 'css' keyword right before the last unclosed backtick
    const textAfterCss = beforeText.slice(lastCssPosition);
    const backtickAfterCss = textAfterCss.indexOf("`");
    
    // If the backtick right after 'css' is the last unclosed one, we're inside
    if (backtickAfterCss !== -1) {
      const remainingText = textAfterCss.slice(backtickAfterCss + 1);
      const hasAnotherBacktick = remainingText.includes("`");
      return !hasAnotherBacktick;
    }
  }
  
  return false;
}

export function isStyleLanguage(languageId: string): boolean {
  return ["css", "scss", "sass", "less", "stylus"].includes(languageId);
}

export function isStyleFile(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) {
    return false;
  }
  return ["css", "scss", "sass", "less", "stylus"].includes(extension);
}
