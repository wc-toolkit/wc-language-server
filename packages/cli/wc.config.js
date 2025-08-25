export default {
  include: ['**/*.html', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  exclude: ['**/*.json', 'node_modules/**', 'dist/**'],
  manifestSrc: 'custom-elements.json',
  diagnosticSeverity: {
    invalidBoolean: 'warning',
    invalidNumber: 'error',
    invalidAttributeValue: 'error',
    deprecatedAttribute: 'warning',
    deprecatedElement: 'warning',
    unknownElement: 'warning',
    unknownAttribute: 'info'
  },
  tagFormatter: (tag) => tag, // Keep original tag names
  libraries: {
    "@shoelace-style/shoelace": {
      tagFormatter: (tag) => `sl-${tag}`,
      diagnosticSeverity: {
        unknownAttribute: 'warning'
      }
    }
  }
};
