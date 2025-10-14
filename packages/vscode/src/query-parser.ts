/**
 * Simplified utility functions for parsing and handling AI queries about web components
 */

export interface ComponentInfo {
  tagName: string;
  doc: string;
}

export interface QueryResult {
  type: "single" | "multiple" | "search" | "all" | "none" | "property" | "reasoning";
  components: ComponentInfo[];
  searchTerm?: string;
  message?: string;
  propertyType?: string; // For property-specific queries
  comparisonTarget?: string; // For reasoning queries comparing to HTML elements
}

/**
 * Extract component names from text (e.g., "sl-button", "<my-component>", `wa-card`)
 */
function extractComponentNames(text: string): string[] {
  const components = new Set<string>();

  // Combined pattern for quoted, tagged, and standalone component names
  const patterns = [
    /[`"']([a-z][a-z0-9]*-[a-z0-9-]+)[`"']/gi, // `sl-button`, "my-component"
    /<\/?([a-z][a-z0-9]*-[a-z0-9-]+)[\s>]/gi, // <sl-button>, </my-component>
    /(?:^|\s)([a-z]{2,}[a-z0-9]*-[a-z0-9-]{2,})(?:\s|[.,;:!?]|$)/gi, // standalone
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      components.add(match[1].toLowerCase());
    }
  }

  return Array.from(components);
}

/**
 * Extract meaningful terms using simplified NLP patterns
 */
function extractSemanticTerms(prompt: string): string[] {
  const terms = new Set<string>();
  const lower = prompt.toLowerCase();

  // Simple semantic associations - much more focused
  const semanticMap: Record<string, string[]> = {
    click: ["button", "clickable"],
    type: ["input", "text"],
    select: ["dropdown", "menu", "option"],
    show: ["modal", "dialog", "display"],
    navigate: ["menu", "nav", "link"],
    round: ["rounded", "pill"],
    flat: ["minimal", "simple"],
  };

  // Add semantic terms
  for (const [trigger, associations] of Object.entries(semanticMap)) {
    if (lower.includes(trigger)) {
      associations.forEach((term) => terms.add(term));
    }
  }

  // Extract basic patterns: "create a [term]", "make it [term]", etc.
  const patterns = [
    /\b(?:create|make|build|add|use)\s+(?:a|an|the)?\s*([a-z-]+)/g,
    /\b([a-z-]+)\s+(?:component|button|input|form|dialog|modal)/g,
    /\b([a-z-]+)\b/g, // All individual words
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const term = match[1].trim();
      if (term.length > 2) terms.add(term);
    }
  }

  return Array.from(terms);
}

/**
 * Simple semantic scoring
 */
function calculateSemanticScore(
  searchTerm: string,
  componentName: string
): number {
  let score = 0;
  const lower = searchTerm.toLowerCase();
  const name = componentName.toLowerCase();

  // Basic functional/visual associations
  const associations: Record<string, string[]> = {
    button: ["click", "action", "submit"],
    input: ["type", "enter", "form"],
    modal: ["show", "popup", "dialog"],
    menu: ["nav", "select", "dropdown"],
    card: ["display", "container"],
    pill: ["rounded", "button"],
  };

  for (const [component, keywords] of Object.entries(associations)) {
    if (name.includes(component) && keywords.some((k) => lower.includes(k))) {
      score += 3;
    }
  }

  return Math.min(score, 8);
}

/**
 * Extract design keywords using simplified approach
 */
export function extractDesignKeywords(prompt: string): string[] {
  const semanticTerms = extractSemanticTerms(prompt);
  const componentNames = extractComponentNames(prompt);
  return Array.from(new Set([...semanticTerms, ...componentNames]));
}

/**
 * Find relevant components with simplified scoring
 */
export function findRelevantComponents(
  searchTerms: string[],
  componentDocs: Record<string, string>,
  maxResults: number = 10
): ComponentInfo[] {
  const scored: Array<{ tagName: string; score: number }> = [];

  for (const [tagName, doc] of Object.entries(componentDocs)) {
    let score = 0;
    const lowerName = tagName.toLowerCase();
    const lowerDoc = doc.toLowerCase();

    for (const term of searchTerms) {
      const lowerTerm = term.toLowerCase();

      // Exact name match (highest score)
      if (lowerName === lowerTerm) score += 20;
      // Name contains term
      else if (lowerName.includes(lowerTerm)) score += 10;
      // Component part match (e.g., "button" matches "sl-button")
      else if (lowerName.split("-").some((part) => part === lowerTerm))
        score += 8;

      // Documentation matches
      const docMatches = (lowerDoc.match(new RegExp(lowerTerm, "g")) || [])
        .length;
      score += docMatches * 2;

      // Semantic scoring
      score += calculateSemanticScore(lowerTerm, lowerName);
    }

    if (score > 0) {
      scored.push({ tagName, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => ({
      tagName: item.tagName,
      doc: componentDocs[item.tagName],
    }));
}

/**
 * Unified query type detection
 */
function detectQueryType(query: string): { 
  type: string; 
  keywords: string[]; 
  propertyType?: string;
  comparisonTarget?: string;
} {
  const lower = query.toLowerCase().trim();

  // Property-specific queries (NEW)
  const propertyPatterns = [
    { pattern: /what\s+(events?|event\s+handlers?)\s+(?:does\s+)?(.+?)\s+(?:have|emit|fire|trigger)/i, property: "events" },
    { pattern: /(?:show\s+me\s+)?(?:the\s+)?(events?|event\s+handlers?)\s+(?:of\s+|for\s+)?(.+)/i, property: "events" },
    { pattern: /what\s+(attributes?|props?|properties)\s+(?:does\s+)?(.+?)\s+(?:have|accept|support)/i, property: "attributes" },
    { pattern: /(?:show\s+me\s+)?(?:the\s+)?(attributes?|props?|properties)\s+(?:of\s+|for\s+)?(.+)/i, property: "attributes" },
    { pattern: /what\s+(slots?)\s+(?:does\s+)?(.+?)\s+(?:have|accept|support)/i, property: "slots" },
    { pattern: /(?:show\s+me\s+)?(?:the\s+)?(slots?)\s+(?:of\s+|for\s+)?(.+)/i, property: "slots" },
    { pattern: /what\s+(methods?|functions?)\s+(?:does\s+)?(.+?)\s+(?:have|support|provide)/i, property: "methods" },
    { pattern: /(?:show\s+me\s+)?(?:the\s+)?(methods?|functions?)\s+(?:of\s+|for\s+)?(.+)/i, property: "methods" },
    { pattern: /what\s+(css\s+parts?|parts?)\s+(?:does\s+)?(.+?)\s+(?:have|support|expose)/i, property: "css-parts" },
    { pattern: /(?:show\s+me\s+)?(?:the\s+)?(css\s+parts?|parts?)\s+(?:of\s+|for\s+)?(.+)/i, property: "css-parts" },
    { pattern: /what\s+(css\s+variables?|custom\s+properties)\s+(?:does\s+)?(.+?)\s+(?:have|support|use)/i, property: "css-variables" },
    { pattern: /(?:show\s+me\s+)?(?:the\s+)?(css\s+variables?|custom\s+properties)\s+(?:of\s+|for\s+)?(.+)/i, property: "css-variables" }
  ];

  for (const { pattern, property } of propertyPatterns) {
    const match = query.match(pattern);
    if (match) {
      const componentText = match[2] || match[1];
      const components = extractComponentNames(componentText);
      
      if (components.length > 0) {
        return { 
          type: "property", 
          keywords: components, 
          propertyType: property 
        };
      }
    }
  }

  // List/all query
  if (["all", "list", "show all", "available"].some((k) => lower.includes(k))) {
    return { type: "list", keywords: [] };
  }

  // Enhanced comparison query detection
  if (
    ["compare", "vs", "versus", "difference", "differ", "better", "between"].some((k) =>
      lower.includes(k)
    ) || 
    /what.*(difference|different).*between/i.test(query) ||
    /\b(\w+-\w+)\s+(vs|versus|and)\s+(\w+-\w+)\b/i.test(query) ||
    // NEW: Reasoning/justification patterns
    (/why\s+(would|should|use|choose)/i.test(query) && /instead\s+of/i.test(query)) ||
    /what.*(advantage|benefit|reason).*over/i.test(query) ||
    /when\s+(to\s+use|should\s+I\s+use).*instead\s+of/i.test(query) ||
    /better\s+than/i.test(query)
  ) {
    const components = extractComponentNames(query);
    
    // Check for "instead of" pattern with HTML elements
    const insteadMatch = query.match(/(.+?)\s+instead\s+of\s+(?:a\s+)?(?:standard\s+)?(?:html\s+)?(button|input|div|span|form|select|textarea|img|link|anchor)/i);
    if (insteadMatch) {
      const componentText = insteadMatch[1];
      const htmlElement = insteadMatch[2];
      const extractedComponents = extractComponentNames(componentText);
      
      if (extractedComponents.length > 0) {
        return { 
          type: "reasoning", 
          keywords: extractedComponents,
          comparisonTarget: htmlElement
        };
      }
    }
    
    // Check for "over" pattern with HTML elements
    const overMatch = query.match(/(.+?)\s+(?:have\s+)?over\s+(?:a\s+)?(?:standard\s+)?(?:html\s+)?(button|input|div|span|form|select|textarea|img|link|anchor)/i);
    if (overMatch) {
      const componentText = overMatch[1];
      const htmlElement = overMatch[2];
      const extractedComponents = extractComponentNames(componentText);
      
      if (extractedComponents.length > 0) {
        return { 
          type: "reasoning", 
          keywords: extractedComponents,
          comparisonTarget: htmlElement
        };
      }
    }
    
    // If we found exactly 2 components, it's definitely a comparison
    if (components.length === 2) {
      return { type: "compare", keywords: components };
    }
    
    // Try to extract components from "between X and Y" pattern
    const betweenMatch = query.match(/between\s+[`"]?([a-z]+-[a-z0-9-]+)[`"]?\s+and\s+[`"]?([a-z]+-[a-z0-9-]+)[`"]?/i);
    if (betweenMatch) {
      return { type: "compare", keywords: [betweenMatch[1], betweenMatch[2]] };
    }
    
    // Fallback: look for any components mentioned
    if (components.length >= 2) {
      return { type: "compare", keywords: components.slice(0, 2) };
    }
    
    return { type: "compare", keywords: components };
  }

  // Implementation query
  if (
    ["how to", "how can", "create", "build", "make"].some((k) =>
      lower.includes(k)
    )
  ) {
    return { type: "implementation", keywords: extractDesignKeywords(query) };
  }

  // Search query
  if (["search", "find", "with", "that have"].some((k) => lower.includes(k))) {
    return {
      type: "search",
      keywords: [lower.replace(/^(search|find|show|list)\s+/i, "")],
    };
  }

  // Default: fuzzy search
  return {
    type: "fuzzy",
    keywords: lower
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  };
}

/**
 * Simplified main parsing function
 */
export function parseQuery(
  query: string,
  componentDocs: Record<string, string>
): QueryResult {
  if (!query.trim()) {
    return {
      type: "none",
      components: [],
      message: "Please provide a query about web components.",
    };
  }

  const queryInfo = detectQueryType(query);
  const { type, keywords, propertyType, comparisonTarget } = queryInfo;

  // Handle list query
  if (type === "list") {
    const components = Object.entries(componentDocs).map(([tagName, doc]) => ({
      tagName,
      doc,
    }));
    return {
      type: "all",
      components,
      message: `Showing all ${components.length} components`,
    };
  }

  // Handle reasoning query (component vs HTML element)
  if (type === "reasoning" && comparisonTarget) {
    const explicitComponents = extractComponentNames(query);
    const components = explicitComponents
      .filter((name) => componentDocs[name])
      .map((name) => ({ tagName: name, doc: componentDocs[name] }));

    if (components.length > 0) {
      return {
        type: "reasoning",
        components,
        comparisonTarget,
        message: `Comparing ${components[0].tagName} with HTML ${comparisonTarget}`,
      };
    }
    
    // No explicit components found, but it's a reasoning query
    return {
      type: "none",
      components: [],
      message: `No components found for reasoning query: "${query}"`,
    };
  }

  // Handle property query
  if (type === "property" && propertyType) {
    const explicitComponents = extractComponentNames(query);
    const components = explicitComponents
      .filter((name) => componentDocs[name])
      .map((name) => ({ tagName: name, doc: componentDocs[name] }));

    if (components.length > 0) {
      return {
        type: "property",
        components,
        propertyType,
        message: `Finding ${propertyType} for ${components[0].tagName}`,
      };
    }
    
    // No explicit components found, but it's a property query
    return {
      type: "none",
      components: [],
      message: `No components found for ${propertyType} query: "${query}"`,
    };
  }

  // Handle explicit component names
  const explicitComponents = extractComponentNames(query);
  if (explicitComponents.length > 0) {
    const components = explicitComponents
      .filter((name) => componentDocs[name])
      .map((name) => ({ tagName: name, doc: componentDocs[name] }));

    if (components.length > 0) {
      return {
        type: components.length === 1 ? "single" : "multiple",
        components,
        message:
          components.length === 1
            ? `Information about ${components[0].tagName}`
            : `Information about ${components.map((c) => c.tagName).join(", ")}`,
      };
    }
  }

  // Handle search with keywords
  if (keywords.length > 0) {
    const components = findRelevantComponents(keywords, componentDocs);

    if (components.length > 0) {
      return {
        type: components.length === 1 ? "single" : "search",
        components,
        searchTerm: keywords.join(" "),
        message:
          components.length === 1
            ? `Found component: ${components[0].tagName}`
            : `Found ${components.length} component(s) matching "${keywords.join(" ")}"`,
      };
    }
  }

  // No matches
  return {
    type: "none",
    components: [],
    message: `No components found. Try "list all components" to see what's available.`,
  };
}

/**
 * Format query result for AI consumption
 */
export function formatQueryResult(
  result: QueryResult,
  originalQuery?: string
): string {
  if (result.type === "none") {
    return result.message || "No components found.";
  }

  if (result.type === "single") {
    return `# ${result.components[0].tagName}\n\n${result.components[0].doc}`;
  }

  if (result.type === "all") {
    const summary = result.components
      .map((c) => {
        const firstLine =
          c.doc.split("\n").find((l) => l.trim() && !l.startsWith("#")) || "";
        return `- **${c.tagName}**: ${firstLine.substring(0, 100)}`;
      })
      .join("\n");

    return `# Available Components (${result.components.length})\n\n${summary}\n\n---\n\n${result.components.map((c) => `## ${c.tagName}\n\n${c.doc}`).join("\n\n---\n\n")}`;
  }

  // Multiple or search results
  let output = `# ${result.message}\n\n`;

  if (originalQuery?.toLowerCase().includes("how")) {
    output += `*Based on: "${originalQuery}"*\n\n`;
  }

  if (result.components.length > 5) {
    const summary = result.components
      .map((c) => {
        const firstLine =
          c.doc.split("\n").find((l) => l.trim() && !l.startsWith("#")) || "";
        return `- **${c.tagName}**: ${firstLine.substring(0, 80)}`;
      })
      .join("\n");
    output += `## Summary\n\n${summary}\n\n---\n\n## Details\n\n`;
  }

  output += result.components
    .map((c) => `## ${c.tagName}\n\n${c.doc}`)
    .join("\n\n---\n\n");
  return output;
}
