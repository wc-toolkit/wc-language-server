// Test the attribute regex patterns

const BINDING_PREFIX_CLASS = "[.:?@\\[\\(]";
const ATTR_NAME_REGEX = new RegExp(
  `<([a-zA-Z0-9_.-]+)(?:\\s+[^>]*?)?\\s+(${BINDING_PREFIX_CLASS}?[a-zA-Z0-9_-]*)$`,
);

// Test cases
const testCases = [
  '<my-element ',
  '<my-element a',
  '<my-element attr',
  '<my-element some-attr="value" ',
  '<my-element some-attr="value" an',
  '<my-element some-attr="value" another',
  '<my-element .prop',
  '<my-element :bind',
  '<my-element [attr]',
  '<my-element ?bool',
  '<my-element @event',
];

console.log('Testing ATTR_NAME_REGEX:\n');
testCases.forEach(test => {
  const match = test.match(ATTR_NAME_REGEX);
  console.log(`Input: "${test}"`);
  if (match) {
    console.log(`  ✓ Match: tagName="${match[1]}", attrName="${match[2]}"`);
  } else {
    console.log(`  ✗ No match`);
  }
  console.log();
});
