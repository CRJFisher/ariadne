---
id: TASK-190.17.7
title: "MCP `list_entrypoints`: add `show_suppressed` flag and rewrite test fixtures"
status: To Do
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

Surface the new classification through the MCP server. Default output stays minimal (clean true-positive list, same format as today). Adding one optional flag exposes the suppressed bucket for triage workflows.

## Schema change

```ts
// packages/mcp/src/tools/core/list_entrypoints.ts
list_entrypoints_schema = z.object({
  files: z.array(z.string()).optional(),
  folders: z.array(z.string()).optional(),
  include_tests: z.boolean().optional().default(false),
  show_suppressed: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Append a section listing entry points Ariadne suppresses as known false positives. Use for triage."
    ),
});
```

When `show_suppressed: true`, append a clearly delimited "Suppressed" section listing each FP with its `[group_id: framework]` tag.

## File touches

- `packages/mcp/src/tools/core/list_entrypoints.ts:251,258,263` — call `project.get_classified_entry_points()` when `show_suppressed: true`; otherwise stick with the simple `get_call_graph()` path.
- `packages/mcp/src/tools/core/list_entrypoints.test.ts` — rewrite ~10 `CallGraph` literal fixtures (lines 77, 123, 171, 280, 332, 373, 422, 463, 537, 587). Three test-filter tests change semantics because filtering moves from MCP to core (lines 433-475, 477-555, 557-598). Add new tests for `show_suppressed: true` covering: dunder protocols, framework-invoked entries, mixed default + suppressed output.
- `packages/mcp/src/tools/core/list_entrypoints.e2e.test.ts` — extend the existing `include_tests` count tests; add a snapshot for `show_suppressed` output on a real codebase.
- `packages/mcp/src/tools/core/show_call_graph_neighborhood.ts:519,544` — same access pattern; only mechanical update if `CallGraph` type signature changed in `.6`.
- `packages/mcp/src/tools/core/show_call_graph_neighborhood.test.ts` — ~30+ `CallGraph` literals (mechanical update).

## Verification

- `pnpm test` passes in `packages/mcp/`.
- `mcp-headless-test` skill: run `list_entrypoints` against a Flask fixture; confirm default output excludes `@app.route` handlers; `show_suppressed: true` reveals them.
- E2E test added that asserts the `[group_id: framework]` tag format.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 list_entrypoints schema gains show_suppressed: boolean (default false)
- [ ] #2 Default output unchanged in shape; only true-positive entries listed
- [ ] #3 show_suppressed: true output appends a clearly delimited 'Suppressed' section with [group_id: framework] tags
- [ ] #4 list_entrypoints.test.ts ~11 CallGraph fixtures updated to new types
- [ ] #5 Three test-filter tests retargeted to reflect filtering happening in core
- [ ] #6 New tests cover dunder protocol, framework-invoked, mixed default+suppressed output
- [ ] #7 list_entrypoints.e2e.test.ts include_tests count assertions updated; show_suppressed snapshot added
- [ ] #8 show_call_graph_neighborhood.ts + test updated for the new CallGraph shape (mechanical)
- [ ] #9 mcp-headless-test skill verifies the Flask-fixture default-clean / show-suppressed flow
- [ ] #10 pnpm test passes in packages/mcp
- [ ] #11 Risk 4 mitigation: capture a classification snapshot in list_entrypoints.e2e.test.ts BEFORE the filtering moves from MCP to core, so any subtle filter-semantics drift surfaces as a snapshot diff
<!-- AC:END -->
