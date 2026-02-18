import Database from "better-sqlite3";

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
  id: number;
  tool_name: string;
  called_at: string;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
  arguments: string;
  request_id: string | null;
}

export function calls_per_tool(db: Database.Database): ToolCallSummary[] {
  return db
    .prepare(
      `SELECT
        tool_name,
        COUNT(*) as total_calls,
        SUM(success) as success_count,
        COUNT(*) - SUM(success) as failure_count,
        CAST(ROUND(AVG(duration_ms)) AS INTEGER) as avg_duration_ms
      FROM tool_calls
      GROUP BY tool_name
      ORDER BY total_calls DESC`
    )
    .all() as ToolCallSummary[];
}

export function calls_in_range(
  db: Database.Database,
  from: string,
  to: string
): ToolCallSummary[] {
  return db
    .prepare(
      `SELECT
        tool_name,
        COUNT(*) as total_calls,
        SUM(success) as success_count,
        COUNT(*) - SUM(success) as failure_count,
        CAST(ROUND(AVG(duration_ms)) AS INTEGER) as avg_duration_ms
      FROM tool_calls
      WHERE called_at >= ? AND called_at <= ?
      GROUP BY tool_name
      ORDER BY total_calls DESC`
    )
    .all(from, to) as ToolCallSummary[];
}

export function recent_sessions(
  db: Database.Database,
  limit: number = 5
): SessionSummary[] {
  return db
    .prepare(
      `SELECT
        s.session_id,
        s.started_at,
        s.project_path,
        s.client_name,
        s.client_version,
        COUNT(tc.id) as call_count
      FROM sessions s
      LEFT JOIN tool_calls tc ON s.session_id = tc.session_id
      GROUP BY s.session_id
      ORDER BY s.started_at DESC
      LIMIT ?`
    )
    .all(limit) as SessionSummary[];
}

export function session_detail(
  db: Database.Database,
  session_id: string
): ToolCallDetail[] {
  const rows = db
    .prepare(
      `SELECT id, tool_name, called_at, duration_ms, success, error_message, arguments, request_id
      FROM tool_calls
      WHERE session_id = ?
      ORDER BY called_at ASC`
    )
    .all(session_id) as Array<{
    id: number;
    tool_name: string;
    called_at: string;
    duration_ms: number;
    success: number;
    error_message: string | null;
    arguments: string;
    request_id: string | null;
  }>;

  return rows.map((row) => ({
    ...row,
    success: row.success === 1,
  }));
}
