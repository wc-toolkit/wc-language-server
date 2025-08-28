/** @type {import('@wc-toolkit/language-server').WCConfig} */
export default {
  manifestSrc: "./custom-elements.json",
  include: [
    "*.html",
    "**/*.html",
    "**/*.md",
    "**/*.ts"
  ],
  exclude: [
    "node_modules/**"
  ],
  diagnosticSeverity: {
    unknownElement: "hint",
    unknownAttribute: "warning",
    deprecatedElement: "warning", 
    deprecatedAttribute: "warning",
    invalidBoolean: "error",
    invalidNumber: "error",
    invalidAttributeValue: "error",
    duplicateAttribute: "error"
  }
};
