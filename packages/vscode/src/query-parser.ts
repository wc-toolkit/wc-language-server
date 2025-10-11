/**
 * Utility functions for parsing and handling AI queries about web components
 */

export interface ComponentInfo {
  tagName: string;
  doc: string;
}

export interface QueryResult {
  type: 'single' | 'multiple' | 'search' | 'all' | 'none';
  components: ComponentInfo[];
  searchTerm?: string;
  message?: string;
}

/**
 * Extract component names from text (e.g., "sl-button", "<my-component>", `wa-card`)
 */
function extractComponentNames(text: string): string[] {
  const components: string[] = [];
  
  // Pattern 1: Quoted or backticked: `sl-button`, "my-component"
  const quotedPattern = /[`"']([a-z][a-z0-9]*-[a-z0-9-]+)[`"']/gi;
  let match;
  while ((match = quotedPattern.exec(text)) !== null) {
    components.push(match[1].toLowerCase());
  }
  
  // Pattern 2: HTML tags: <sl-button>, </my-component>
  const tagPattern = /<\/?([a-z][a-z0-9]*-[a-z0-9-]+)[\s>]/gi;
  while ((match = tagPattern.exec(text)) !== null) {
    const component = match[1].toLowerCase();
    if (!components.includes(component)) {
      components.push(component);
    }
  }
  
  // Pattern 3: Standalone hyphenated words (more conservative)
  // Only match if surrounded by spaces/punctuation and looks like a component
  const standalonePattern = /(?:^|\s)([a-z]{2,}[a-z0-9]*-[a-z0-9-]{2,})(?:\s|[.,;:!?]|$)/gi;
  while ((match = standalonePattern.exec(text)) !== null) {
    const component = match[1].toLowerCase();
    if (!components.includes(component)) {
      components.push(component);
    }
  }
  
  return components;
}

/**
 * Find components by fuzzy matching (e.g., "button" finds "sl-button", "md-button")
 */
function fuzzyMatchComponents(
  searchTerm: string,
  componentDocs: Record<string, string>
): string[] {
  const lowerTerm = searchTerm.toLowerCase();
  const matches: string[] = [];
  
  for (const tagName of Object.keys(componentDocs)) {
    const lowerTag = tagName.toLowerCase();
    
    // Exact match
    if (lowerTag === lowerTerm) {
      return [tagName]; // Return immediately if exact match
    }
    
    // Contains search term
    if (lowerTag.includes(lowerTerm)) {
      matches.push(tagName);
      continue;
    }
    
    // Search term contains component name part
    const parts = lowerTag.split('-');
    if (parts.some(part => part.length > 2 && lowerTerm.includes(part))) {
      matches.push(tagName);
      continue;
    }
    
    // Component name contains search term parts
    const searchParts = lowerTerm.split(/[-\s]+/);
    if (searchParts.some(part => part.length > 2 && lowerTag.includes(part))) {
      matches.push(tagName);
    }
  }
  
  return matches;
}

/**
 * Search components by content (properties, events, description, etc.)
 */
function searchComponentsByContent(
  searchTerm: string,
  componentDocs: Record<string, string>
): string[] {
  const lowerTerm = searchTerm.toLowerCase();
  const matches: string[] = [];
  
  for (const [tagName, doc] of Object.entries(componentDocs)) {
    const lowerDoc = doc.toLowerCase();
    
    // Search in documentation content
    if (lowerDoc.includes(lowerTerm)) {
      matches.push(tagName);
    }
  }
  
  return matches;
}

/**
 * Detect if query is asking for a comparison
 */
function isComparisonQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    lowerQuery.includes('compare') ||
    lowerQuery.includes('difference') ||
    lowerQuery.includes('vs') ||
    lowerQuery.includes('versus') ||
    lowerQuery.includes('better') ||
    (lowerQuery.includes('what') && lowerQuery.includes('between'))
  );
}

/**
 * Detect if query is asking for a list
 */
function isListQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    lowerQuery.includes('list') ||
    lowerQuery.includes('show all') ||
    lowerQuery.includes('what components') ||
    lowerQuery.includes('available components') ||
    lowerQuery.includes('which components') ||
    query.toLowerCase().trim() === 'all'
  );
}

/**
 * Detect if query is asking for search/filter
 */
function isSearchQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return (
    lowerQuery.includes('search') ||
    lowerQuery.includes('find') ||
    lowerQuery.includes('with') ||
    lowerQuery.includes('that have') ||
    lowerQuery.includes('that has')
  );
}

/**
 * Extract search criteria from query (e.g., "components with size attribute")
 */
function extractSearchCriteria(query: string): string {
  // Remove common query prefixes
  const criteria = query
    .replace(/^(search|find|show|list|get)\s+(for\s+|me\s+)?/i, '')
    .replace(/components?\s+(with|that have|that has|having)\s+/i, '')
    .replace(/^(what|which)\s+/i, '')
    .trim();
  
  return criteria;
}

/**
 * Main function to parse a query and determine what components to return
 */
export function parseQuery(
  query: string,
  componentDocs: Record<string, string>
): QueryResult {
  const trimmedQuery = query.trim();
  
  if (!trimmedQuery) {
    return {
      type: 'none',
      components: [],
      message: 'Please provide a query about web components.',
    };
  }
  
  // Check for "all" query
  if (isListQuery(trimmedQuery)) {
    const allComponents = Object.entries(componentDocs).map(([tagName, doc]) => ({
      tagName,
      doc,
    }));
    
    return {
      type: 'all',
      components: allComponents,
      message: `Showing all ${allComponents.length} components`,
    };
  }
  
  // Extract explicit component names from query
  const explicitComponents = extractComponentNames(trimmedQuery);
  
  // Check for comparison query
  if (isComparisonQuery(trimmedQuery) && explicitComponents.length >= 2) {
    const components: ComponentInfo[] = [];
    
    for (const tagName of explicitComponents.slice(0, 3)) { // Limit to 3 components
      if (componentDocs[tagName]) {
        components.push({ tagName, doc: componentDocs[tagName] });
      }
    }
    
    if (components.length >= 2) {
      return {
        type: 'multiple',
        components,
        message: `Comparing ${components.map(c => c.tagName).join(', ')}`,
      };
    }
  }
  
  // Check for single explicit component
  if (explicitComponents.length === 1) {
    const tagName = explicitComponents[0];
    if (componentDocs[tagName]) {
      return {
        type: 'single',
        components: [{ tagName, doc: componentDocs[tagName] }],
        message: `Information about ${tagName}`,
      };
    }
  }
  
  // If we have multiple explicit components, return them all
  if (explicitComponents.length > 1) {
    const components: ComponentInfo[] = [];
    
    for (const tagName of explicitComponents) {
      if (componentDocs[tagName]) {
        components.push({ tagName, doc: componentDocs[tagName] });
      }
    }
    
    if (components.length > 0) {
      return {
        type: 'multiple',
        components,
        message: `Information about ${components.map(c => c.tagName).join(', ')}`,
      };
    }
  }
  
  // Check for search/filter query
  if (isSearchQuery(trimmedQuery)) {
    const criteria = extractSearchCriteria(trimmedQuery);
    const matches = searchComponentsByContent(criteria, componentDocs);
    
    if (matches.length > 0) {
      const components = matches.map(tagName => ({
        tagName,
        doc: componentDocs[tagName],
      }));
      
      return {
        type: 'search',
        components,
        searchTerm: criteria,
        message: `Found ${matches.length} component(s) matching "${criteria}"`,
      };
    }
  }
  
  // Try fuzzy matching on the entire query or key terms
  const searchTerms = trimmedQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 2);
  
  for (const term of searchTerms) {
    const fuzzyMatches = fuzzyMatchComponents(term, componentDocs);
    
    if (fuzzyMatches.length > 0) {
      const components = fuzzyMatches.slice(0, 10).map(tagName => ({
        tagName,
        doc: componentDocs[tagName],
      }));
      
      return {
        type: fuzzyMatches.length === 1 ? 'single' : 'search',
        components,
        searchTerm: term,
        message:
          fuzzyMatches.length === 1
            ? `Found component: ${fuzzyMatches[0]}`
            : `Found ${fuzzyMatches.length} component(s) matching "${term}"`,
      };
    }
  }
  
  // No matches found
  const availableCount = Object.keys(componentDocs).length;
  return {
    type: 'none',
    components: [],
    message: `No components found matching your query. ${availableCount} component(s) available. Try "list all components" to see what's available.`,
  };
}

/**
 * Format query result for AI consumption
 */
export function formatQueryResult(result: QueryResult): string {
  if (result.type === 'none') {
    return result.message || 'No components found.';
  }
  
  if (result.type === 'all') {
    // For "all" queries, provide a summary first, then full docs
    const summary = result.components
      .map((c) => {
        // Extract first line of description
        const lines = c.doc.split('\n').filter((l) => l.trim());
        const firstContent = lines.find((l) => !l.startsWith('#'));
        return `- **${c.tagName}**: ${firstContent ? firstContent.substring(0, 100) : 'No description'}`;
      })
      .join('\n');
    
    return `# Available Components (${result.components.length})\n\n${summary}\n\n---\n\n# Full Documentation\n\n${result.components.map((c) => `## ${c.tagName}\n\n${c.doc}`).join('\n\n---\n\n')}`;
  }
  
  if (result.type === 'single') {
    const component = result.components[0];
    return `# ${component.tagName}\n\n${component.doc}`;
  }
  
  if (result.type === 'multiple' || result.type === 'search') {
    let output = `# ${result.message}\n\n`;
    
    // If more than 5 components, show summary first
    if (result.components.length > 5) {
      const summary = result.components
        .map((c) => {
          const lines = c.doc.split('\n').filter((l) => l.trim());
          const firstContent = lines.find((l) => !l.startsWith('#'));
          return `- **${c.tagName}**: ${firstContent ? firstContent.substring(0, 80) : 'No description'}`;
        })
        .join('\n');
      
      output += `## Summary\n\n${summary}\n\n---\n\n## Detailed Documentation\n\n`;
    }
    
    output += result.components
      .map((c) => `## ${c.tagName}\n\n${c.doc}`)
      .join('\n\n---\n\n');
    
    return output;
  }
  
  return result.message || 'No information available.';
}
