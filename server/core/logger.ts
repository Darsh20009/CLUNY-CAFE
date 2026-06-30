/**
 * Phase 9 — Structured logger (JSON in production, pretty in dev).
 * No external deps. Replaces ad-hoc console.log calls.
 */

type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: number = LEVELS[(process.env.LOG_LEVEL as Level) || "info"];
const IS_DEV = process.env.NODE_ENV !== "production";

interface LogContext { [k: string]: any }

function emit(level: Level, scope: string, msg: string, ctx?: LogContext) {
  if (LEVELS[level] < MIN_LEVEL) return;
  if (IS_DEV) {
    const colors: Record<Level, string> = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" };
    const c = colors[level], r = "\x1b[0m";
    const extras = ctx ? " " + JSON.stringify(ctx) : "";
    console.log(`${c}[${level.toUpperCase()}]${r} ${scope}: ${msg}${extras}`);
  } else {
    process.stdout.write(JSON.stringify({ t: Date.now(), level, scope, msg, ...ctx }) + "\n");
  }
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, ctx?: LogContext) => emit("debug", scope, msg, ctx),
    info:  (msg: string, ctx?: LogContext) => emit("info",  scope, msg, ctx),
    warn:  (msg: string, ctx?: LogContext) => emit("warn",  scope, msg, ctx),
    error: (msg: string, ctx?: LogContext) => emit("error", scope, msg, ctx),
    child: (subScope: string) => createLogger(`${scope}:${subScope}`),
  };
}

export const log = createLogger("app");
