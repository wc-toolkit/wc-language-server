import test from "node:test";
import assert from "node:assert/strict";

// Load the module under test
import {
  parseAttributesFromText,
  isDiagnosticIgnored,
} from "../dist/plugins/html/validation.js";

// Helper to create a fake document-like object
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

// Tests for parseAttributesFromText
test("parseAttributesFromText - quoted value with spaces", () => {
  const text =
    '<my-element placeholder="Enter your email" required></my-element>';
  const node = { tag: "my-element", start: 0, end: text.length };
  const attrs = parseAttributesFromText(text, node);
  assert.equal(attrs.length, 2);
  const ph = attrs.find((a) => a.name === "placeholder");
  assert(ph, "placeholder attribute found");
  assert.equal(ph.value, "Enter your email");
});

test("parseAttributesFromText - single and double quotes and unquoted", () => {
  const text = '<my-element a="1" b=' + "'two'" + " c=three></my-element>";
  const node = { tag: "my-element", start: 0, end: text.length };
  const attrs = parseAttributesFromText(text, node);
  const map = Object.fromEntries(attrs.map((a) => [a.name, a.value]));
  assert.equal(map.a, "1");
  assert.equal(map.b, "two");
  assert.equal(map.c, "three");
});

// Tests for isDiagnosticIgnored
// We'll construct small documents with wctools directives and a fake range

test("isDiagnosticIgnored - global disable specific rules (comma-separated)", () => {
  const text =
    "<!-- wctools-disable unknownAttribute,deprecatedAttribute -->\n<my-element foo></my-element>";
  const doc = createDoc(text);
  const range = {
    start: { line: 1, character: 0 },
    end: { line: 1, character: 5 },
  };
  assert.ok(isDiagnosticIgnored(doc, "unknownAttribute", range));
  assert.ok(isDiagnosticIgnored(doc, "deprecatedAttribute", range));
  assert.ok(!isDiagnosticIgnored(doc, "someOtherRule", range));
});

test("isDiagnosticIgnored - disable-next-line", () => {
  const text =
    "<!-- wctools-disable-next-line deprecatedAttribute -->\n<my-element bar></my-element>";
  const doc = createDoc(text);
  const r2 = {
    start: { line: 1, character: 0 },
    end: { line: 1, character: 5 },
  };
  assert.ok(isDiagnosticIgnored(doc, "deprecatedAttribute", r2));
  assert.ok(!isDiagnosticIgnored(doc, "unknownAttribute", r2));
});
