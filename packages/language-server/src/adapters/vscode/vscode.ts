import * as html from "vscode-html-languageservice";
import { DiagnosticSeverity } from "vscode-languageserver-types";
import { Component } from "@wc-toolkit/cem-utilities";
import { VsCodeHtmlCompletionService } from "./html-completion-service";
import { AttributeTypes, CustomElementsService } from "../../custom-elements-service";

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

  initializeHTMLDataProvider(
    customElementsMap: Map<string, Component>,
    attributeOptions: AttributeTypes,
    findPositionCallback: (searchText: string) => number
  ): void {
    // The findPositionCallback should return a number, so cast if necessary
    const findPosition = (searchText: string) => {
      const result = findPositionCallback(searchText);
      return typeof result === "number" ? result : Number(result);
    };

    // Use the adapter's method to create the HTML data provider
    this.htmlDataProvider =
      this.htmlCompletionService.createHTMLDataFromCustomElements(
        customElementsMap as Map<string, Component>,
        attributeOptions,
        findPosition
      );
  }
}
