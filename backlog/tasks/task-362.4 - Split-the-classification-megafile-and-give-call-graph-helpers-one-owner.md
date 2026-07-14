---
id: TASK-362.4
title: "Split the classification megafile and give call-graph helpers one owner"
status: In Progress
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

- [x] `extract_entry_point_diagnostics.ts` contains only the diagnosis core
      and grep-index build; the four extracted files exist with their tests.
- [x] The JS/TS-only definition-feature derivation lives behind the
      `derive_definition_features.ts` marshaller with a `.jsts.ts` leaf; the
      async unindexed-test grep pass is isolated in its own file.
- [x] `build_signature` and `count_tree_size` exist once each, in
      `trace_call_graph/`, with the reconciled signature both core and MCP
      consumers need.
- [~] Row 2 landed (rename + all callers updated); row 18's gate widened with
      a test covering a JS `_transform` subclass; row 34's rationale paragraph
      added. **Rows 16 and 17 are deferred** to a follow-up (see Implementation
      Notes) to avoid colliding with in-flight reconcile-registry work.
- [x] Row 19 handed off: the human-runnable `reconcile-registry` route is
      recorded in this task's notes; `registry.json` untouched by this task.
- [~] In-scope suite green (core 3319 passed; mcp 228 passed; new/changed
      files green). `permanent_data.sync.test.ts` remains red for a
      pre-existing reason unrelated to this task (deferred row 17 + in-flight
      registry drift) — it clears when the deferred rows land.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The Stage-3 classification subsystem no longer routes every failure into one
867-LOC file. `extract_entry_point_diagnostics.ts` now holds only the diagnosis
core and the single-pass grep-index build; each tangled responsibility it used
to co-host lives in its own named module, and the two call-graph metrics it
borrowed are owned by the stage that owns `CallGraph`.

**The split (`classify_entry_points/`).** Three concerns moved out as siblings:

- `derive_syntactic_features.ts` — composes call-site `SyntacticFeatures` from a
  `CallReference` plus the source line.
- `derive_definition_features.ts` — a neutral language marshaller
  (`switch (language)`) that routes TypeScript/JavaScript to
  `derive_definition_features.jsts.ts` (the accessor + object-literal-method
  leaf) and returns the neutral `{ definition_is_object_literal_method: false,
  accessor_kind: null }` for every other language. The single `.jsts.ts` leaf
  serves both JS and TS because they share one grammar for these constructs.
- `attach_unindexed_test_grep_hits.ts` — the one FS-touching diagnostic, lifted
  out so the diagnosis core is synchronous and free of I/O. It carries
  `collect_unindexed_test_files`, `build_class_name_by_constructor_position`,
  `UNINDEXED_TEST_DIR_SEGMENTS`, and `UnindexedTestGrepOptions`.

Each new file has its own colocated test; the megafile test kept only the
`build_grep_index` and diagnosis-disambiguator cases. The megafile dropped from
~29 KB to ~19 KB.

**Call-graph helpers (`trace_call_graph/`).** `build_signature` and
`count_tree_size` are re-homed to the stage that owns `CallGraph`, each
reconciled once against MCP's divergent copy:

- `count_tree_size(node_id, call_graph, visited): { resolved, unresolved }` —
  MCP's richer shape subsumes core's `number` (core's old return equals the new
  `.resolved` exactly; verified byte-identical across leaf/direct/cycle/
  unresolved/nested graphs). The core caller destructures `.resolved`.
- `build_signature(definition, location?: SignatureLocation): string` — MCP's
  optional-`location` variant (anonymous callables render as
  `<anonymous@file:line>`). The reconciled version drops core's defensive
  try/catch: `FunctionDefinition.signature` and the parameter arrays are
  required types, so a malformed definition should surface loudly rather than
  silently return `undefined`. All original assertions pass unchanged.

Both are published from core's public barrel (`packages/core/src/index.ts`) so
TASK-362.7 can delete MCP's local copies and import them — a drop-in swap, since
the published signatures match what MCP's copies already expose.

**Ride-along rows.** Row 2: `classify_entry_points.ts` → `auto_classify.ts` (the
registry-walk sub-step; `enrich_call_graph.ts` is the stage face), with its unit
test and the untyped-attribute-receiver integration test renamed to match their
subject and all importers repointed. Row 18: `check_framework-lifecycle-override`
now classifies JavaScript stream subclasses as well as TypeScript (JS
`_transform`/`_flush` never classified before), covered by a new test; the
file's stale "AUTO-GENERATED / do not edit by hand" provenance is corrected —
these builtin checks are bespoke hand-authored classifiers. Row 34: a paragraph
in `builtins/index.ts` records why the classifiers live in core (they run
against `EnrichedEntryPoint` inside `enrich_call_graph`, never crossing the skill
boundary).

### Deferred: Rows 16 and 17

Rows 16 (delete the `registry_permanent.ts` field-unwrap shim) and 17
(`permanent_data.ts` → `registry_permanent_data.ts`, plus the generator and sync
test) are **deferred to a follow-up**. They touch the exact machinery the
in-flight reconcile-registry drift work regenerates through; landing them
concurrently risks a duplicate-file / stale-generator collision. They should
land once that registry work settles. Because row 17 is deferred,
`permanent_data.sync.test.ts` stays red for a reason unrelated to this task (the
committed permanent slice does not yet reflect the committed registry's drift
fields).

### Hand-offs to the human (registry is human-owned; not written by this task)

Two items require a `registry.json` decision and are handed off, not applied:

1. **Row 19** — `check_string-keyed-dispatch.ts` hardcodes
   `new RegExp('/packages/core/src/')`, an Angular project's internal path baked
   into a universal builtin. Fixing it redefines the rule's match pattern, which
   is a registry decision on the human-owned loop-closure surface. The rule
   already carries `drift_detected` in the registry; reconcile it through:

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts --drift --dry-run
   # review the string-keyed-dispatch drift, then apply without --dry-run
   ```

2. **`framework-lifecycle-override` languages metadata** — Row 18 widened the
   builtin to match JavaScript, but the registry entry still declares
   `languages: ["typescript"]`. Runtime classification is unaffected
   (`auto_classify` never reads `issue.languages`), but the metadata should be
   brought in sync when the human next reconciles the registry:

   ```bash
   node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts \
     --id framework-lifecycle-override --dry-run
   # add "javascript" to the entry's languages, then apply
   ```
