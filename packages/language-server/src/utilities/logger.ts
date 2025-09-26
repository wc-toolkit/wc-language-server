export const DEBUG = Boolean(process.env.WC_DEBUG);
let isDebuggingEnabled = false;

export function setEnableDebugging(enableDebugging: boolean) {
  isDebuggingEnabled = enableDebugging;
}

const PREFIX = "[wctools]";

export function debug(...args: unknown[]) {
  if (isDebuggingEnabled) {
    // Use console.debug where available
    console.debug('[debug]', ...args);
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
