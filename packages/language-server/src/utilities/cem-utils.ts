/* eslint-disable @typescript-eslint/no-explicit-any */
import type * as cem from "custom-elements-manifest/schema.js";
import { removeQuotes } from "@wc-toolkit/cem-utilities";

export const EXCLUDED_TYPES = [
  "any",
  "bigint",
  "boolean",
  "never",
  "null",
  "number",
  "string",
  "Symbol",
  "undefined",
  "unknown",
  "object",
  "void",
  "Function",
  "Date",
  "Array",
  "RegExp",
  "Error",
  "Promise",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "ArrayBuffer",
  "DataView",
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
];

/**
 * Extracts attribute value options from a CEM attribute definition.
 * Returns primitive type names for simple types or arrays of literal values for union types.
 * @param attr - CEM attribute object
 * @param typeSrc - Property name of the type source (defaults to "parsedType")
 * @returns Primitive type name or array of literal values
 */
export function parseAttributeValueOptions(
  attr: cem.Attribute,
  typeSrc: string = "parsedType",
): string[] | string {
  const value: string = (attr as any)[`${typeSrc}`]?.text || attr.type?.text;

  // Handle primitive types
  if (value === "boolean" || value === "string" || value === "number") {
    return value;
  }

  const GENERIC_CHECK = /\b[A-Za-z_]\w*\s*<[^<>]*?>/g;

  if(value?.match(GENERIC_CHECK)) {
    return "string";
  }

  // Handle non-union types
  if (!value?.includes("|")) {
    return "string";
  }

  // Handle union types
  const splitValues = value.split("|").map((v) => v.trim());

  // Check for intersection type patterns like (number & {}) or (string & {})
  // These indicate "accept this primitive type but suggest specific literals"
  const intersectionMatch = splitValues.find((type) =>
    /^\((?:number|string)\s*&\s*\{\s*\}\)$/.test(type)
  );

  if (intersectionMatch) {
    // Extract the base type from intersection (e.g., "number" from "(number & {})")
    const baseType = intersectionMatch.match(/^\((\w+)\s*&/)?.[1];
    
    if (baseType === "number" || baseType === "string") {
      // If there are literals, return them (validation will also accept the base type)
      const literalValues = splitValues
        .filter((type) => 
          !EXCLUDED_TYPES.includes(type) && 
          !/^\((?:number|string)\s*&\s*\{\s*\}\)$/.test(type)
        )
        .map((type) => removeQuotes(type))
        .filter(Boolean);

      // Return literals if present, otherwise return the base type
      // The presence of intersection means validation should be lenient
      return literalValues.length ? literalValues : baseType;
    }
  }

  // If union contains boolean or string, return that primitive type
  if (splitValues.includes("boolean")) {
    return "boolean";
  }

  if (splitValues.includes("string")) {
    return "string";
  }

  if (splitValues.includes("number")) {
    return "number";
  }

  // Extract literal values (excluding JS primitives)
  const literalValues = splitValues
    .filter((type) => !EXCLUDED_TYPES.includes(type))
    .map((type) => removeQuotes(type))
    .filter(Boolean);

  return literalValues.length ? literalValues : "string";
}
