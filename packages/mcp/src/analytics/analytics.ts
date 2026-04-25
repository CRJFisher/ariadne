import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { log_info, log_warn } from "@ariadnejs/core";

export interface ToolCallRecord {
  tool_name: string;
  arguments: Record<string, unknown>;
  duration_ms: number;
  success: boolean;
  error_message?: string;
  request_id?: string;
  tool_use_id?: string;
}

let analytics_dir: string | null = null;
let session_id: string | null = null;
let started_at: string | null = null;
let project_path_stored: string | null = null;
let client_name: string | null = null;
let client_version: string | null = null;

export function resolve_analytics_dir(dir?: string): string {
  if (dir) return dir;
  if (process.env.ARIADNE_ANALYTICS_DIR) return process.env.ARIADNE_ANALYTICS_DIR;
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(home, ".ariadne", "analytics");
}

export function init_analytics(project_path: string, dir?: string): string {
  const resolved_dir = resolve_analytics_dir(dir);

  fs.mkdirSync(resolved_dir, { recursive: true });

  analytics_dir = resolved_dir;
  session_id = crypto.randomUUID();
  started_at = new Date().toISOString();
  project_path_stored = project_path;
  client_name = null;
  client_version = null;

  log_info(`Analytics initialized (session: ${session_id})`);
  return session_id;
}

export function record_session_client_info(
  name: string,
  version: string,
): void {
  if (!analytics_dir || !session_id) return;
  client_name = name;
  client_version = version;
}

export function record_tool_call(record: ToolCallRecord): void {
  if (!analytics_dir || !session_id) return;
  try {
    const line = JSON.stringify({
      session_id,
      tool_name: record.tool_name,
      called_at: new Date().toISOString(),
      duration_ms: record.duration_ms,
      success: record.success,
      error_message: record.error_message ?? null,
      arguments: record.arguments,
      request_id: record.request_id ?? null,
      tool_use_id: record.tool_use_id ?? null,
    });
    fs.appendFileSync(path.join(analytics_dir, "tool_calls.jsonl"), line + "\n");
  } catch (error) {
    log_warn(`Failed to record tool call: ${error}`);
  }
}

export function close_analytics(): void {
  if (analytics_dir && session_id) {
    try {
      const line = JSON.stringify({
        session_id,
        started_at,
        project_path: project_path_stored,
        client_name,
        client_version,
      });
      fs.appendFileSync(path.join(analytics_dir, "sessions.jsonl"), line + "\n");
    } catch (error) {
      log_warn(`Failed to write session record: ${error}`);
    }
  }
  analytics_dir = null;
  session_id = null;
  started_at = null;
  project_path_stored = null;
  client_name = null;
  client_version = null;
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
