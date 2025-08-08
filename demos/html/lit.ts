import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("simple-greeting")
export class SimpleGreeting extends LitElement {
  static styles = css`
    p {
      color: blue;
    }
  `;

  render() {
    return html`
      <h1>Lit Test</h1>
      <sl-alert dep-attr></sl-alert>
    `;
  }
}
