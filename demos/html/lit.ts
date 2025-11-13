import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("simple-greeting")
export class SimpleGreeting extends LitElement {
  static styles = css`
    p {
      color: blue;
    }
  `;

  someValue = 'test';

  render() {
    return html`
      <h1>Lit Test</h1>
      <sl-alert :dep-attr=${"value"} variant="success"></sl-alert>
      <sl-alert></sl-alert>
      <sl-badge .variant=${"success"}></sl-badge>
      <sl-input .defaultValue=${"Hello, World!"} help-text=${"Enter your greeting"} .disabled=${true}></sl-input>
      <sl-alert .closable=${true}></sl-alert>
      <sl-icon [label]="" library=${"icon-library"} [attr.src]="" [attr.name]="" name="" (sl-error)=${this.handleError}></sl-icon>
      <sl-alert closable style="" variant=${this.someValue ? "something" : "test"}></sl-alert>
      <sl-button variant="neutral"></sl-button>
    `;
  }
}
