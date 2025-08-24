/**
 * Extracts custom element information from a Custom Elements Manifest with precise locations
 * @param {Object} manifest - The custom elements manifest object
 * @returns {Array} Array of objects containing tag names, attributes, and their precise locations
 */
function parseCustomElementsManifest(manifest) {
  const customElements = [];

  if (!manifest || !manifest.modules) {
    return customElements;
  }

  // Iterate through all modules in the manifest
  manifest.modules.forEach((module) => {
    const modulePath = module.path || "unknown";

    // Process declarations in each module
    if (module.declarations) {
      module.declarations.forEach((declaration) => {
        // Check if this declaration is a custom element
        if (declaration.kind === "class" && declaration.customElement) {
          const element = {
            tagName: declaration.tagName,
            className: declaration.name,
            location: {
              file: modulePath,
              line: declaration.source?.start || null,
              column: declaration.source?.column || null,
              range: declaration.source || null,
            },
            attributes: [],
            properties: [],
            events: [],
            slots: [],
            cssProperties: [],
            cssParts: [],
          };

          // Extract attributes with their locations
          if (declaration.attributes) {
            declaration.attributes.forEach((attr) => {
              element.attributes.push({
                name: attr.name,
                type: attr.type?.text || "unknown",
                description: attr.description || "",
                default: attr.default,
                location: {
                  file: modulePath,
                  line: attr.source?.start || null,
                  column: attr.source?.column || null,
                  range: attr.source || null,
                },
              });
            });
          }

          // Extract properties that might be reflected as attributes
          if (declaration.members) {
            declaration.members.forEach((member) => {
              if (member.kind === "field" && member.privacy === "public") {
                element.properties.push({
                  name: member.name,
                  type: member.type?.text || "unknown",
                  description: member.description || "",
                  attribute: member.attribute || null, // Reflected attribute name
                  privacy: member.privacy || "public",
                  location: {
                    file: modulePath,
                    line: member.source?.start || null,
                    column: member.source?.column || null,
                    range: member.source || null,
                  },
                });
              }
            });
          }

          // Extract events with their locations
          if (declaration.events) {
            declaration.events.forEach((event) => {
              element.events.push({
                name: event.name,
                type: event.type?.text || "CustomEvent",
                description: event.description || "",
                location: {
                  file: modulePath,
                  line: event.source?.start || null,
                  column: event.source?.column || null,
                  range: event.source || null,
                },
              });
            });
          }

          // Extract slots with their locations
          if (declaration.slots) {
            declaration.slots.forEach((slot) => {
              element.slots.push({
                name: slot.name || "default",
                description: slot.description || "",
                location: {
                  file: modulePath,
                  line: slot.source?.start || null,
                  column: slot.source?.column || null,
                  range: slot.source || null,
                },
              });
            });
          }

          // Extract CSS custom properties with their locations
          if (declaration.cssProperties) {
            declaration.cssProperties.forEach((prop) => {
              element.cssProperties.push({
                name: prop.name,
                description: prop.description || "",
                default: prop.default,
                location: {
                  file: modulePath,
                  line: prop.source?.start || null,
                  column: prop.source?.column || null,
                  range: prop.source || null,
                },
              });
            });
          }

          // Extract CSS parts with their locations
          if (declaration.cssParts) {
            declaration.cssParts.forEach((part) => {
              element.cssParts.push({
                name: part.name,
                description: part.description || "",
                location: {
                  file: modulePath,
                  line: part.source?.start || null,
                  column: part.source?.column || null,
                  range: part.source || null,
                },
              });
            });
          }

          customElements.push(element);
        }
      });
    }

    // Also check for exports that might reference custom elements
    if (module.exports) {
      module.exports.forEach((exp) => {
        if (exp.kind === "custom-element-definition") {
          // Handle cases where custom element is defined via customElements.define()
          const element = customElements.find(
            (el) => el.className === exp.declaration?.name
          );
          if (element && exp.name) {
            element.tagName = exp.name;
          }
        }
      });
    }
  });

  return customElements;
}

/**
 * Gets a simplified list of all tag names and their attributes with precise locations
 * @param {Object} manifest - The custom elements manifest object
 * @returns {Array} Simplified array with tagName, attributes, and their locations
 */
function getCustomElementsList(manifest) {
  const elements = parseCustomElementsManifest(manifest);

  return elements.map((element) => ({
    tagName: element.tagName,
    location: element.location,
    attributes: element.attributes.map((attr) => ({
      name: attr.name,
      location: attr.location,
    })),
    reflectedProperties: element.properties
      .filter((prop) => prop.attribute)
      .map((prop) => ({
        name: prop.attribute,
        propertyName: prop.name,
        location: prop.location,
      })),
  }));
}

/**
 * Gets a flat list of all API locations for easy navigation
 * @param {Object} manifest - The custom elements manifest object
 * @returns {Array} Flat array of all API items with their locations
 */
function getAllApiLocations(manifest) {
  const elements = parseCustomElementsManifest(manifest);
  const apiItems = [];

  elements.forEach((element) => {
    // Add the custom element itself
    apiItems.push({
      type: "custom-element",
      name: element.tagName,
      className: element.className,
      location: element.location,
    });

    // Add all attributes
    element.attributes.forEach((attr) => {
      apiItems.push({
        type: "attribute",
        name: attr.name,
        parent: element.tagName,
        location: attr.location,
      });
    });

    // Add all properties
    element.properties.forEach((prop) => {
      apiItems.push({
        type: "property",
        name: prop.name,
        parent: element.tagName,
        attribute: prop.attribute,
        location: prop.location,
      });
    });

    // Add all events
    element.events.forEach((event) => {
      apiItems.push({
        type: "event",
        name: event.name,
        parent: element.tagName,
        location: event.location,
      });
    });

    // Add all slots
    element.slots.forEach((slot) => {
      apiItems.push({
        type: "slot",
        name: slot.name,
        parent: element.tagName,
        location: slot.location,
      });
    });

    // Add CSS custom properties
    element.cssProperties.forEach((prop) => {
      apiItems.push({
        type: "css-property",
        name: prop.name,
        parent: element.tagName,
        location: prop.location,
      });
    });

    // Add CSS parts
    element.cssParts.forEach((part) => {
      apiItems.push({
        type: "css-part",
        name: part.name,
        parent: element.tagName,
        location: part.location,
      });
    });
  });

  return apiItems;
}

/**
 * Creates VSCode-compatible links for jumping to locations
 * @param {Object} location - Location object with file, line, column
 * @returns {string} VSCode URI that can be used to jump to the location
 */
function createVSCodeLink(location) {
  if (!location.file || !location.line) {
    return null;
  }

  const column = location.column || 1;
  return `vscode://file/${location.file}:${location.line}:${column}`;
}

/**
 * Creates file:// links for jumping to locations (works with many editors)
 * @param {Object} location - Location object with file, line, column
 * @returns {string} File URI that can be used to jump to the location
 */
function createFileLink(location) {
  if (!location.file || !location.line) {
    return null;
  }

  const column = location.column || 1;
  return `file://${location.file}#L${location.line}:${column}`;
}

// Example usage:
const manifest = {
  "schemaVersion": "1.0.0",
  "readme": "",
  "modules": [
    {
      "kind": "javascript-module",
      "path": "./src/my-element.js",
      "declarations": [
        {
          "kind": "class",
          "description": "A custom element example",
          "name": "MyElement",
          "tagName": "my-element",
          "customElement": true,
          "source": {
            "start": 10,
            "column": 1
          },
          "attributes": [
            {
              "name": "disabled",
              "type": {
                "text": "boolean"
              },
              "description": "Whether the element is disabled",
              "source": {
                "start": 25,
                "column": 3
              }
            }
          ],
          "members": [
            {
              "kind": "field",
              "name": "value",
              "type": {
                "text": "string"
              },
              "attribute": "value",
              "description": "The element's value",
              "source": {
                "start": 15,
                "column": 3
              }
            }
          ]
        }
      ]
    }
  ]
};

// Get all custom elements with full location information
const customElements = parseCustomElementsManifest(manifest);
console.log('All custom elements with locations:', customElements);

// Get simplified list with locations
const elementsList = getCustomElementsList(manifest);
console.log('Simplified list with locations:', elementsList);

// Get flat list of all API items for easy navigation
const allApiLocations = getAllApiLocations(manifest);
console.log('All API locations:', allApiLocations);

// Example of creating navigation links
allApiLocations.forEach(item => {
  if (item.location.file && item.location.line) {
    const vscodeLink = createVSCodeLink(item.location);
    const fileLink = createFileLink(item.location);
    console.log(`${item.type}: ${item.name} - VSCode: ${vscodeLink}, File: ${fileLink}`);
  }
});
