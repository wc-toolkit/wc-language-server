/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const { copyFileSync, existsSync, mkdirSync } = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const bundleSource = path.resolve(
  repoRoot,
  "packages/language-server/bin/wc-language-server"
);
const serverTarget = path.resolve(__dirname, "../dist/server");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const skipServerBuild = process.argv.includes("--skip-server-build");
const forceServerBuild = process.argv.includes("--force-server-build");

function runLanguageServerBuild() {
  console.log("[vscode] building language server executable...");
  const result = spawnSync(
    pnpmCmd,
    ["--filter", "@wc-toolkit/language-server", "run", "bundle:executable"],
    {
      cwd: repoRoot,
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    throw new Error(
      "[vscode] Failed to build the language server executable. See logs above."
    );
  }
}

function ensureLanguageServerBundle() {
  if (!skipServerBuild && (forceServerBuild || !existsSync(bundleSource))) {
    runLanguageServerBuild();
  }

  if (!existsSync(bundleSource)) {
    throw new Error(
      `[vscode] Missing language server executable at ${bundleSource}. ` +
        "Run 'pnpm --filter @wc-toolkit/language-server run bundle:executable' first."
    );
  }
}

function copyBundleIntoExtension() {
  mkdirSync(path.dirname(serverTarget), { recursive: true });
  copyFileSync(bundleSource, serverTarget);
  console.log("[vscode] Copied language server executable ->", serverTarget);
}

ensureLanguageServerBundle();

require("esbuild")
  .context({
    entryPoints: {
      client: "./src/extension.ts",
      "mcp-server": "./src/mcp-server.ts",
    },
    sourcemap: true,
    bundle: true,
    metafile: process.argv.includes("--metafile"),
    outdir: "./dist",
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    tsconfig: "./tsconfig.json",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: process.argv.includes("--minify"),
    plugins: [
      {
        name: "umd2esm",
        setup(build) {
          build.onResolve(
            { filter: /^(vscode-.*-languageservice|jsonc-parser)/ },
            (args) => {
              const pathUmdMay = require.resolve(args.path, {
                paths: [args.resolveDir],
              });
              // Call twice the replace is to solve the problem of the path in Windows
              const pathEsm = pathUmdMay
                .replace("/umd/", "/esm/")
                .replace("\\umd\\", "\\esm\\");
              return { path: pathEsm };
            },
          );
        },
      },
    ],
  })
  .then(async (ctx) => {
    const copyAfterBuild = (error) => {
      const hasErrors = Array.isArray(error) ? error.length > 0 : Boolean(error);
      if (hasErrors) {
        console.error("[vscode] esbuild failed, skipping bundle copy", error);
        return;
      }
      try {
        copyBundleIntoExtension();
      } catch (copyError) {
        console.error("[vscode] Failed to copy language server bundle", copyError);
      }
    };

    console.log("building...");
    if (process.argv.includes("--watch")) {
      await ctx.watch({
        onRebuild(error) {
          copyAfterBuild(error);
        },
      });
      console.log("watching...");
    } else {
      const result = await ctx.rebuild();
      copyAfterBuild(result.errors && result.errors.length ? result.errors : null);
      await ctx.dispose();
      console.log("finished.");
    }
  });
