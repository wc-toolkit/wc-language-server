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
      <!-- wctools-disable-next-line invalidBoolean -->
      <sl-alert dep-attr @sl-hide=${this.handleHide}></sl-alert>
    `;
  }

  private handleHide() {
    console.log("Alert hidden");
  }
}
