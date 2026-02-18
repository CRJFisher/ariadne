---
description: Check Ariadne MCP tool usage analytics — session counts, tool call stats, durations, and error rates.
user_invocable: false
---

# MCP Analytics

Query Ariadne MCP tool usage analytics from the SQLite database.

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

The DB path defaults to `~/.ariadne/analytics.db`. Override with `ARIADNE_ANALYTICS_DB` env var.

## Interpreting Results

- **Total sessions**: Number of MCP server process startups with analytics enabled
- **Total tool calls**: Aggregate count across all sessions
- **Calls by tool**: Breakdown showing call count, average duration, and failure count per tool
- **Recent sessions**: Last N sessions with client info, project path, and call count

High failure counts or increasing average durations indicate performance issues worth investigating.
