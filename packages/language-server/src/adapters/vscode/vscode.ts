import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { VsCodeHtmlCompletionService } from "./html-completion-service";
import { CustomElementsService } from "../../services/custom-elements-service";

export class VSCodeAdapter {
  htmlDataProvider!: html.IHTMLDataProvider;
  htmlCompletionService!: VsCodeHtmlCompletionService;

  /**
   *
   */
  constructor(private customElementsService: CustomElementsService) {
    this.htmlCompletionService = new VsCodeHtmlCompletionService(
      this.customElementsService
    );
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
