// Public entrypoint for the CLI package. Re-export shared configuration types
// and the programmatic adapter so consumers can import from
// `@wc-toolkit/wclint` directly.

export * from "./config.js";
export { runValidate } from "./cli.js";
export type { ValidationResult } from "./validator.js";
