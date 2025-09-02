# Contributing to @wc-toolkit/wclint

Thanks for helping improve the CLI demo and validation tooling — this document explains how to get the repo running locally, how to run the demo validations, and a few troubleshooting tips (including the manifest path issue and how it was fixed).

## Quick checklist

- [ ] Build the workspace: `pnpm -w run build` (or build packages individually)
- [ ] Build the CLI: `pnpm --filter @wc-toolkit/wclint run build`
- [ ] Run demo validation: `pnpm --filter @wc-toolkit/wclint run demo:validate`
- [ ] Run tests: `pnpm --filter @wc-toolkit/wclint run test`

## Local development setup

1. Install dependencies

```bash
pnpm install
```

2. Build packages (TypeScript)

```bash
pnpm -w run build
```

3. Build CLI package (when changing CLI source)

```bash
pnpm --filter @wc-toolkit/wclint run build
```

## Demo validation usage

The demo lives in `packages/wclint/demo` and includes sample components and a `wc.config.js` file that points to a `custom-elements.json` manifest.

- Run the demo validation (recommended):

```bash
pnpm --filter @wc-toolkit/wclint demo:validate
```

- Or run directly from the CLI package (useful during development):

```bash
cd packages/wclint
node dist/cli.js --config demo/wc.config.js demo/*.html
```

- Run from the demo directory (uses local config automatically):

```bash
cd packages/wclint/demo
node ../dist/cli.js *.html
```

## How config & manifest resolution works

- The CLI loads the configuration using the shared configuration code (`@wc-toolkit/language-server` shared manager).
- If you pass an explicit `--config <path>` to the CLI, relative `manifestSrc` paths inside the config will be resolved relative to the config file's directory.
- If you run the CLI from a directory that contains `wc.config.js`, the workspace root is that directory and relative manifest paths are resolved from there.

### Example

Given `packages/wclint/demo/wc.config.js`:

```js
export default {
  manifestSrc: "./custom-elements.json",
};
```

- Running from the CLI package with `--config demo/wc.config.js` will resolve the manifest path to `packages/wclint/demo/custom-elements.json` and set the workspace root to `packages/wclint/demo` for manifest loading purposes.

## Fix applied for manifest path issue

Symptom: Running `pnpm --filter @wc-toolkit/wclint demo:validate` used to fail to find the manifest because the CLI package's working directory differed from the demo config location. The CLI loaded the configuration but the services initially tried to load the manifest before the CLI had set/configured the workspace and config context.

What was changed:

- The CLI validator now accepts the optional `configPath` and resolves the `manifestSrc` relative to the config file directory when `--config` is provided.
- The CLI sets the `configurationService.config` explicitly and ensures `configurationService.setWorkspaceRoot()` and `customElementsService.setWorkspaceRoot()` are called with the resolved directory, then re-applies the config to avoid being overwritten by service initialization.

This ensures the custom elements manifest is found and loaded regardless of whether the CLI is invoked from the package root or the demo directory.

## Troubleshooting

- `ReferenceError: require is not defined` when loading `wc.config.js`:

  - This occurs if a service tries to use CommonJS `require()` in an ESM runtime. The temporary workaround in the CLI is to explicitly set the configuration (and re-apply after workspace root changes). Long-term, prefer ESM-compatible config loaders (dynamic `import()` or parse JS/JSON without `require`).

- Manifest not found (`No manifest file found`):

  - Ensure `manifestSrc` in your `wc.config.js` is correct and is resolved relative to the config file location when using `--config`.
  - If you changed config location or file name, run `pnpm --filter @wc-toolkit/wclint build` to rebuild the CLI so debug/logging and code changes are used.

- Still not working: capture the CLI output to a file and inspect it to see the workspace root and resolved manifest path.

```bash
cd packages/wclint/demo
node ../dist/cli.js index.html > /tmp/cli-debug.txt 2>&1
sed -n '1,200p' /tmp/cli-debug.txt
```

## Developer tips

- When editing the language server services, rebuild that package before running the CLI: `pnpm --filter @wc-toolkit/language-server run build`.
- Use `node --input-type=module` or ensure Node `--experimental-specifier-resolution=node` settings if you experiment with ESM/CJS mixing.

## Testing

This project uses Node's built-in test runner for package tests.

How to run tests locally

- Run the root test script (this repository uses `node --test` in the root `package.json`):

```bash
pnpm run test
```

- Run tests for the CLI package directly with Node's test runner:

```bash
node --test packages/wclint/test/config-resolution.test.mjs
```

CI recommendations

- Install dependencies with a frozen lockfile: `pnpm install --frozen-lockfile`.
- Run `pnpm run build` before tests to catch TypeScript issues.
- If your CI requires an alternative test runner, add it and install it explicitly in devDependencies.

## Contact / Reporting issues

Open issues and PRs in this repository. For configuration or manifest issues include:

- CLI command you ran
- Contents of `wc.config.js`
- Full CLI output (redirect to a file as shown above)

Thanks for contributing — small reproducible changes and tests are very helpful!

# Contributing to @wc-toolkit/wclint

Thanks for helping improve the CLI demo and validation tooling — this document explains how to get the repo running locally, how to run the demo validations, and a few troubleshooting tips (including the manifest path issue and how it was fixed).

## Quick checklist

- [ ] Build the workspace: `pnpm -w run build` (or build packages individually)
- [ ] Build the CLI: `pnpm --filter @wc-toolkit/wclint run build`
- [ ] Run demo validation: `pnpm --filter @wc-toolkit/wclint run demo:validate`

## Local development setup

1. Install dependencies

```bash
pnpm install
```

2. Build packages (TypeScript)

```bash
pnpm -w run build
```

3. Build CLI package (when changing CLI source)

```bash
pnpm --filter @wc-toolkit/wclint run build
```

## Demo validation usage

The demo lives in `packages/wclint/demo` and includes sample components and a `wc.config.js` file that points to a `custom-elements.json` manifest.

- Run the demo validation (recommended):

```bash
pnpm --filter @wc-toolkit/wclint demo:validate
```

- Or run directly from the CLI package (useful during development):

```bash
cd packages/wclint
node dist/cli.js --config demo/wc.config.js demo/*.html
```

- Run from the demo directory (uses local config automatically):

```bash
cd packages/wclint/demo
node ../dist/cli.js *.html
```

## How config & manifest resolution works

- The CLI loads the configuration using the shared configuration code (`@wc-toolkit/language-server` shared manager).
- If you pass an explicit `--config <path>` to the CLI, relative `manifestSrc` paths inside the config will be resolved relative to the config file's directory.
- If you run the CLI from a directory that contains `wc.config.js`, the workspace root is that directory and relative manifest paths are resolved from there.

### Example

Given `packages/wclint/demo/wc.config.js`:

```js
export default {
  manifestSrc: "./custom-elements.json",
};
```

- Running from the CLI package with `--config demo/wc.config.js` will resolve the manifest path to `packages/wclint/demo/custom-elements.json` and set the workspace root to `packages/wclint/demo` for manifest loading purposes.

## Fix applied for manifest path issue

Symptom: Running `pnpm --filter @wc-toolkit/wclint demo:validate` used to fail to find the manifest because the CLI package's working directory differed from the demo config location. The CLI loaded the configuration but the services initially tried to load the manifest before the CLI had set/configured the workspace and config context.

What was changed:

- The CLI validator now accepts the optional `configPath` and resolves the `manifestSrc` relative to the config file directory when `--config` is provided.
- The CLI sets the `configurationService.config` explicitly and ensures `configurationService.setWorkspaceRoot()` and `customElementsService.setWorkspaceRoot()` are called with the resolved directory, then re-applies the config to avoid being overwritten by service initialization.

This ensures the custom elements manifest is found and loaded regardless of whether the CLI is invoked from the package root or the demo directory.

## Troubleshooting

- `ReferenceError: require is not defined` when loading `wc.config.js`:

  - This occurs if a service tries to use CommonJS `require()` in an ESM runtime. The temporary workaround in the CLI is to explicitly set the configuration (and re-apply after workspace root changes). Long-term, prefer ESM-compatible config loaders (dynamic `import()` or parse JS/JSON without `require`).

- Manifest not found (`No manifest file found`):

  - Ensure `manifestSrc` in your `wc.config.js` is correct and is resolved relative to the config file location when using `--config`.
  - If you changed config location or file name, run `pnpm --filter @wc-toolkit/wclint build` to rebuild the CLI so debug/logging and code changes are used.

- Still not working: capture the CLI output to a file and inspect it to see the workspace root and resolved manifest path.

```bash
cd packages/wclint/demo
node ../dist/cli.js index.html > /tmp/cli-debug.txt 2>&1
sed -n '1,200p' /tmp/cli-debug.txt
```

## Developer tips

- When editing the language server services, rebuild that package before running the CLI: `pnpm --filter @wc-toolkit/language-server run build`.
- Use `node --input-type=module` or ensure Node `--experimental-specifier-resolution=node` settings if you experiment with ESM/CJS mixing.

## Contact / Reporting issues

Open issues and PRs in this repository. For configuration or manifest issues include:

- CLI command you ran
- Contents of `wc.config.js`
- Full CLI output (redirect to a file as shown above)

Thanks for contributing — small reproducible changes and tests are very helpful!
