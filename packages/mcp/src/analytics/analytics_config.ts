import * as path from "path";
import * as fs from "fs";

export interface ToolCallRecord {
  tool_name: string;
  arguments: Record<string, unknown>;
  duration_ms: number;
  success: boolean;
  error_message?: string;
  request_id?: string;
  tool_use_id?: string;
}

/**
 * The persisted JSONL row, derived from the write-side `ToolCallRecord` so the
 * shared business fields track it by construction. The deltas are the write
 * boundary's doing: `session_writer` stamps `session_id`/`called_at` from
 * ambient session state and normalizes the optional fields to explicit `null`.
 * The writer annotates its persisted literal with this type and the reader
 * parses into it, so drift on either side is a compile error.
 */
export interface ToolCallRow
  extends Omit<ToolCallRecord, "error_message" | "request_id" | "tool_use_id"> {
  session_id: string;
  called_at: string;
  error_message: string | null;
  request_id: string | null;
  tool_use_id: string | null;
}

export function resolve_analytics_dir(dir?: string): string {
  if (dir) return dir;
  if (process.env.ARIADNE_ANALYTICS_DIR) return process.env.ARIADNE_ANALYTICS_DIR;
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(home, ".ariadne", "analytics");
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
