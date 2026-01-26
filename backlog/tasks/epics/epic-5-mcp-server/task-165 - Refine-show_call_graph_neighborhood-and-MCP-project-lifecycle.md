---
id: task-165
title: Refine show_call_graph_neighborhood and MCP project lifecycle
status: Completed
assignee: []
created_date: '2026-01-26'
labels: [mcp, call-graph, tooling]
dependencies: [task-163]
priority: Medium
---

# Task 165: Refine show_call_graph_neighborhood and MCP project lifecycle

## Description (the why)

Improve the `show_call_graph_neighborhood` MCP tool and related server lifecycle behavior so that scoped analysis is respected, output is deterministic and de-duplicated, error handling is consistent with MCP semantics, and project loading/watching behavior is configurable and maintainable.

## Acceptance Criteria (the what)

- [x] `show_call_graph_neighborhood` supports optional `files` and `folders` filters with the same semantics as `list_entrypoints`.
- [x] When filters are provided, `show_call_graph_neighborhood` analyzes only the filtered scope and does not include out-of-scope callers/callees.
- [x] Call graph neighborhood output is deterministic across runs:
  - [x] Traversal output is stable-ordered (e.g. sorted by file path, start line, name).
  - [x] Duplicate nodes are not repeated due to multiple call sites or multiple resolutions (unless explicitly required by the tool contract).
- [x] Path matching for `symbol_ref` lookup avoids false positives from suffix matches (relative vs absolute matching remains supported).
- [x] Cycle handling is clear and consistent:
  - [x] Cycles are marked with a cycle indicator (e.g. `[cycle]`).
  - [x] Location formatting requirements are satisfied for displayed nodes (including cycle nodes if the contract requires it).
- [x] Invalid `symbol_ref` input and unresolved callables are surfaced as MCP tool errors (`isError: true`) with clear messages.
- [x] The MCP server exposes CLI flags to control file watching (e.g. `--watch` / `--no-watch`) and documents precedence with `PROJECT_PATH`.
- [x] Project file-loading and ignore behavior is centralized to avoid duplicated directory-walk + ignore logic across `start_server.ts` and `project_manager.ts`.
- [x] Tests cover:
  - [x] Scoped neighborhood behavior (filters prevent out-of-scope nodes).
  - [x] Multiple-resolution calls (polymorphic dispatch / union resolutions) including deterministic ordering and deduping behavior.
  - [x] Error signaling (`isError: true`) for invalid inputs.

## Implementation Plan (the how)

1. Extend `show_call_graph_neighborhood_schema` to accept optional `files` and `folders` filters.
2. Update `start_server.ts` to route `show_call_graph_neighborhood` requests through a scoped `Project` when filters are present, mirroring `list_entrypoints`.
3. Tighten `symbol_ref` lookup path matching using a project-root-relative normalization strategy (avoid suffix-only `endsWith` matches).
4. Add deterministic ordering and deduping to traversal output, and codify the contract for how multiple resolutions are represented.
5. Convert parse/lookup failures in `show_call_graph_neighborhood` into thrown errors so MCP responses correctly set `isError: true`.
6. Add CLI parsing for watch control flags and ensure `start_server({ watch })` honors them.
7. Refactor shared file loading / ignore logic into a single helper module used by both `start_server.ts` and `project_manager.ts`.
8. Add unit/integration tests for scoped neighborhoods, multiple resolutions, ordering/deduping, and error signaling.
