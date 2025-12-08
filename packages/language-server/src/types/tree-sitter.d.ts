/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal shims so TypeScript accepts tree-sitter imports (packages ship no .d.ts files)
declare module "tree-sitter" {
  const Parser: any;
  export default Parser;
  export type Language = any;
  export type SyntaxNode = any;
}

declare module "tree-sitter-html" {
  const Language: any;
  export default Language;
}
