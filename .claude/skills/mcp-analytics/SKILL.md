---
description: Check Ariadne MCP tool usage analytics — session counts, tool call stats, durations, and error rates.
user_invocable: false
---

# MCP Analytics

Query Ariadne MCP tool usage analytics from JSONL files.

## When to Use

Use when the user asks about MCP tool usage, session history, or analytics (e.g., "check my MCP analytics", "how many tool calls today", "show recent MCP sessions").

## How to Use

Run the analytics CLI:

```bash
npx tsx packages/mcp/src/scripts/ariadne_analytics.ts
```

For time-filtered results:

```bash
npx tsx packages/mcp/src/scripts/ariadne_analytics.ts --since 2026-02-17
```

For per-session detail:

```bash
npx tsx packages/mcp/src/scripts/ariadne_analytics.ts --session <session-id>
```

The data directory defaults to `~/.ariadne/analytics/`. Override with `ARIADNE_ANALYTICS_DIR` env var.

## Interpreting Results

- **Total sessions**: Number of MCP server process startups with analytics enabled
- **Total tool calls**: Aggregate count across all sessions
- **Calls by tool**: Breakdown showing call count, average duration, and failure count per tool
- **Recent sessions**: Last N sessions with client info, project path, and call count

High failure counts or increasing average durations indicate performance issues worth investigating.

## Optional: SQLite Import

The JSONL files can be converted to CSV and imported into SQLite for ad-hoc queries:

```bash
cd ~/.ariadne/analytics
jq -r '[.session_id, .started_at, .project_path, .client_name, .client_version] | @csv' sessions.jsonl > sessions.csv
jq -r '[.session_id, .tool_name, .called_at, .duration_ms, .success, .error_message, .arguments, .request_id, .tool_use_id] | @csv' tool_calls.jsonl > tool_calls.csv
sqlite3 analytics.db ".mode csv" ".import sessions.csv sessions" ".import tool_calls.csv tool_calls"
```
