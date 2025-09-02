import * as html from "vscode-html-languageservice";
import { customElementsService } from "../../services/custom-elements-service.js";
import { getComponentDetailsTemplate } from "@wc-toolkit/cem-utilities";
import { Hover, NullableProviderResult } from "@volar/language-server";

export function getHoverContent(
  document: html.TextDocument,
  position: html.Position,
): NullableProviderResult<Hover> {
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
  const element = customElementsService.getCustomElement(node.tag || "");

  // Check for custom elements
  if (!node?.tag || !element) {
    // Return null for non-custom elements - let other services handle them
    return null;
  }

  let hoverContent = getComponentDetailsTemplate(element);

  // Add deprecation warning for element
  if (element.deprecated) {
    const deprecationMessage =
      typeof element.deprecated === "string"
        ? element.deprecated
        : "This element is deprecated.";
    hoverContent = `⚠️ **Deprecated:** ${deprecationMessage}\n\n${hoverContent}`;
  }

  // Check if hovering over a specific attribute
  if (node.attributes) {
    const cursorOffset = document.offsetAt(position);

    for (const attrName in node.attributes) {
      const attrValue = node.attributes[attrName];
      const tagOffset = node.start;
      const tagText = document.getText().slice(tagOffset, node.end);
      const attrStart = tagText.indexOf(attrName);
      const attrEnd = attrStart + attrName.length + (attrValue?.length || 0);

      if (
        cursorOffset >= tagOffset + attrStart &&
        cursorOffset <= tagOffset + attrEnd
      ) {
        const attribute = customElementsService.getAttributeInfo(
          node.tag,
          attrName,
        );

        if (!attribute) {
          return null;
        }

        let attrContent = `${attribute.description}\n\n**Type:** \`${attribute.type}\``;

        if (attribute.deprecated) {
          const attrDeprecationMessage =
            typeof attribute.deprecated === "string"
              ? attribute.deprecated
              : "This attribute is deprecated.";
          attrContent = `⚠️ **Deprecated:** ${attrDeprecationMessage}\n\n${attrContent}`;
        }

        return {
          contents: {
            kind: "markdown",
            value: attrContent,
          },
        };
      }
    }
  }

  return {
    contents: {
      kind: "markdown",
      value: hoverContent,
    },
  };
}
