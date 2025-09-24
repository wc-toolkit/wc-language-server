import test from "node:test";
import assert from "assert";
import { isDiagnosticIgnored } from "../dist/plugins/html/validation.js";

// Mock document interface
function createMockDocument(text) {
  const lines = text.split("\n");
  return {
    getText: () => text,
    positionAt: (offset) => {
      let line = 0;
      let character = 0;
      let currentOffset = 0;

      for (let i = 0; i < lines.length; i++) {
        if (currentOffset + lines[i].length >= offset) {
          character = offset - currentOffset;
          line = i;
          break;
        }
        currentOffset += lines[i].length + 1; // +1 for newline
      }

      return { line, character };
    },
  };
}

test("disable-next-line should work with multi-line elements", () => {
  const htmlContent = `
    <!-- wctools-ignore-next-line invalidAttributeValue -->
    <sl-alert 
      variant="primaryee" 
      closable="true" 
      dep-attr 
      closable
    ></sl-alert>
  `.trim();

  const document = createMockDocument(htmlContent);

  // The sl-alert tag starts on line 1 (0-indexed)
  const range = {
    start: { line: 1, character: 4 }, // Start of <sl-alert
    end: { line: 1, character: 13 }, // End of sl-alert
  };

  // Test that the invalidAttributeValue rule is ignored for this range
  const isIgnored = isDiagnosticIgnored(
    document,
    "invalidAttributeValue",
    range,
  );
  assert.strictEqual(
    isIgnored,
    true,
    "disable-next-line should ignore invalidAttributeValue on multi-line element",
  );
});

test("disable-next-line should work with attributes on different lines", () => {
  const htmlContent = `
    <!-- wctools-ignore-next-line invalidAttributeValue -->
    <sl-alert 
      variant="primaryee" 
      closable="true"
    ></sl-alert>
  `.trim();

  const document = createMockDocument(htmlContent);

  // The variant attribute is on line 2
  const range = {
    start: { line: 2, character: 6 }, // Start of variant attribute
    end: { line: 2, character: 13 }, // End of variant
  };

  // Now with the updated logic, this should be ignored since the directive
  // applies to all lines of the element's opening tag
  const isIgnored = isDiagnosticIgnored(
    document,
    "invalidAttributeValue",
    range,
  );
  assert.strictEqual(
    isIgnored,
    true,
    "disable-next-line should ignore invalidAttributeValue on attribute lines within the element",
  );
});
