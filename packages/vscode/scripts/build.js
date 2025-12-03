/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const { chmodSync, copyFileSync, existsSync, mkdirSync } = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const executableSource = path.resolve(
  repoRoot,
  "packages/language-server/dist/wc-language-server"
);
const serverTarget = path.resolve(__dirname, "../dist/wc-language-server");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const skipServerBuild = process.argv.includes("--skip-server-build");
const forceServerBuild = process.argv.includes("--force-server-build");

function runLanguageServerBuild() {
  console.log("[vscode] building language server executable...");
  const result = spawnSync(
    pnpmCmd,
    ["--filter", "@wc-toolkit/language-server", "run", "build"],
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

function ensureLanguageServerExecutable() {
  if (!skipServerBuild && (forceServerBuild || !existsSync(executableSource))) {
    runLanguageServerBuild();
  }

  if (!existsSync(executableSource)) {
    throw new Error(
      `[vscode] Missing language server executable at ${executableSource}. ` +
        "Run 'pnpm --filter @wc-toolkit/language-server run build' first."
    );
  }
}

function copyExecutableIntoExtension() {
  mkdirSync(path.dirname(serverTarget), { recursive: true });
  copyFileSync(executableSource, serverTarget);
  chmodSync(serverTarget, 0o755);
  console.log("[vscode] Copied language server executable ->", serverTarget);
}

ensureLanguageServerExecutable();

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
        copyExecutableIntoExtension();
      } catch (copyError) {
        console.error("[vscode] Failed to copy files", copyError);
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
