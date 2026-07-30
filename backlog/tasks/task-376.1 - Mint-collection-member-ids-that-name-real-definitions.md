---
id: TASK-376.1
title: "Mint collection member ids that name real definitions"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - collection_dispatch
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 1000
plan_dedup_keys:
  - 39c2e6c069671d09c53bfdd2a668ef10ea5916a500dc3e25a3e5af50baf474e0
plan_source_tasks:
  - pt-90fd46860b8b967c
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 1.

## Root cause

`detect_member_assignment` (`packages/core/src/index_single_file/query_code_tree/symbol_factories/symbol_factories.javascript.ts:706-707`) mints `anonymous_function_symbol(node_to_location(right))` unconditionally, breaking the invariant its own comment states at `:661-662`. For a **named** function expression (`app.engine = function engine(…)`, express `lib/application.js:294`; `app.set = function set(…)`) the definition builder indexes `function:<file>:<name-span>:engine` while the collection records `function:<file>:<value-span>:<anonymous>` — an id that is not in the definition store. Every downstream `FunctionCollection` consumer then reads a phantom member.

## Work plan

1. In `symbol_factories.javascript.ts:706-707`, mint the id the definition builder mints: the value node's `name` field when present, the anonymous span otherwise.
2. Apply the identical rule at the two other mint sites — `extract_functions_from_object`'s `method_definition` branch (`:852`) and its `pair` branch (`:873`).
3. Add `build_index_single_file` inline assertions with `toEqual` against typed literals: `proto.engine = function engine() {}` records the **named** function's `SymbolId`, equal to the id present in `index.functions`; anonymous and arrow members still record the anonymous span; object-literal `pair` and `method_definition` members likewise.
4. Add integration tests (with fixtures under `tests/fixtures/javascript/code/integration/`) covering every evidence case for this step: express `lib/application.js` `app.engine = function engine(…)` and `app.set = function set(…)` resolving to their named definitions in the same file, and the express two-file plus test-file case (`var proto = require('./application'); mixin(app, proto, false)`) where the phantom id is what blocks the mixin propagation measured in §7 step 13.

Standalone with no dependencies; it un-poisons every existing `FunctionCollection` consumer and closes the `entry_point_classification` epic's five-row leaf as a side effect.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Every id recorded in a `FunctionCollection` resolves to an entry in the definition store; no collection member id is absent from `index.functions`.
- [ ] #2 Express's `app.engine` / `app.set` named member-assigned functions are reachable and resolve to their named definitions.
- [ ] #3 Anonymous and arrow member assignments keep recording the anonymous-span id (no behaviour change).
- [ ] #4 Integration tests with JavaScript fixtures cover all of this step's evidence cases: the same-file `proto.engine()` case, the object-literal `pair` and `method_definition` cases, and the express two-file require+mixin case.
- [ ] #5 `collection_dispatch.test.ts` and `method_lookup.test.ts` stay green.

<!-- AC:END -->
