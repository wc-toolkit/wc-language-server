#!/usr/bin/env node
/* eslint-disable no-undef */
import { build } from "esbuild";
import { mkdirSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..", "");
const entryPoint = resolve(packageRoot, "src/index.ts");
const outDir = resolve(packageRoot, "dist");
const outfile = resolve(outDir, "wc-language-server.bundle.cjs");
const require = createRequire(import.meta.url);

const umdToEsmPlugin = {
  name: "umd2esm",
  setup(build) {
    build.onResolve(
      { filter: /^(vscode-.*-languageservice|jsonc-parser)/ },
      (args) => {
        const pathUmdMay = require.resolve(args.path, {
          paths: [args.resolveDir],
        });
        const pathEsm = pathUmdMay
          .replace("/umd/", "/esm/")
          .replace("\\umd\\", "\\esm\\");
        return { path: pathEsm };
      }
    );
  },
};

async function run() {
  mkdirSync(outDir, { recursive: true });

  await build({
    platform: "node",
    target: "node18",
    bundle: true,
    format: "cjs",
    entryPoints: [entryPoint],
    outfile,
    sourcemap: false,
    banner: {
      js: "// Bundled by esbuild for the Web Components Language Server\n",
    },
    minify: true,
    logLevel: "info",
    plugins: [umdToEsmPlugin],
  });

  console.log("[language-server] Created single-file bundle:", outfile);
}

run().catch((error) => {
  console.error("[language-server] Failed to build single-file bundle", error);
  process.exitCode = 1;
});
