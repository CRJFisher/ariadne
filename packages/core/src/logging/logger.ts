import * as fs from "fs";

type LogLevel = "error" | "warn" | "info" | "debug";
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let initialized = false;
let log_file_path: string | null = null;
let stderr_level_priority: number = LEVEL_PRIORITY.info;

function ensure_initialized(): void {
  if (initialized) return;
  log_file_path = process.env.DEBUG_LOG_FILE || null;
  const env_level = process.env.ARIADNE_LOG_LEVEL?.toLowerCase();
  if (
    env_level === "error" ||
    env_level === "warn" ||
    env_level === "info" ||
    env_level === "debug"
  ) {
    stderr_level_priority = LEVEL_PRIORITY[env_level];
  }
  initialized = true;
}

/**
 * Initialize logger from environment.
 * Call once at server startup before any logging.
 * Idempotent — safe to call multiple times; also called lazily on first write.
 */
export function initialize_logger(): void {
  initialized = false;
  ensure_initialized();

  if (log_file_path) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(
      log_file_path,
      `\n--- Logger initialized at ${timestamp} ---\n`
    );
  }
}

function format_message(level: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

function write_log(level: LogLevel, message: string): void {
  ensure_initialized();
  const formatted = format_message(level, message);

  if (LEVEL_PRIORITY[level] <= stderr_level_priority) {
    console.error(formatted);
  }

  if (log_file_path) {
    fs.appendFileSync(log_file_path, formatted + "\n");
  }
}

export function log_info(message: string): void {
  write_log("info", message);
}

export function log_warn(message: string): void {
  write_log("warn", message);
}

export function log_error(message: string): void {
  write_log("error", message);
}

export function log_debug(message: string): void {
  write_log("debug", message);
}
