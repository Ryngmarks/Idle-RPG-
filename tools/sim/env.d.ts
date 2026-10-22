// Minimal Node globals used by the simulator CLI (avoids adding @types/node).
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void };
declare const process: { argv: string[]; exitCode?: number };
