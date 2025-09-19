/** @type {import('@wc-toolkit/wctools').WCConfig} */
module.exports = {
  "manifestSrc": "custom-elements.json",
  "include": [
    "**/*.html",
    "src/**/*.js",
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules/**",
    "dist/**",
    "build/**"
  ],
  "typeSrc": "parsedType",
  "diagnosticSeverity": {
    "invalidBoolean": "error",
    "invalidNumber": "error",
    "invalidAttributeValue": "error",
    "deprecatedAttribute": "warning",
    "deprecatedElement": "warning",
    "duplicateAttribute": "error",
    "unknownElement": "hint",
    "unknownAttribute": "hint"
  }
};
