export type BindingPrefix = typeof BINDING_CHARACTERS[number] | undefined;

export const BINDING_CHARACTERS: string[] = [".", ":", "[", "?"] as const;

// Trim leading/trailing special characters used by template syntaxes (e.g., .prop, @event, ?bool, [attr])
export function trimAttributeSpecials(name: string): string {
  return name.replace(/^[.@?:[]+/, "").replace(/[.@?:\]]+$/, "");
}

// Shared regex building blocks for template-binding prefixes and contexts
export const BINDING_PREFIX_CLASS = "[.:?\\[]";
export const TYPED_PREFIX_REGEX = new RegExp(`^${BINDING_PREFIX_CLASS}`);
export const TRAILING_BINDING_BRACKET_REGEX = /\]$/;
export const ATTR_VALUE_REGEX = new RegExp(
  `<([a-zA-Z0-9-]+)(?:\\s+[^>]*?)?\\s+(${BINDING_PREFIX_CLASS}?[a-zA-Z0-9-]+]?)=["']?([^"']*)$`,
);
export const ATTR_NAME_REGEX = new RegExp(
  `<([a-zA-Z0-9-]+)(?:\\s+[^>]*?)?\\s+(${BINDING_PREFIX_CLASS}?[a-zA-Z0-9-]*)$`,
);

export function getAttributePrefix(rawAttr: string): BindingPrefix | undefined {
  return (rawAttr.match(TYPED_PREFIX_REGEX)?.[0] as BindingPrefix) ?? undefined;
}

export function getBaseAttributeName(attr: string): string {
  const typed = getAttributePrefix(attr);
  let normalizedName = attr.replace(TYPED_PREFIX_REGEX, "");
  if (typed === "[") {
    normalizedName = normalizedName.replace(TRAILING_BINDING_BRACKET_REGEX, "");
  }
  return normalizedName;
}
