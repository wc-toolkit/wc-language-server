
// wc.config.js

export default {
  /** Files to include in the language server */
  include: ['src/**/*', '**/*.html', '**/*.js', '**/*.md'],

  /** Files to exclude from the language server */
  exclude: ['**/*.json'],

  /** Formats all tag names */
  tagFormatter: (tag) => `${tag}-global`,
  diagnosticSeverity: {
    /** Globally set diagnostic severity */
    deprecatedElement: 'error'
  },
  libraries: {
    "@awesome.me/webawesome": {
      /**
       * Fetch manifest from a URL
       * This isn't needed if you have the NPM package installed
       */
      manifestSrc:
        "https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@3.0.0-beta.4/dist/custom-elements.json",

      /**
       * Replace `wa-` prefix with `awesome-` for all Web Awesome components
       * Language server options will now work for `awesome-button` instead of `wa-button`
       */
      tagFormatter: (tagName) => tagName.replace("wa-", "awesome-"),

      diagnosticSeverity: {
        /** Deprecated attributes will now all show as an error for Web Awesome components */
        duplicateAttribute: "warning",
      },
    },
  },
};



