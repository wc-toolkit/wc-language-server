# CSS Autocomplete for Web Components

This module provides intelligent CSS autocomplete functionality for web components, including support for:

## Features

### 1. **CSS Custom Properties (CSS Variables)**
Autocomplete for component-specific CSS custom properties defined in the Custom Elements Manifest.

**Example:**
```css
sl-alert {
  --sl-alert-border-radius: 0.5rem;
  --sl-alert-padding: 1rem;
  /* Type '--' to see all available custom properties */
}
```

**Triggers:**
- Typing `--` in a CSS rule block
- Shows all CSS custom properties from all components in the manifest
- Displays which component defines each property
- Shows description and deprecation status

### 2. **CSS Parts (::part() selector)**
Autocomplete for CSS parts exposed by web components for styling shadow DOM elements.

**Example:**
```css
sl-alert::part(base) {
  background: white;
}

sl-alert::part(message) {
  font-weight: bold;
}
```

**Triggers:**
- Typing `::part(` 
- Shows all CSS parts exposed by components
- Filters suggestions as you type the part name
- Displays which component exposes each part

### 3. **CSS Custom States (:state() selector)**
Autocomplete for custom element states using the `:state()` pseudo-class.

**Example:**
```css
my-element:state(loading) {
  opacity: 0.5;
}

sl-button:state(disabled) {
  pointer-events: none;
}
```

**Triggers:**
- Typing `:state(`
- Shows custom states defined in components
- Detected from `CustomStateSet` members in the manifest

### 4. **Component Selector Autocomplete**
Autocomplete for custom element tag names when typing selectors.

**Example:**
```css
/* Type 'sl-' to see all Shoelace components */
sl-button {
  margin: 1rem;
}

sl-dropdown {
  display: inline-block;
}
```

**Triggers:**
- Typing a component name (with hyphen)
- Shows all matching custom elements
- Displays component description and deprecation status

## Implementation Details

### Pattern Matching

The autocomplete uses regex patterns to detect context:

```typescript
// Custom properties: --prefix
/\s+(--[\w-]*)$/

// CSS parts: ::part(name
/::part\(\s*([\w-]*)$/

// CSS states: :state(name
/:state\(\s*([\w-]*)$/

// Component selectors: my-element
/(?:^|\s|,)([\w-]+)$/
```

### Data Sources

All information comes from the Custom Elements Manifest:

```typescript
interface Component {
  tagName: string;
  description?: string;
  deprecated?: boolean | string;
  
  // CSS-related properties
  cssProperties?: {
    name: string;
    description?: string;
    deprecated?: boolean | string;
  }[];
  
  cssParts?: {
    name: string;
    description?: string;
    deprecated?: boolean | string;
  }[];
  
  // States detected from members
  members?: {
    name: string;
    type?: { text: string };
    description?: string;
  }[];
}
```

### Helper Functions

**Get CSS properties for a specific element:**
```typescript
import { getCssPropertiesForElement } from './plugins/css';

const properties = getCssPropertiesForElement('sl-alert');
// Returns: [{ name: '--sl-alert-border-radius', description: '...' }, ...]
```

**Get CSS parts for a specific element:**
```typescript
import { getCssPartsForElement } from './plugins/css';

const parts = getCssPartsForElement('sl-alert');
// Returns: [{ name: 'base', description: '...' }, { name: 'message', ... }]
```

**Get CSS states for a specific element:**
```typescript
import { getCssStatesForElement } from './plugins/css';

const states = getCssStatesForElement('my-element');
// Returns: [{ name: 'loading', description: '...' }]
```

## Debugging

The module uses debug logging extensively:

```typescript
debug("css:autocomplete:trigger:customProperty", { partial: "--sl-" });
debug("css:autocomplete:customProperties:complete", { total: 10, unique: 8 });
```

Enable debug logging in your `wc.config.js`:

```javascript
export default {
  debug: true,
  // ... other config
};
```

## Usage Example

```typescript
import { getCssAutoCompleteSuggestions } from './plugins/css';
import * as css from 'vscode-css-languageservice';

// In your language server
connection.onCompletion((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;
  
  if (document.languageId === 'css') {
    return getCssAutoCompleteSuggestions(document, params.position);
  }
  
  return null;
});
```

## Integration with HTML

CSS autocomplete works seamlessly with HTML autocomplete:

**HTML:**
```html
<sl-alert variant="primary" closable>
  Alert message
</sl-alert>
```

**CSS:**
```css
sl-alert {
  --sl-alert-border-radius: 8px; /* Autocomplete suggests this */
}

sl-alert::part(base) { /* Autocomplete suggests 'base', 'icon', 'message', etc. */
  padding: 1rem;
}
```

## Testing

Test the autocomplete in various CSS contexts:

1. **Rule blocks**: `sl-button { --| }`
2. **Part selectors**: `sl-alert::part(|)`
3. **State selectors**: `my-element:state(|)`
4. **Selector context**: `sl-|`
5. **Nested rules**: `.container sl-button::part(|)`
6. **Media queries**: `@media { sl-alert { --| } }`

## Future Enhancements

- [ ] Hover information for CSS properties, parts, and states
- [ ] Go-to-definition for CSS custom properties
- [ ] Validation for invalid part names
- [ ] Validation for invalid custom properties
- [ ] Code actions to add missing custom properties
- [ ] Quick fixes for common CSS issues
- [ ] Support for CSS-in-JS scenarios

## Related Modules

- `html/autocomplete.ts` - HTML attribute and element autocomplete
- `custom-elements-service.ts` - Loads and manages CEM data
- `cem-utilities` - Helper functions for CEM parsing
