import * as fs from "fs";
import * as path from "path";
import pkg from "vscode-html-languageservice";
import { glob } from "glob";
import service from "../../packages/vscode/dist/server.js";

console.log('SERVICE KEYS:', Object.keys(service));
const { htmlValidationService } = service;
const { getLanguageService, TextDocument } = pkg;
/* glob or list of HTML files to check */
const files = glob.sync("*");

let hasErrors = false;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const document = TextDocument.create(file, "html", 0, content);
  const htmlLanguageService = getLanguageService();
  const diagnostics = htmlValidationService.provideDiagnostics(
    document,
    htmlLanguageService
  );

  diagnostics.forEach((diag) => {
    hasErrors = true;
    console.error(
      `${file}:${diag.range.start.line + 1}:${diag.range.start.character + 1} - ${diag.message}`
    );
  });
}

if (hasErrors) {
  process.exit(1); // Fail the build
}
