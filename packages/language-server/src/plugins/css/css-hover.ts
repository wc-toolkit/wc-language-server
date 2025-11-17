import * as css from "vscode-css-languageservice";
import { NullableProviderResult } from "@volar/language-server";
import { ComponentMetadata, componentService } from "../../services/component-service.js";

export function getCssHoverContent(
  document: css.TextDocument,
  position: css.Position
): NullableProviderResult<css.Hover> {
  const text = document.getText();
  const offset = document.offsetAt(position);

  // Find the word at the current position
  const wordRange = getWordRangeAtPosition(text, offset);
  if (!wordRange) return null;

  const word = text.substring(wordRange.start, wordRange.end);

  // Check for custom CSS properties (--property-name)
  if (word.startsWith("--")) {
    const property = componentService.getCssVariableCache(word);
    if (property) {
      const description = getDescription(property);
      return {
        contents: {
          kind: "markdown",
          value: description,
        },
        range: {
          start: document.positionAt(wordRange.start),
          end: document.positionAt(wordRange.end),
        },
      };
    }
  }

  // Check for ::part() selectors
  const partMatch = text
    .substring(Math.max(0, offset - 50), Math.min(text.length, offset + 50))
    .match(/::part\(([^)]+)\)/);

  if (partMatch && isPositionInRange(offset, wordRange, partMatch[1])) {
    const partName = partMatch[1].trim();
    const customPart = componentService.getCssPartCache(partName);
    if (customPart) {
      const description = getDescription(customPart);
      return {
        contents: {
          kind: "markdown",
          value: description,
        },
        range: {
          start: document.positionAt(wordRange.start),
          end: document.positionAt(wordRange.end),
        },
      };
    }
  }

  // Check for :state() selectors
  const stateMatch = text
    .substring(Math.max(0, offset - 50), Math.min(text.length, offset + 50))
    .match(/:state\(([^)]+)\)/);

  if (stateMatch && isPositionInRange(offset, wordRange, stateMatch[1])) {
    const stateName = stateMatch[1].trim();
    const customState = componentService.getCssStateCache(stateName);
    if (customState) {
      const description = getDescription(customState);
      return {
        contents: {
          kind: "markdown",
          value: description,
        },
        range: {
          start: document.positionAt(wordRange.start),
          end: document.positionAt(wordRange.end),
        },
      };
    }
  }

  return null;
}

function isPositionInRange(
  offset: number,
  wordRange: { start: number; end: number },
  matchText: string
): boolean {
  // Simple check if the cursor is within the matched text
  return wordRange.start >= 0 && wordRange.end <= offset + matchText.length;
}

function getWordRangeAtPosition(
  text: string,
  offset: number
): { start: number; end: number } | null {
  // Match CSS custom properties, identifiers, and words
  const before = text.substring(0, offset);
  const after = text.substring(offset);

  const beforeMatch = before.match(/(--[\w-]+|[\w-]+)$/);
  const afterMatch = after.match(/^([\w-]*)/);

  if (!beforeMatch) return null;

  const start = offset - beforeMatch[0].length;
  const end = offset + (afterMatch ? afterMatch[0].length : 0);

  return { start, end };
}

function getDescription(completion: ComponentMetadata) {
  let attrContent = `${completion.description}\n\n**Type:** \`${completion.detail}\``;

  if (completion.deprecated) {
    const attrDeprecationMessage =
      typeof completion.deprecated === "string"
        ? completion.deprecated
        : "This attribute is deprecated.";
    attrContent = `⚠️ **Deprecated:** ${attrDeprecationMessage}\n\n${attrContent}`;
  }

  return attrContent;
}
