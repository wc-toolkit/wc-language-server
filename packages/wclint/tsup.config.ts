import { defineConfig, Format } from "tsup";

export default defineConfig({
  // Entry points
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },

  // Output format - ESM to match your package.json type
  format: ["esm"],

  // Generate TypeScript declarations
  dts: {
    resolve: true,
  },

  // Generate source maps for debugging
  sourcemap: true,

  // Clean dist directory before build
  clean: true,

  // Target Node.js 18+ (matches your engines field)
  target: "node18",

  // Disable code splitting - bundle everything into single files
  splitting: false,

  // Bundle the workspace dependency into the output
  noExternal: ["@wc-toolkit/language-server"],

  // Keep these as external dependencies (installed via npm)
  external: [
    "commander",
    "chalk",
    "glob",
    "minimatch",
    "vscode-html-languageservice",
    "vscode-languageserver-textdocument",
    "vscode-languageserver-types",
  ],

  // Add shebang to CLI file only
  banner: (ctx: { format: Format, outDir?: string }) => {
    if (ctx.format === "esm" && ctx.outDir && ctx.outDir.endsWith("cli.js")) {
      return { js: "#!/usr/bin/env node" };
    }
    return {};
  },

  // Make CLI executable after build
  onSuccess: "chmod +x dist/cli.js",
});
