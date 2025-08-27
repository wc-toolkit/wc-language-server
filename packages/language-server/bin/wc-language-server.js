#!/usr/bin/env node
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
if (process.argv.includes("--version")) {
  const pkgJSON = require("../package.json");
  console.log(`${pkgJSON["version"]}`);
} else {
  require("../dist/index.js");
}
