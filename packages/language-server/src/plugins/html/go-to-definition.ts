import { customElementsService } from "../../services/custom-elements-service.js";
import * as html from "vscode-html-languageservice";
import * as fs from "fs";
import * as path from "path";

export function getGoToDefinition(
  document: html.TextDocument,
  position: html.Position,
) {
  const textDocument = html.TextDocument.create(
    document.uri,
    "html",
    0,
    document.getText(),
  );

  const htmlLanguageService = html.getLanguageService();
  const htmlDocument = htmlLanguageService.parseHTMLDocument(textDocument);
  const offset = textDocument.offsetAt(position);
  const node = htmlDocument.findNodeAt(offset);

  if (!node?.tag || !customElementsService.hasCustomElement(node.tag)) {
    return null;
  }

  const manifestPath = customElementsService.getManifestPath();
  if (!manifestPath) {
    // silent
    return null;
  }

  // Check if the manifest file actually exists
  try {
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
  } catch {
    return null;
  }

  // Find position in manifest - look for the tag name definition
  const positionInManifest = customElementsService.findPositionInManifest(
    `"tagName": "${node.tag}"`,
  );

  // Create proper file URI - ensure it's an absolute path
  const manifestUri = manifestPath.startsWith("file://")
    ? manifestPath
    : `file://${path.resolve(manifestPath)}`;

  // Convert character position to line/character position
  const manifestRange = convertPositionToRange(
    manifestPath,
    positionInManifest,
  );

  return [
    {
      targetUri: manifestUri,
      targetRange: manifestRange,
      targetSelectionRange: manifestRange,
    },
  ];
}

/**
 * Converts a character position to a line/character range for the manifest file
 */
function convertPositionToRange(
  manifestPath: string,
  characterPosition: number,
): html.Range {
  try {
    const manifestContent = fs.readFileSync(manifestPath, "utf8");
    const lines = manifestContent.split("\n");

    let currentPosition = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineLength = lines[lineIndex].length + 1; // +1 for newline

      if (currentPosition + lineLength > characterPosition) {
        const characterInLine = characterPosition - currentPosition;
        return {
          start: { line: lineIndex, character: characterInLine },
          end: { line: lineIndex, character: characterInLine + 10 }, // Highlight ~10 characters
        };
      }

      currentPosition += lineLength;
    }

    // Fallback to first line if position not found
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    };
  } catch {
    // suppressed
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    };
  }
}
