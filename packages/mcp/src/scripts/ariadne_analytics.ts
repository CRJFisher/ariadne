#!/usr/bin/env node
import {
  calls_per_tool,
  calls_in_range,
  recent_sessions,
  session_detail,
  read_sessions,
  read_tool_calls,
} from "../analytics/query_stats";
import { resolve_analytics_dir } from "../analytics/analytics";

interface CliArgs {
  since?: string;
  session?: string;
}

function parse_args(argv: string[] = process.argv.slice(2)): CliArgs {
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

function pad_right(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function main(): void {
  const dir = resolve_analytics_dir();

  const sessions = read_sessions(dir);
  const tool_calls = read_tool_calls(dir);

  if (sessions.length === 0 && tool_calls.length === 0) {
    console.error(`No analytics data found in: ${dir}`);
    console.error("Analytics may not be enabled. Set ARIADNE_ANALYTICS=1 in .mcp.json");
    process.exit(1);
  }

  const args = parse_args();

  if (args.session) {
    // Per-session detail view
    const calls = session_detail(tool_calls, args.session);
    if (calls.length === 0) {
      console.log(`No tool calls found for session: ${args.session}`);
      return;
    }

    console.log(`Session: ${args.session}`);
    console.log(`Tool calls: ${calls.length}\n`);

    for (const call of calls) {
      const status = call.success ? "OK" : `FAIL: ${call.error_message}`;
      console.log(
        `  ${call.called_at}  ${pad_right(call.tool_name, 32)} ${call.duration_ms}ms  ${status}`,
      );
    }

    return;
  }

  // Summary view
  console.log("Ariadne Analytics Summary");
  console.log("=========================");
  console.log(`Total sessions: ${sessions.length}`);
  console.log(`Total tool calls: ${tool_calls.length}`);

  // Tool breakdown
  const tool_stats = args.since
    ? calls_in_range(tool_calls, `${args.since}T00:00:00.000Z`, "9999-12-31T23:59:59.999Z")
    : calls_per_tool(tool_calls);

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
        `  ${pad_right(stat.tool_name + ":", max_name_len + 1)}  ${pad_right(String(stat.total_calls) + " calls", 12)} (avg ${stat.avg_duration_ms}ms${failures})`,
      );
    }
  }

  // Recent sessions
  const recent = recent_sessions(sessions, tool_calls, 5);
  if (recent.length > 0) {
    console.log(`\nRecent sessions (last ${recent.length}):`);
    for (const s of recent) {
      const client = s.client_name
        ? `${s.client_name}@${s.client_version}`
        : "unknown-client";
      const timestamp = s.started_at.slice(0, 16);
      console.log(
        `  ${s.session_id.slice(0, 8)}  ${timestamp}  ${pad_right(client, 22)} ${pad_right(s.project_path, 30)} ${s.call_count} calls`,
      );
    }
  }
}

main();
