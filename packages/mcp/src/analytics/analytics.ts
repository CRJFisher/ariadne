import Database from "better-sqlite3";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { log_info, log_warn } from "../logger";

export interface ToolCallRecord {
  tool_name: string;
  arguments: Record<string, unknown>;
  duration_ms: number;
  success: boolean;
  error_message?: string;
  request_id?: string;
  tool_use_id?: string;
}

// Module-level singleton state (matches logger.ts pattern)
let db: Database.Database | null = null;
let session_id: string | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id      TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL,
  project_path    TEXT NOT NULL,
  client_name     TEXT,
  client_version  TEXT
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL,
  tool_name     TEXT NOT NULL,
  called_at     TEXT NOT NULL,
  duration_ms   INTEGER NOT NULL,
  success       INTEGER NOT NULL,
  error_message TEXT,
  arguments     TEXT NOT NULL,
  request_id    TEXT,
  tool_use_id   TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session ON tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_called_at ON tool_calls(called_at);
`;

function resolve_db_path(db_path?: string): string {
  if (db_path) return db_path;
  if (process.env.ARIADNE_ANALYTICS_DB) return process.env.ARIADNE_ANALYTICS_DB;
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(home, ".ariadne", "analytics.db");
}

export function init_analytics(project_path: string, db_path?: string): string {
  const resolved_path = resolve_db_path(db_path);

  // Create directory if needed (unless in-memory)
  if (resolved_path !== ":memory:") {
    const dir = path.dirname(resolved_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  db = new Database(resolved_path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  try { db.exec("ALTER TABLE tool_calls ADD COLUMN tool_use_id TEXT"); } catch { /* exists */ }

  session_id = crypto.randomUUID();
  const started_at = new Date().toISOString();

  db.prepare(
    "INSERT INTO sessions (session_id, started_at, project_path) VALUES (?, ?, ?)"
  ).run(session_id, started_at, project_path);

  log_info(`Analytics initialized (session: ${session_id})`);
  return session_id;
}

export function record_session_client_info(
  client_name: string,
  client_version: string
): void {
  if (!db || !session_id) return;
  try {
    db.prepare(
      "UPDATE sessions SET client_name = ?, client_version = ? WHERE session_id = ?"
    ).run(client_name, client_version, session_id);
  } catch (error) {
    log_warn(`Failed to record client info: ${error}`);
  }
}

export function record_tool_call(record: ToolCallRecord): void {
  if (!db || !session_id) return;
  try {
    const called_at = new Date().toISOString();
    db.prepare(
      `INSERT INTO tool_calls (session_id, tool_name, called_at, duration_ms, success, error_message, arguments, request_id, tool_use_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      session_id,
      record.tool_name,
      called_at,
      record.duration_ms,
      record.success ? 1 : 0,
      record.error_message ?? null,
      JSON.stringify(record.arguments),
      record.request_id ?? null,
      record.tool_use_id ?? null
    );
  } catch (error) {
    log_warn(`Failed to record tool call: ${error}`);
  }
}

export function close_analytics(): void {
  if (db) {
    db.close();
    db = null;
  }
  session_id = null;
}

export function is_analytics_enabled(): boolean {
  if (process.env.ARIADNE_ANALYTICS === "1") return true;
  try {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const config_path = path.join(home, ".ariadne", "config.json");
    const config = JSON.parse(fs.readFileSync(config_path, "utf-8"));
    return config.analytics === true;
  } catch {
    return false;
  }
}
