/** @type {import('@wc-toolkit/wctools').WCConfig} */
export default {
  // "manifestSrc": "custom-elements.json",
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
  },
  "debug": false,
    /** Library specific configurations */
  libraries: {
    /** Custom configuration for Web Awesome components */
    "@awesome.me/webawesome": {
      /**
       * Fetch manifest from a URL
       * This isn't needed if you have the NPM package installed
       */
      manifestSrc: 'https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@3.0.0-beta.4/dist/custom-elements.json',

      /**
       * Replace `wa-` prefix with `awesome-` for all Web Awesome components
       * Language server options will now work for `awesome-button` instead of `wa-button`
       */
    //   tagFormatter: (tagName) => tagName.replace('wa-', 'awesome-'),

    //     diagnosticSeverity: {
    //       /** Deprecated attributes will now all show as an error for Web Awesome components */
    //       duplicateAttribute: 'warning'
    //     }
    // }
    }
  }
};
