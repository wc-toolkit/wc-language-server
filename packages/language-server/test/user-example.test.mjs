/* eslint-disable no-undef */
import test from "node:test";
import assert from "assert";
import { isDiagnosticIgnored } from "../dist/plugins/html/validation.js";

// Mock document interface
function createMockDocument(text) {
  const lines = text.split('\n');
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
    }
  };
}

test("disable-next-line should ignore variant attribute in user's example", () => {
  const htmlContent = `    <!-- wctools-disable-next-line invalidAttributeValue -->
    <sl-alert 
      variant="primaryee" 
      closable="true" 
      dep-attr 
      closable
    ></sl-alert>`;

  const document = createMockDocument(htmlContent);
  
  // The variant attribute is on line 2, around character 6
  const variantRange = {
    start: { line: 2, character: 6 }, 
    end: { line: 2, character: 13 }   
  };
  
  // Test that the invalidAttributeValue rule is ignored for the variant attribute
  const isIgnored = isDiagnosticIgnored(document, "invalidAttributeValue", variantRange);
  assert.strictEqual(isIgnored, true, "disable-next-line should ignore invalidAttributeValue on variant attribute");
  
  console.log("✅ User's example works correctly - disable-next-line ignores variant attribute");
});
