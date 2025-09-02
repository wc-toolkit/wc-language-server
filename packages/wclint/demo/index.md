## Components with Issues

These components have validation issues that the CLI should catch:

<!-- Unknown component - should trigger validation error -->

<unknown-component some-attr="value"></unknown-component>

<!-- Known component with invalid attributes -->

<counter-component
invalid-attribute="should-error"
initial-count="not-a-number"
step=""

> </counter-component>

<!-- Deprecated or misspelled attributes -->

<counter-component
initialCount="5"
steps="1"

> </counter-component>
