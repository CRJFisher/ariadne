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
