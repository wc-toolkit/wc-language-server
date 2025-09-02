export class SimpleGreeting extends HTMLElement {
  // @ts-expect-error this is not installed
  static styles = css`
    p {
      color: blue;
    }
  `;

  render() {
    // @ts-expect-error this is not installed
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
