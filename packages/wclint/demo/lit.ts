import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("simple-greeting")
export class SimpleGreeting extends LitElement {
  static styles = css`
    p {
      color: blue;
    }
  `;

  render() {
    return html`
      <!-- Unknown component - should trigger validation error -->
      <unknown-component some-attr="value"></unknown-component>

      <!-- Known component with invalid attributes -->
      <counter-component
        invalid-attribute="should-error"
        initial-count="not-a-number"
        step=""
      ></counter-component>

      <!-- Deprecated or misspelled attributes -->
      <counter-component initialCount="5" steps="1"></counter-component>
    `;
  }
}
