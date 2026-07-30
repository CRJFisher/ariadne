---
id: TASK-375.1
title: "Bind the grammatical positions the binder silently drops"
status: To Do
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-375
priority: high
ordinal: 1000
plan_dedup_keys:
  - 3c4b1416115b747f98cb1f5070bdcf22b03e6ae52c8fdfd799a0ef5dee4f7db5
plan_source_tasks:
  - pt-86703d8e2f4229d8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

The scope map is starved of names the source clearly binds. `const f = (p) => { p.m() }`, `const f = function (p) { … }`, `return function (p) { … }`, `module.exports = function (p) { … }` and `{ meth(p) { … } }` produce **no** parameter binding at all; `for (const a of xs) { a.m() }` produces none; `const { c } = o` / `const [d] = xs` produce one binding literally named `{ c }` / `[d]`; `function f({ g }: T)` produces none; Rust `if let Some(b) = o` and `match o { Some(d) => … }` produce none and `while let Some(c) = it.next()` produces a binding named `Some(c)`; Python `if (d := xs[0]):` produces none.

The JS/TS mechanism is an **id-agreement bug**. `handle_definition_parameter` (`capture_handlers.javascript.ts:273`) computes the owning callable with `find_containing_callable` (`symbol_factories.javascript.ts:185`), which returns `anonymous_function_symbol(node_location)` for any arrow or function expression with no `name` field, while the function _definition_ for `const f = (p) => …` is minted from the declarator name as `function_symbol('f', name_location)`. The ids never match, so `DefinitionBuilder.add_parameter_to_callable` (`definition_builder.ts:525`) finds no owner and **silently returns `this`**. Parameters reach the registry only through `extract_all_parameters` (`project/extract_parameters.ts:12`), which reads `signature.parameters`, so a dropped parameter is invisible for the rest of the pipeline. The loop, destructuring and Rust pattern gaps are query gaps.

## Work plan

1. **Land alone first.** Make `add_parameter_to_callable` (`definition_builder.ts:525`) **throw** on the fall-through instead of returning `this` — a parameter with no owning callable is an internal inconsistency, and the silence is why this went unnoticed. Run the full core suite and record every construct that trips it. That list is the worklist for the rest of this task and will include constructs beyond the measured five (getters/setters, class static blocks, decorators, TS overload signatures, Python lambdas); if it is long, split step 2 per construct.
2. Make `find_containing_callable` (`symbol_factories.javascript.ts:185`, `symbol_factories.typescript.ts:679`) mint the same id the definition builder used. When an `arrow_function` / `function_expression` has no `name` field, walk to the parent: a `variable_declarator` gives `function_symbol(declarator_name)`, a `pair` gives the property name, an `assignment_expression` whose left is a member expression gives its property name. Fall back to `anonymous_function_symbol` only when none applies. JS first, then TS; separate commits.
3. Add `(for_in_statement left: (identifier) @definition.variable)` beside the existing nested-pattern form (`javascript.scm:253`, `typescript.scm:488`) — `javascript.scm:253` requires a _nested_ identifier, so `for (const a of xs)` matches nothing today. One production covers `for…of` and `for…in`.
4. Replace the whole-pattern captures (`javascript.scm:151`/`:155`, `typescript.scm:357`/`:361`) with per-identifier captures over `shorthand_property_identifier_pattern`, `pair_pattern value:`, array elements and `rest_pattern` — the `@definition.import.require` patterns at `javascript.scm:292`/`:304` show the shape — and give destructured **parameters** (`formal_parameters` containing `object_pattern` / `array_pattern`) the same treatment, which `javascript.scm:233` misses.
5. In `rust.scm`, bind pattern identifiers as definitions: `match_arm` patterns (`:75`, today captured only as `@reference.variable`); the `tuple_struct_pattern` / `struct_pattern` / `tuple_pattern` forms beside the bare-identifier `let_condition` case (`:428`); and the inner identifiers of a `while let` pattern rather than the whole `(_)` (`:422`).
6. In `python.scm`, add `(named_expression name: (identifier) @definition.variable)` for the walrus.
7. Expect no change to `scopes/extractors/javascript_typescript_scope_boundary_extractor.ts`: measured scope ranges already start at the parameter list for arrows (`:196`) and named function expressions (`:117`), so parameters fall inside the right scope once minted. Its 312-line test must not need editing — if it does, the diagnosis was wrong.
8. Add `build_index_single_file` inline tests: `signature.parameters` is exactly the typed literal list (`toEqual`) for `const f = (p) => {}`, `const f = function (p) {}`, `return function (p) {}`, `module.exports = function (p) {}` and `obj = { m(p) {} }`, while the `anonymous_function_symbol` fallback still applies to a genuinely anonymous IIFE; `for…of`, `for…in`, object-pattern, array-pattern, rest-pattern and destructured-parameter bindings assert by name; Rust `if let Some(b)`, `match … Some(d) =>` and `while let Some(c)` bind `b` / `d` / `c` and **not** `Some(c)`; the Python walrus binds. `definition_builder.test.ts` asserts `add_parameter_to_callable` throws for an unknown callable id.
9. Add `Project`-level integration tests reproducing **each** evidence case in this task's triage evidence, not one representative: webpack `lib/ids/IdHelpers.js:148` — `chunkGraph.getChunkRootModules(chunk)` inside `const getShortChunkName = (chunk, chunkGraph, …) => {…}`, whose arrow scope holds only the local `const modules`; mocha `lib/interfaces/common.js:75` — `suites[0].beforeEach(name, fn)` inside `module.exports = function (suites, context) {…}`, whose scope holds only `<anonymous>`; the loop-head shape `for (const p of ps) { p.close() }` that closes the re-homed pattern/loop-head rows; the destructured-declarator, destructured-parameter, Rust `if let` / `match` / `while let` and Python walrus shapes from the table above.
10. Re-run triage on the four affected JS/TS/Python projects after this lands rather than predicting the per-row split of the 39 qualified-callee rows: only two were reproduced from source, and the rest carry `name_not_in_scope` so they are binder or module-surface failures by construction.

## Reading the result

For untyped JS parameters the failure moves **forward** from `name_resolution/name_not_in_scope` to `type_inference/receiver_type_unknown` and those members re-route to `type-model-completion`. That is the expected outcome. Measure bucket movement, not flag count. Rows whose narrative describes polymorphic dispatch, getter reads, attribute-chain typing, lambda callbacks or `import_string` / `runpy.run_path` / click CLI dispatch may stay flagged and must not be read as regressions. The nest `ExternalContextCreator.create` row is excluded outright — its evidence states the repo contains no caller, only a DI registration, so it is a true entry point.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `add_parameter_to_callable` throws for an unknown callable id and `definition_builder.test.ts` asserts it; the full core suite is run against the throwing version and every construct that trips it is recorded.
- [ ] #2 `signature.parameters` matches the exact asserted literal for `const f = (p) => {}`, `const f = function (p) {}`, `return function (p) {}`, `module.exports = function (p) {}` and `obj = { m(p) {} }`, and the `anonymous_function_symbol` fallback still applies to a genuinely anonymous IIFE.
- [ ] #3 `for (const a of xs)`, `for (const k in o)`, `const { c } = o`, `const [d] = xs`, `const { ...r } = o` and `function f({ g }: T)` each bind by name in both JavaScript and TypeScript.
- [ ] #4 Rust `if let Some(b)`, `match o { Some(d) => … }` and `while let Some(c) = it.next()` bind `b`, `d` and `c` and never `Some(c)`; the Python walrus `if (d := xs[0]):` binds `d`.
- [ ] #5 The webpack `lib/ids/IdHelpers.js:148` (`chunkGraph.getChunkRootModules`) and mocha `lib/interfaces/common.js:75` (`suites[0].beforeEach`) false-positives clear.
- [ ] #6 The loop-head evidence case `for (const p of ps) { p.close() }` resolves, closing the re-homed pattern/loop-head rows.
- [ ] #7 Integration tests cover every evidence case in this group's triage evidence individually — the two reproduced corpus rows plus each source form in the binder table — and not a single representative.
- [ ] #8 `javascript_typescript_scope_boundary_extractor.test.ts` (312 lines) needs no editing.
- [ ] #9 Triage is re-run on the four affected JS/TS/Python projects and the per-row split of the 39 qualified-callee rows is recorded as measured bucket movement, with rows that move to `type_inference/receiver_type_unknown` re-routed to `type-model-completion` rather than counted as failures.

<!-- AC:END -->
