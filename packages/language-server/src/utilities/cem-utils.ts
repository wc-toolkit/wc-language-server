// import type * as cem from 'custom-elements-manifest/schema' with { 'resolution-mode': 'require' };
// import * as fs from 'fs';

// /**
//  * Interface for storing source locations in a custom elements manifest
//  */
// export interface CemLocation {
//   /** The type of location (tag, attribute, method, etc) */
//   type: 'tag' | 'attribute' | 'method' | 'field' | 'event' | 'css-property' | 'slot';
//   /** The element tag name */
//   tagName?: string;
//   /** The name of the API item (attribute name, method name, etc.) */
//   name: string;
//   /** Character position in the manifest file */
//   position: number;
//   /** Line number in the manifest file (if available) */
//   line?: number;
//   /** Character in the line (if available) */
//   character?: number;
//   /** Original element or member from the manifest */
//   original: any;
// }

// /**
//  * Maps all locations of elements and APIs in a custom elements manifest
//  * This is useful for implementing definition providers and other navigation features
//  *
//  * @param manifestPath Path to the custom elements manifest file
//  * @returns A map of API names to their locations in the manifest
//  */
// export function mapCemLocations(manifestPath: string): Map<string, CemLocation> {
//   const locations = new Map<string, CemLocation>();

//   if (!fs.existsSync(manifestPath)) {
//     return locations;
//   }

//   try {
//     const manifestContent = fs.readFileSync(manifestPath, 'utf8');
//     const manifest: cem.Package = JSON.parse(manifestContent);

//     // Create line map for more accurate position information
//     const lines = manifestContent.split('\n');
//     const lineStartPositions: number[] = [];
//     let position = 0;

//     for (const line of lines) {
//       lineStartPositions.push(position);
//       position += line.length + 1; // +1 for newline character
//     }

//     // Helper function to find line/character from position
//     const getLineInfo = (position: number): { line: number, character: number } => {
//       for (let i = 1; i < lineStartPositions.length; i++) {
//         if (lineStartPositions[i] > position) {
//           return {
//             line: i - 1,
//             character: position - lineStartPositions[i - 1]
//           };
//         }
//       }
//       return { line: lineStartPositions.length - 1, character: 0 };
//     };

//     // Find positions of all elements and their APIs
//     if (manifest.modules) {
//       for (const module of manifest.modules) {
//         if (!module.declarations) continue;

//         for (const declaration of module.declarations) {
//           // Handle custom elements
//           if (isCustomElement(declaration)) {
//             const customElement = declaration as cem.CustomElement;
//             const tagName = customElement.tagName;

//             if (tagName) {
//               // Find tag position
//               const tagPattern = `"tagName"\\s*:\\s*"${escapeRegExp(tagName)}"`;
//               const tagMatch = new RegExp(tagPattern, 'g').exec(manifestContent);

//               if (tagMatch) {
//                 const tagPosition = tagMatch.index;
//                 const { line, character } = getLineInfo(tagPosition);

//                 const tagLocation: CemLocation = {
//                   type: 'tag',
//                   tagName,
//                   name: tagName,
//                   position: tagPosition,
//                   line,
//                   character,
//                   original: customElement
//                 };

//                 // Store the tag location
//                 locations.set(tagName, tagLocation);

//                 // Process members if available
//                 if (customElement.members) {
//                   for (const member of customElement.members) {
//                     if (member.name) {
//                       processMember(member, tagName, manifestContent, getLineInfo, locations);
//                     }
//                   }
//                 }

//                 // Process slots
//                 if (customElement.slots) {
//                   for (const slot of customElement.slots) {
//                     if (slot.name !== undefined) { // Include default slot (empty name)
//                       const slotName = slot.name || 'default';
//                       const slotPattern = `"name"\\s*:\\s*"${escapeRegExp(slotName)}"`;
//                       const slotMatch = new RegExp(slotPattern, 'g').exec(manifestContent);

//                       if (slotMatch) {
//                         const slotPosition = slotMatch.index;
//                         const { line, character } = getLineInfo(slotPosition);

//                         locations.set(`${tagName}.slot.${slotName}`, {
//                           type: 'slot',
//                           tagName,
//                           name: slotName,
//                           position: slotPosition,
//                           line,
//                           character,
//                           original: slot
//                         });
//                       }
//                     }
//                   }
//                 }

//                 // Process CSS parts
//                 if (customElement.cssParts) {
//                   for (const part of customElement.cssParts) {
//                     if (part.name) {
//                       const partPattern = `"name"\\s*:\\s*"${escapeRegExp(part.name)}"`;
//                       const partMatch = new RegExp(partPattern, 'g').exec(manifestContent);

//                       if (partMatch) {
//                         const partPosition = partMatch.index;
//                         const { line, character } = getLineInfo(partPosition);

//                         locations.set(`${tagName}.part.${part.name}`, {
//                           type: 'css-property',
//                           tagName,
//                           name: part.name,
//                           position: partPosition,
//                           line,
//                           character,
//                           original: part
//                         });
//                       }
//                     }
//                   }
//                 }
//               }
//             }
//           }
//         }
//       }
//     }

//     return locations;
//   } catch (error) {
//     console.error('Error mapping locations in CEM file:', error);
//     return locations;
//   }
// }

// /**
//  * Process a class member (field, method, etc.) and add it to the locations map
//  */
// function processMember(
//   member: cem.ClassMember,
//   tagName: string,
//   manifestContent: string,
//   getLineInfo: (position: number) => { line: number, character: number },
//   locations: Map<string, CemLocation>
// ): void {
//   const memberName = member.name;

//   // Determine member type and search pattern
//   let memberType: CemLocation['type'];
//   let searchName: string = memberName;

//   switch (member.kind) {
//     case 'field':
//       memberType = 'field';
//       // For fields that are also attributes, add the attribute mapping
//       if ((member as any).attribute) {
//         const attrName = (member as any).attribute;
//         if (typeof attrName === 'string') {
//           const attrPattern = `"attribute"\\s*:\\s*"${escapeRegExp(attrName)}"`;
//           const attrMatch = new RegExp(attrPattern, 'g').exec(manifestContent);

//           if (attrMatch) {
//             const attrPosition = attrMatch.index;
//             const { line, character } = getLineInfo(attrPosition);

//             // Store attribute location
//             locations.set(`${tagName}.attr.${attrName}`, {
//               type: 'attribute',
//               tagName,
//               name: attrName,
//               position: attrPosition,
//               line,
//               character,
//               original: member
//             });
//           }
//         }
//       }
//       break;
//     case 'method':
//       memberType = 'method';
//       break;
//     default:
//       memberType = 'field'; // Default to field
//   }

//   // Find the member's position in the manifest
//   const memberPattern = `"name"\\s*:\\s*"${escapeRegExp(memberName)}"`;
//   const memberMatch = new RegExp(memberPattern, 'g').exec(manifestContent);

//   if (memberMatch) {
//     const memberPosition = memberMatch.index;
//     const { line, character } = getLineInfo(memberPosition);

//     // Store member location
//     locations.set(`${tagName}.${memberType}.${memberName}`, {
//       type: memberType,
//       tagName,
//       name: memberName,
//       position: memberPosition,
//       line,
//       character,
//       original: member
//     });
//   }
// }

// /**
//  * Checks if a declaration is a custom element
//  */
// function isCustomElement(declaration: any): boolean {
//   return declaration.kind === 'class' &&
//          declaration.customElement === true &&
//          declaration.tagName;
// }

// /**
//  * Escapes special characters in a string for use in a regular expression
//  */
// function escapeRegExp(string: string): string {
//   return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }
