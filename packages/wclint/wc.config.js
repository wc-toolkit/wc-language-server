/** @type {import('@wc-toolkit/language-server').WCConfig} */
export default {
  manifestSrc: "custom-elements.json",
  include: ["src/**/*.html", "src/**/*.js", "src/**/*.ts"],
  exclude: ["node_modules/**", "dist/**", "build/**"],
  diagnosticSeverity: {
    unknownElement: "warning",
    unknownAttribute: "warning",
    deprecatedElement: "warning",
    deprecatedAttribute: "warning",
  },
};
