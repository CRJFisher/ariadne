#!/usr/bin/env node
import Database from "better-sqlite3";
import * as path from "path";
import {
  calls_per_tool,
  calls_in_range,
  recent_sessions,
  session_detail,
} from "../analytics/query_stats";

export function resolve_db_path(): string {
  if (process.env.ARIADNE_ANALYTICS_DB) return process.env.ARIADNE_ANALYTICS_DB;
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(home, ".ariadne", "analytics.db");
}

export interface CliArgs {
  since?: string;
  session?: string;
}

export function parse_args(argv: string[] = process.argv.slice(2)): CliArgs {
  const result: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--since" && argv[i + 1]) {
      result.since = argv[i + 1];
      i++;
    } else if (argv[i] === "--session" && argv[i + 1]) {
      result.session = argv[i + 1];
      i++;
    }
  }
  return result;
}

export function pad_right(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

export function main(argv?: string[]): void {
  const db_path = resolve_db_path();
  let db: Database.Database;

  try {
    db = new Database(db_path, { readonly: true });
  } catch {
    console.error(`Cannot open analytics DB at: ${db_path}`);
    console.error("Analytics may not be enabled. Set ARIADNE_ANALYTICS=1 in .mcp.json");
    process.exit(1);
  }

  const args = parse_args(argv);

  if (args.session) {
    // Per-session detail view
    const calls = session_detail(db, args.session);
    if (calls.length === 0) {
      console.log(`No tool calls found for session: ${args.session}`);
      db.close();
      return;
    }

    console.log(`Session: ${args.session}`);
    console.log(`Tool calls: ${calls.length}\n`);

    for (const call of calls) {
      const status = call.success ? "OK" : `FAIL: ${call.error_message}`;
      console.log(
        `  ${call.called_at}  ${pad_right(call.tool_name, 32)} ${call.duration_ms}ms  ${status}`
      );
    }

    db.close();
    return;
  }

  // Summary view
  const sessions_list = recent_sessions(db, 5);
  const total_sessions_row = db
    .prepare("SELECT COUNT(*) as count FROM sessions")
    .get() as { count: number };
  const total_calls_row = db
    .prepare("SELECT COUNT(*) as count FROM tool_calls")
    .get() as { count: number };

  console.log("Ariadne Analytics Summary");
  console.log("=========================");
  console.log(`Total sessions: ${total_sessions_row.count}`);
  console.log(`Total tool calls: ${total_calls_row.count}`);

  // Tool breakdown
  const tool_stats = args.since
    ? calls_in_range(db, `${args.since}T00:00:00.000Z`, "9999-12-31T23:59:59.999Z")
    : calls_per_tool(db);

  if (tool_stats.length > 0) {
    if (args.since) {
      console.log(`\nCalls by tool (since ${args.since}):`);
    } else {
      console.log("\nCalls by tool:");
    }

    const max_name_len = Math.max(...tool_stats.map((s) => s.tool_name.length));
    for (const stat of tool_stats) {
      const failures = stat.failure_count > 0 ? `, ${stat.failure_count} failures` : "";
      console.log(
        `  ${pad_right(stat.tool_name + ":", max_name_len + 1)}  ${pad_right(String(stat.total_calls) + " calls", 12)} (avg ${stat.avg_duration_ms}ms${failures})`
      );
    }
  }

  // Recent sessions
  if (sessions_list.length > 0) {
    console.log(`\nRecent sessions (last ${sessions_list.length}):`);
    for (const s of sessions_list) {
      const client = s.client_name
        ? `${s.client_name}@${s.client_version}`
        : "unknown-client";
      const timestamp = s.started_at.slice(0, 16);
      console.log(
        `  ${s.session_id.slice(0, 8)}  ${timestamp}  ${pad_right(client, 22)} ${pad_right(s.project_path, 30)} ${s.call_count} calls`
      );
    }
  }

  db.close();
}

// Run when executed directly (not imported by tests)
const is_direct = process.argv[1]?.includes("ariadne_analytics");
if (is_direct) {
  main();
}
