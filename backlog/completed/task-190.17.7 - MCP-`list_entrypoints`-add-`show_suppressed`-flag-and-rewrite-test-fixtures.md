---
id: TASK-190.17.7
title: "MCP `list_entrypoints`: add `show_suppressed` flag and rewrite test fixtures"
status: Done
assignee: []
created_date: "2026-04-28 19:15"
updated_date: "2026-04-28 19:37"
labels:
  - mcp
  - api-breaking
dependencies:
  - TASK-190.17.6
parent_task_id: TASK-190.17
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

Surface the new classification through the MCP server. Default output stays minimal (clean true-positive list, same format as today). Adding the **server-level** `show_suppressed` config flag exposes the suppressed bucket for triage workflows.

## Configuration model — server-level, not per-call

`show_suppressed` is **not** a per-request tool argument. It lives on the MCP server config (CLI flag / env var) so triage workflows enable it once via `.mcp.json` and everyday agents see the clean default output. The per-call schema stays minimal: `files`, `folders`, `include_tests`.

Resolution precedence (CLI > env > default):
- `--show-suppressed` / `--no-show-suppressed` CLI flag
- `ARIADNE_SHOW_SUPPRESSED` env var (truthy: `1`, `true`, `yes`)
- Default: `false`

When the server is started with `show_suppressed: true`, every `list_entrypoints` call appends a clearly delimited "Suppressed" section listing each FP with a canonical `[label: detail]` tag. The tag format adapts per `EntryPointClassification` kind:

- `framework_invoked` → `[group_id: framework]` (e.g., `[flask-route-decorator: flask]`)
- `dunder_protocol` → `[dunder_protocol: <protocol>]` (e.g., `[dunder_protocol: __str__]`)
- `test_only` → `[test_only]`
- `indirect_only` → `[indirect_only: <via.type>]` (e.g., `[indirect_only: function_reference]`)

## File touches

- `packages/mcp/src/tools/core/list_entrypoints.ts` — add `ListEntrypointsConfig` parameter; call `project.get_classified_entry_points()` when `show_suppressed: true`; render Suppressed section with canonical tags.
- `packages/mcp/src/tools/core/tool_group.ts` — convert `CORE_TOOL_GROUP` const to `create_core_tool_group(config)` factory so the handler closure captures the server-level flag.
- `packages/mcp/src/start_server.ts` — add `show_suppressed?: boolean` to `AriadneMCPServerOptions`; thread it into `create_core_tool_group`.
- `packages/mcp/src/server.ts` — parse `--show-suppressed` / `--no-show-suppressed` CLI flags; add `resolve_show_suppressed` (CLI > env var `ARIADNE_SHOW_SUPPRESSED` > default `false`).
- `packages/mcp/src/tools/core/list_entrypoints.test.ts` — update mocks to include `get_classified_entry_points`; retarget filter tests to reflect filtering happening in core (the mock's `entry_points` reflects post-filter state); add tests for dunder/framework/test_only/indirect_only/mixed; verify schema does NOT carry `show_suppressed`.
- `packages/mcp/src/tools/core/list_entrypoints.e2e.test.ts` — extend `include_tests` count tests as Risk-4 / AC #11 anchor; add a second describe block that spawns a server with `--show-suppressed` and verifies the Suppressed section + canonical tag format.
- `packages/mcp/src/start_server.test.ts` — switch mock from `CORE_TOOL_GROUP` to `create_core_tool_group`; add tests confirming `show_suppressed` threads through `start_server`.
- `packages/mcp/src/server.test.ts` — add tests for `--show-suppressed` / `--no-show-suppressed` CLI parsing and `resolve_show_suppressed` env-var fallback.
- `packages/mcp/src/tools/core/show_call_graph_neighborhood.{ts,test.ts}` — no changes needed; the `CallGraph` shape did not change in `.6` (only entry_points semantics).

## Verification

- `pnpm test` passes in `packages/mcp/` (212 tests).
- `tsc --noEmit` is clean across `packages/{types,core,mcp}`.
- E2E: default server omits the Suppressed section; server spawned with `--show-suppressed` produces the section with canonical `[label: detail]` tags.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 show_suppressed lives on the server config (CLI `--show-suppressed` / env `ARIADNE_SHOW_SUPPRESSED`); the per-call schema does NOT carry it
- [x] #2 Default output unchanged in shape; only true-positive entries listed
- [x] #3 show_suppressed-enabled output appends a clearly delimited 'Suppressed' section with `[label: detail]` tags — `[group_id: framework]` for framework_invoked, `[dunder_protocol: <name>]` for dunder, `[test_only]`, `[indirect_only: <via.type>]`
- [x] #4 list_entrypoints.test.ts CallGraph fixtures and mocks updated to the new types (`get_classified_entry_points` on the mock project)
- [x] #5 Three test-filter tests retargeted to reflect filtering happening in core — MCP just renders what core returns
- [x] #6 New tests cover dunder protocol, framework-invoked, test_only, indirect_only, and mixed suppressed output
- [x] #7 list_entrypoints.e2e.test.ts include_tests count assertions retained as Risk-4 anchor; second describe block spawns a `--show-suppressed` server and asserts canonical tag format
- [x] #8 show_call_graph_neighborhood.ts + test require no update — `CallGraph` type signature did not change in `.6` (only `entry_points` semantics did)
- [x] #9 server.test.ts and start_server.test.ts updated for the new factory + CLI/env-var resolution
- [x] #10 pnpm test passes in packages/mcp (212 tests)
- [x] #11 Risk 4 mitigation: include_tests count comparison retained in e2e as a drift-detection anchor — `with_tests > without_tests` invariant catches differential drift between core's filter and MCP's rendering, even though it is not an absolute snapshot of the pre-migration counts
<!-- AC:END -->
