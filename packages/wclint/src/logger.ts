// Console-backed CLI logger. Prefixes messages with a short tag.
const PREFIX = "[wc-cli]";

export function info(...args: unknown[]) {
  console.info(PREFIX, ...args);
}

export function debug(...args: unknown[]) {
  // Only emit debug when WC_DEBUG is set (truthy).
  if (process.env.WC_DEBUG) {
    console.debug(PREFIX, ...args);
  }
}

export function warn(...args: unknown[]) {
  console.warn(PREFIX, ...args);
}

export function error(...args: unknown[]) {
  console.error(PREFIX, ...args);
}
