import test from "node:test";
import assert from "node:assert/strict";

import { isDiagnosticIgnored } from "../dist/plugins/html/validation.js";

function createDoc(text) {
  return {
    uri: "file://test.html",
    languageId: "html",
    version: 1,
    lineCount: text.split("\n").length,
    getText() {
      return text;
    },
    positionAt(offset) {
      const lines = text.slice(0, offset).split("\n");
      return {
        line: lines.length - 1,
        character: lines[lines.length - 1].length,
      };
    },
    offsetAt(pos) {
      const lines = text.split("\n");
      let off = 0;
      for (let i = 0; i < pos.line; i++) off += lines[i].length + 1;
      return off + pos.character;
    },
  };
}

// Simple test
test("isDiagnosticIgnored - basic", () => {
  const text =
    "<!-- wctools-disable unknownAttribute -->\n<my-element foo></my-element>";
  const doc = createDoc(text);
  const range = {
    start: { line: 1, character: 0 },
    end: { line: 1, character: 5 },
  };
  assert.ok(isDiagnosticIgnored(doc, "unknownAttribute", range));
});
