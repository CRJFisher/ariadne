import * as fs from "fs";

let log_file_path: string | null = null;

/**
 * Initialize logger from environment.
 * Call once at server startup before any logging.
 */
export function initialize_logger(): void {
  log_file_path = process.env.DEBUG_LOG_FILE || null;

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

function write_log(level: string, message: string): void {
  const formatted = format_message(level, message);

  // Always write to stderr (safe for MCP stdio transport)
  console.error(formatted);

  // Also write to file if configured
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
  if (log_file_path) {
    const formatted = format_message("debug", message);
    fs.appendFileSync(log_file_path, formatted + "\n");
  }
}
