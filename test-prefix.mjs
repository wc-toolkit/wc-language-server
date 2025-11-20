const BINDING_PREFIX_CLASS = "[.:?@\\[\\(]";
const TYPED_PREFIX_REGEX = new RegExp(`^${BINDING_PREFIX_CLASS}`);

function getAttributePrefix(rawAttr) {
  return (rawAttr.match(TYPED_PREFIX_REGEX)?.[0]) ?? undefined;
}

console.log('Testing getAttributePrefix:');
console.log('"":', getAttributePrefix(""));
console.log('"attr":', getAttributePrefix("attr"));
console.log('".prop":', getAttributePrefix(".prop"));
console.log('"?bool":', getAttributePrefix("?bool"));
console.log('"@event":', getAttributePrefix("@event"));
