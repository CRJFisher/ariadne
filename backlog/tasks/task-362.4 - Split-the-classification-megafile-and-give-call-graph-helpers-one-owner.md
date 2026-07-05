---
id: TASK-362.4
title: "Split the classification megafile and give call-graph helpers one owner"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
  - stage-3-classification
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Program Area 4 (`backlog/drafts/ia-review.refactor-program.md`). Effort M,
risk low. Depends on TASK-362.1 (which extracts `detect_language` from this
megafile and re-points the 14 builtin imports first). Blocks TASK-362.7 (MCP
deletes its local helper copies and imports from core).

`classify_entry_points/extract_entry_point_diagnostics.ts` (867 LOC,
verified) hosts under one name: the diagnostics core, the grep-index
builder, syntactic-feature derivation, **JS/TS-only** definition-feature
derivation (`is_jsts` gate, L582–602), an async FS-touching unindexed-test
grep pass cohabiting a zero-I/O sync core, plus two unrelated utilities —
`build_signature` (L658) and `count_tree_size` (L694). Meanwhile
`packages/mcp/src/tools/core/list_entrypoints.ts` **re-implements** both
(L88, L147), and the two `build_signature`s have already diverged on arity
and return type. Nothing here routes: "accessor detection wrong on a getter"
and "unindexed-test grep misses a file" both land in this one file by
archaeology only.

### Target structure

```
classify_entry_points/
├── extract_entry_point_diagnostics.ts    # diagnosis core + grep-index build only
├── derive_syntactic_features.ts          (NEW)
├── derive_definition_features.ts         (NEW — neutral marshaller)
├── derive_definition_features.jsts.ts    (NEW — the one legitimate dotted case in this stage)
└── attach_unindexed_test_grep_hits.ts    (NEW — isolates the async/FS lifecycle)

trace_call_graph/
├── count_tree_size.ts                    (NEW — call-graph metric, owned by the stage that owns CallGraph)
└── build_signature.ts                    (NEW — reconciled single signature)
```

### Work

Split file-by-file with tests following. Reconcile the `build_signature`
contract — MCP's optional-location variant subsumes core's one-arg version;
decide the one signature both consumers need. No registry contact; nothing
regenerated. (MCP-side deletion of its copies is TASK-362.7's first commit.)

### Small-item rows owned by this task

- **Row 2** — `git mv classify_entry_points.ts → auto_classify.ts` (it is
  the registry-walk sub-step; `enrich_call_graph.ts` is the stage face).
- **Row 16** — delete `registry_permanent.ts` (22-LOC field-unwrap shim);
  `registry_loader.ts` reads `PERMANENT_REGISTRY_FILE.rules`/
  `.schema_version` directly.
- **Row 17** — `permanent_data.ts` → `registry_permanent_data.ts` (update
  `generate_permanent_data.ts` output path + the sync test).
- **Row 18** — **correctness**: widen
  `check_framework-lifecycle-override.ts`'s `=== "typescript"` gate to
  include `javascript` (JS stream `_transform`/`_flush` subclasses currently
  never classify). Per the program's note, this is a direct code edit — the
  registry row is unchanged — and the same commit reconciles the file's stale
  `Do not edit by hand` provenance header.
- **Row 34** — add the one-paragraph placement rationale to
  `classify_entry_points/builtins/index.ts` (checks run against
  `EnrichedEntryPoint` inside `enrich_call_graph`, which does not cross the
  skill boundary).
- **Row 19** — **hand-off, not self-applied**:
  `check_string-keyed-dispatch.ts` hardcodes
  `new RegExp('/packages/core/src/')` — an Angular project's internal path in
  a universal builtin. Fixing it redefines the rule's match pattern, a
  registry decision on the human-owned loop-closure surface (program
  Decision 6). Print the `reconcile-registry` route for the human; do not
  edit the registry from this task.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `extract_entry_point_diagnostics.ts` contains only the diagnosis core
      and grep-index build; the four extracted files exist with their tests.
- [ ] The JS/TS-only definition-feature derivation lives behind the
      `derive_definition_features.ts` marshaller with a `.jsts.ts` leaf; the
      async unindexed-test grep pass is isolated in its own file.
- [ ] `build_signature` and `count_tree_size` exist once each, in
      `trace_call_graph/`, with the reconciled signature both core and MCP
      consumers need.
- [ ] Rows 2, 16, 17 landed as renames/deletions with all callers updated;
      row 18's gate widened with a test covering a JS `_transform` subclass;
      row 34's rationale paragraph added.
- [ ] Row 19 handed off: the human-runnable `reconcile-registry` route is
      recorded in this task's notes; `registry.json` untouched by this task.
- [ ] Full test suite green; `permanent_data.sync.test.ts` green after the
      row-17 rename.

<!-- AC:END -->
