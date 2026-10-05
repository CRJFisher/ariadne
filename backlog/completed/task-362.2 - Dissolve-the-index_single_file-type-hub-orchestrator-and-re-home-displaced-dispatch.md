---
id: TASK-362.2
title: "Dissolve the index_single_file type-hub orchestrator and re-home displaced dispatch"
status: Done
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
  - stage-1-indexing
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Program Area 2 (`backlog/drafts/ia-review.refactor-program.md`). Effort L,
risk medium — the widest import churn in core. Independent starting point;
can run in parallel with TASK-362.1 and TASK-362.5. TASK-362.3's
`index_single_file/references/` slice lands after this task to avoid rebase
churn.

`index_single_file.ts` (379 LOC) has silently become three things besides an
orchestrator (all verified):

- **Shared type hub**: `ProcessingContext` (L269), `CaptureNode` (L289),
  `SemanticEntity` (L301), `SemanticCategory` (L368) are defined in the
  orchestrator and **18 files** across `capture_handlers/`,
  `symbol_factories/`, `scopes/`, `definitions/`, and `references/` import
  their fundamental wire types _upward_ from it — the dependency arrow is
  inverted for the whole stage.
- **Displaced language dispatch**: the `metadata_extractors` dispatch
  (`get_metadata_extractors`, L185) lives in the orchestrator instead of an
  in-folder marshaller; the `reset_*_documentation` enumeration (imports
  L49–51, calls L138–140) reaches two folder levels down into three
  `symbol_factories.{lang}.ts` leaves by hand — a new-language author who
  misses the reset call ships silent cross-file doc contamination.
- Downstream, `symbol_factories.{lang}.ts` (835–993 LOC each) mix ~10
  responsibilities; JS lacks the `imports.javascript.ts` split Python and
  Rust already have; `symbol_factories.rust.ts:26` imports
  `DefinitionBuilder` from pass-3 `definitions/` — the stage's only
  pass-boundary-crossing runtime edge.

### Target structure

```
index_single_file/
├── index_single_file.ts                 # orchestrator ONLY
├── capture_types.ts                     # CaptureNode, SemanticCategory, SemanticEntity   (NEW)
├── scopes/
│   ├── processing_context.ts            # ProcessingContext — sited where it is built     (NEW)
│   └── scope_lookup.ts                  # was utils.ts (row 4)
├── query_code_tree/
│   ├── metadata_extractors/
│   │   ├── metadata_extractors.ts       # in-folder marshaller                            (NEW)
│   │   └── metadata_extractor_types.ts  # was types.ts; live MetadataExtractors + ReceiverInfo
│   └── symbol_factories/
│       ├── documentation_state.ts       # dispatcher owning reset-per-language            (NEW)
│       ├── documentation_state.{javascript,python,rust}.ts
│       ├── imports.javascript.ts        # parity with imports.python/rust.ts              (NEW)
│       └── test_attributes.rust.ts      # localizes the pass-1→pass-3 edge                (NEW)
└── definitions/
    └── definition_builder.ts            # was definitions/definitions.ts (row 3)
```

### Work

1. Extract `capture_types.ts`; move `ProcessingContext` into `scopes/`;
   update the 18 upward importers in one pass (mechanical; the compiler
   enumerates them).
2. Add the `metadata_extractors.ts` marshaller and the
   `documentation_state.ts` dispatcher; the orchestrator calls
   `reset_documentation_state(language)` once instead of three
   hand-enumerated resets.
3. Split the doc-state machines and JS import helpers out of
   `symbol_factories.{lang}.ts`; extract `test_attributes.rust.ts`.
4. Delete dead types (`symbol_factories/types.ts` `SymbolCreationContext`;
   `metadata_extractors/types.ts` `ExtractionResult`/`NodeTraversal`/
   `ExtractionContext` — all zero-consumer, verified); `git mv` the surviving
   `metadata_extractors/types.ts` → `metadata_extractor_types.ts`;
   complete-or-remove the vestigial `definitions/` and `symbol_factories/`
   barrels.

After this task, five of the ten stage-1 Go touch points currently
hand-enumerated in neutral files become discoverable dotted slots.

### Small-item rows owned by this task

- **Row 3** — `git mv definitions/definitions.ts → definition_builder.ts`;
  group the 4 Rust-only + 1 Python-only methods under labelled sections.
- **Row 4** — `git mv scopes/utils.ts → scope_lookup.ts`; dedupe
  `find_root_scope` and the location-geometry predicates duplicated with
  `scopes.ts`.
- **Row 20** — `query_code_tree/capture_handlers/types.ts` →
  `handler_types.ts`.
- **Row 21** — `capture_handlers/loop_variable_handlers.python.ts` →
  `control_flow_variable_handlers.python.ts` (also handles `except…as`,
  `with…as`).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] `index_single_file.ts` defines no types and imports nothing from
      `symbol_factories.{lang}.ts` leaves; it calls one
      `reset_documentation_state(language)` dispatcher.
- [x] Zero files import `CaptureNode`/`ProcessingContext`/`SemanticEntity`/
      `SemanticCategory` from `index_single_file.ts` (compiler-verified after
      the move).
- [x] `symbol_factories.rust.ts` no longer imports from `definitions/`; the
      pass-1→pass-3 edge lives in `test_attributes.rust.ts`.
- [x] `imports.javascript.ts` exists in parity with the Python/Rust
      siblings.
- [x] Dead types deleted; rows 3, 4, 20, 21 landed as `git mv` renames with
      tests moved in the same commits.
- [x] Full core test suite green; no vestigial barrels remain in the stage.

<!-- AC:END -->

## Implementation Notes

## High-level summary

Stage-1 indexing had grown an inverted dependency arrow: the pipeline
orchestrator, `index_single_file.ts`, defined the stage's shared wire types,
so sixteen files across every pass imported upward into the module that is
supposed to sit on top of them, and the orchestrator also hand-carried two
pieces of language dispatch that belong inside the folders that own them.
This task restores the arrow's direction and makes the language touch points
discoverable dotted slots.

The wire types now live at the bottom of the stage. `capture_types.ts`
(stage root) owns `CaptureNode`, `SemanticCategory`, and `SemanticEntity`;
`scopes/processing_context.ts` owns `ProcessingContext`, sited beside the
`create_processing_context` builder that constructs it. Every pass imports
these downward or sideways; the orchestrator's only remaining type is
`SemanticIndex`, its own output contract. Language dispatch is in-folder:
`metadata_extractors/metadata_extractors.ts` marshals the per-language
extractor sets, and `symbol_factories/documentation_state.ts` dispatches one
`reset_documentation_state(language)` call over per-language state modules
(`documentation_state.{javascript,python,rust}.ts`, TypeScript sharing the
JavaScript store), each owning its pending-documentation map and accessors
outright — a new language adds one dotted leaf and one switch arm instead of
editing three neutral files. The factory megafiles slimmed accordingly:
`imports.javascript.ts` sits in parity with `imports.rust.ts`, and
`test_attributes.rust.ts` localizes the stage's only pass-1→pass-3 edge (a
type-only `DefinitionBuilder` import for `#[test]`/`#[cfg(test)]` decorator
attachment).

To navigate: start at `index_single_file.ts` (now a pure four-pass
orchestrator), follow types to `capture_types.ts` and
`scopes/processing_context.ts`, and dispatch to the two marshallers. The
rename rows landed as `git mv` (definition_builder.ts, scope_lookup.ts,
handler_types.ts, control_flow_variable_handlers.python.ts,
metadata_extractor_types.ts), so `git log --follow` reaches pre-move
history. Shared test helpers live in `symbol_factories/test_utils.ts` —
test files must import helpers from there, never from a sibling `.test.ts`,
which re-collects that file's suites.

Known spec drifts, verified: `symbol_factories/types.ts` and
`SymbolCreationContext` never existed (deletion was a no-op), and row 4's
`find_root_scope` dedupe had no duplicate to fold — the rename landed alone.
The stage's remaining barrels (`query_code_tree/index.ts`,
`capture_handlers/index.ts`) are live dispatchers, not vestiges.

