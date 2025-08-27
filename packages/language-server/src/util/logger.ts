export const DEBUG = Boolean(process.env.WC_DEBUG);

const PREFIX = '[wc-ls]';

export function debug(...args: unknown[]) {
  if (DEBUG) {
    // Use console.debug where available
    console.debug(PREFIX, ...args);
  }
}

export function info(...args: unknown[]) {
  console.info(PREFIX, ...args);
}

export function warn(...args: unknown[]) {
  console.warn(PREFIX, ...args);
}

export function error(...args: unknown[]) {
  console.error(PREFIX, ...args);
}
