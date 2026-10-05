---
id: task-164
title: Investigate VSCode extension for MCP server lifecycle
status: Completed
assignee: []
created_date: '2026-01-25'
labels: [mcp, vscode, investigation]
dependencies: []
priority: Low
---

# Task 164: Investigate VSCode extension for MCP server lifecycle

## Decision: Not Implementing

A VSCode extension for MCP server lifecycle management is **not needed**.

## Rationale

The original motivation was to address MCP server startup performance (~3s to index a medium codebase). A VSCode extension could theoretically keep a long-lived server process running. However, this approach is a red herring:

1. **MCP hosts already manage server lifecycle.** The MCP protocol uses stdio transport where the host (VSCode Claude extension, Claude Desktop, Cursor) spawns and maintains the server process. The server persists across tool calls within a session.

2. **The real question is disk caching, not process management.** If startup time is problematic, the solution is to cache the semantic index to disk in the core Ariadne library - not to add infrastructure around process lifecycle.

3. **A VSCode extension doesn't help other MCP hosts.** Claude Desktop, Cursor, and Continue have no extension model. A VSCode-specific solution fragments the user experience.

4. **Operational complexity outweighs benefits.** Users would need to manage an extension alongside MCP configuration. The current `.vscode/mcp.json` approach works across all hosts with zero additional components.

5. **File watching is already implemented.** The MCP server has built-in file watching via `ProjectManager` + chokidar. Once indexed, the project stays current without re-indexing.

## If Startup Performance Becomes an Issue

The correct approach is disk caching in `@ariadnejs/core`:

1. Serialize semantic index to `.ariadne-cache/` on shutdown
2. Store file mtimes alongside the cache
3. On startup: validate mtimes → load from cache (~100ms) or re-index (~3s)

This works with all MCP hosts and requires no changes to server architecture.

## Acceptance Criteria

- [x] Evaluate if extension would meaningfully reduce friction → **No, it wouldn't**
- [x] Document decision → **Not proceeding; disk caching is the correct optimization if needed**
