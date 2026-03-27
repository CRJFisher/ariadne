import * as fs from "fs";
import * as path from "path";

export interface SessionRow {
  session_id: string;
  started_at: string;
  project_path: string;
  client_name: string | null;
  client_version: string | null;
}

export interface ToolCallRow {
  session_id: string;
  tool_name: string;
  called_at: string;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
  arguments: Record<string, unknown>;
  request_id: string | null;
  tool_use_id: string | null;
}

export interface ToolCallSummary {
  tool_name: string;
  total_calls: number;
  success_count: number;
  failure_count: number;
  avg_duration_ms: number;
}

export interface SessionSummary {
  session_id: string;
  started_at: string;
  project_path: string;
  client_name: string | null;
  client_version: string | null;
  call_count: number;
}

export interface ToolCallDetail {
  tool_name: string;
  called_at: string;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
  arguments: string;
  request_id: string | null;
  tool_use_id: string | null;
}

function read_jsonl<T>(file_path: string): T[] {
  try {
    const content = fs.readFileSync(file_path, "utf-8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

export function read_sessions(dir: string): SessionRow[] {
  return read_jsonl<SessionRow>(path.join(dir, "sessions.jsonl"));
}

export function read_tool_calls(dir: string): ToolCallRow[] {
  return read_jsonl<ToolCallRow>(path.join(dir, "tool_calls.jsonl"));
}

function aggregate_tool_calls(tool_calls: ToolCallRow[]): ToolCallSummary[] {
  const groups = new Map<
    string,
    { total: number; success: number; duration_sum: number }
  >();

  for (const call of tool_calls) {
    const g = groups.get(call.tool_name) ?? {
      total: 0,
      success: 0,
      duration_sum: 0,
    };
    g.total++;
    if (call.success) g.success++;
    g.duration_sum += call.duration_ms;
    groups.set(call.tool_name, g);
  }

  return Array.from(groups.entries())
    .map(([tool_name, g]) => ({
      tool_name,
      total_calls: g.total,
      success_count: g.success,
      failure_count: g.total - g.success,
      avg_duration_ms: Math.round(g.duration_sum / g.total),
    }))
    .sort((a, b) => b.total_calls - a.total_calls);
}

export function calls_per_tool(tool_calls: ToolCallRow[]): ToolCallSummary[] {
  return aggregate_tool_calls(tool_calls);
}

export function calls_in_range(
  tool_calls: ToolCallRow[],
  from: string,
  to: string,
): ToolCallSummary[] {
  const filtered = tool_calls.filter(
    (c) => c.called_at >= from && c.called_at <= to,
  );
  return aggregate_tool_calls(filtered);
}

export function recent_sessions(
  sessions: SessionRow[],
  tool_calls: ToolCallRow[],
  limit: number = 5,
): SessionSummary[] {
  const call_counts = new Map<string, number>();
  for (const call of tool_calls) {
    call_counts.set(call.session_id, (call_counts.get(call.session_id) ?? 0) + 1);
  }

  return sessions
    .slice()
    .sort((a, b) => (a.started_at > b.started_at ? -1 : a.started_at < b.started_at ? 1 : 0))
    .slice(0, limit)
    .map((s) => ({
      session_id: s.session_id,
      started_at: s.started_at,
      project_path: s.project_path,
      client_name: s.client_name,
      client_version: s.client_version,
      call_count: call_counts.get(s.session_id) ?? 0,
    }));
}

export function session_detail(
  tool_calls: ToolCallRow[],
  session_id: string,
): ToolCallDetail[] {
  return tool_calls
    .filter((c) => c.session_id === session_id)
    .sort((a, b) => (a.called_at < b.called_at ? -1 : a.called_at > b.called_at ? 1 : 0))
    .map((c) => ({
      tool_name: c.tool_name,
      called_at: c.called_at,
      duration_ms: c.duration_ms,
      success: c.success,
      error_message: c.error_message,
      arguments: JSON.stringify(c.arguments),
      request_id: c.request_id,
      tool_use_id: c.tool_use_id,
    }));
}
