---
id: TASK-362.7
title: "MCP — separate boot from logic, split the two four-responsibility tools"
status: Done
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
  - mcp
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Program Area 7 (`backlog/drafts/ia-review.refactor-program.md`). Effort M,
risk low. Depends on TASK-362.4 (imports the shared
`count_tree_size`/`build_signature` from `@ariadnejs/core`).

All verified:

- `packages/mcp/src/server.ts` parses CLI args and then **boots a live
  server at module scope** (`start_server(...).catch(console.error)`,
  L94–100); importing it to test the three pure functions starts a server.
  The real composition root is `start_server.ts` — a naming inversion.
- `tools/core/list_entrypoints.ts` (463 LOC) bundles schema/config, tree
  metrics, signature formatting, and suppressed-entry rendering;
  `tools/core/show_call_graph_neighborhood.ts` (620 LOC) bundles schema,
  symbol-ref parsing, bidirectional traversal, and ASCII rendering. Neither
  routes per-concern. `show_call_graph_neighborhood.ts` also imports
  `build_signature` from a _sibling tool_.
- `analytics/analytics.ts` is a folder-name tautology (forbidden by
  `file-naming.md`) and its write-side `ToolCallRecord` has no compiler link
  to the read-side `ToolCallRow` in `query_stats.ts` — a write-schema change
  silently breaks the reader.

### Target structure

```text
mcp/src/
├── cli.ts                    # bin entry: parse + boot only            (from server.ts)
├── cli_args.ts               # pure parse_cli_args/resolve_* exports   (from server.ts)
├── server.ts                 # the composition root                    (git mv from start_server.ts)
├── analytics/
│   ├── analytics_config.ts   # shared ToolCallRecord + is_analytics_enabled + resolve_analytics_dir
│   ├── session_writer.ts     # write side (from analytics.ts)
│   └── query_stats.ts        # read side, consumes analytics_config
└── tools/core/
    ├── list_entrypoints.ts             # tool + metric only; imports helpers from @ariadnejs/core
    ├── format_suppressed.ts            # classification-tag + suppressed-section rendering
    ├── show_call_graph_neighborhood.ts # tool + renderer
    ├── resolve_symbol_ref.ts           # parse_symbol_ref, paths_match, find_node_by_symbol_ref
    └── traverse_call_graph.ts          # build_callers_index, traverse_callees/callers
```

### Work

Pure splits plus one `git mv`; update `package.json` `bin` to `cli.ts`.
Delete the local `count_tree_size`/`build_signature` copies in the same
commit that switches the imports to `@ariadnejs/core` (they diverged on
arity and return type — TASK-362.4 reconciled the contract).

### Small-item rows owned by this task

- **Row 28** — `git mv tools/tool_registry.ts → register_tools.ts` (one-shot
  registration, not a lookup table); one-line doc for the embedded
  `record_tool_call` analytics edge.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] Importing `cli_args.ts` (or any non-bin module) boots no server;
      `cli.ts` is the only side-effecting entry and `package.json` `bin`
      points at it; `server.ts` is the composition root (renamed via
      `git mv`).
- [x] `list_entrypoints.ts` and `show_call_graph_neighborhood.ts` contain
      only tool wiring + their headline concern; `format_suppressed.ts`,
      `resolve_symbol_ref.ts`, and `traverse_call_graph.ts` own the extracted
      concerns with tests.
- [x] No local `count_tree_size`/`build_signature` definitions remain in
      MCP; both import from `@ariadnejs/core`; no tool imports helpers from
      a sibling tool.
- [x] `ToolCallRecord` is defined once in `analytics_config.ts` and consumed
      by both the writer and `query_stats.ts` (compiler-linked read/write
      schema).
- [x] Row 28 landed; MCP package tests green; the server starts and serves
      the `core` tool group.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The MCP package's boot path and its two largest tools each carried four
unrelated responsibilities, so importing the bin booted a live server and
every concern in the tools had to be tested through the tool's front door.
The package now separates process entry from composition: `cli.ts` is the
only module with a side effect (parse argv, boot) and is what
`package.json`'s `bin` compiles to (`dist/cli.js`); `cli_args.ts` holds the
pure `parse_cli_args`/`resolve_*` functions; `server.ts` is the composition
root exporting `start_server`, re-exported by `index.ts`.

Each tool under `tools/core/` owns only its wiring plus headline concern.
`list_entrypoints.ts` ranks entry points by tree size using
`count_tree_size`/`build_signature` from `@ariadnejs/core` (the local copies
are deleted); `format_suppressed.ts` renders the suppressed bucket;
`show_call_graph_neighborhood.ts` keeps the ASCII renderer and delegates to
`resolve_symbol_ref.ts` and `traverse_call_graph.ts`. `resolve_symbol_ref.ts`
owns the `file_path:line#name` format in both directions — `parse_symbol_ref`
and `build_symbol_ref` — a deliberate widening of the target tree so the
format has one owner. Imports flow strictly tool → helper; the registration
surface itself lives beside them in `tool_group.ts` and
`tools/register_tools.ts` (Row 28 rename).

Analytics is a write/read pair around a shared schema module:
`analytics_config.ts` owns `ToolCallRecord` (write input) and `ToolCallRow`
(persisted row, derived via `Omit` + stamped/nullable fields);
`session_writer.ts` annotates its persisted literal with `ToolCallRow` and
`query_stats.ts` parses into it, so drift on either side is a compile error.

Watch items: `ariadne-analytics` remains a second, deliberate bin
(`scripts/ariadne_analytics.ts`); the package `tsconfig` excludes test files
from `tsc`, so test-only type drift (pre-existing across the suite) is
invisible to CI; in git history the `start_server.ts → server.ts` move
records as delete + modify because the `server.ts` path was simultaneously
vacated by the CLI split.
