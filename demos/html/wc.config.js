/** @type {import('@wc-toolkit/wctools').WCConfig} */
export default {
  "manifestSrc": "custom-elements.json",
  // "include": [
  //   "src/**/*.html",
  //   "src/**/*.js",
  //   "src/**/*.ts"
  // ],
  "exclude": [
    "node_modules/**",
    "dist/**",
    "build/**"
  ],
  "frameworks": ['lit'],
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
