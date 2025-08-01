import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { VsCodeHtmlCompletionService } from "./html-completion-service";

export class VSCodeAdapter {
  htmlDataProvider!: html.IHTMLDataProvider;

  constructor(
    private htmlCompletionService: VsCodeHtmlCompletionService
  ) {
    this.htmlDataProvider = this.htmlCompletionService.getHTMLDataProvider()!;
  }

  createDiagnostic(
    range: html.Range,
    message: string,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error
  ): html.Diagnostic {
    return {
      range,
      message,
      severity,
      source: "web-components",
    };
  }

  initializeHTMLDataProvider(): void {
    // Use the adapter's method to create the HTML data provider
    this.htmlDataProvider = this.htmlCompletionService.getHTMLDataProvider()!;
  }
}
