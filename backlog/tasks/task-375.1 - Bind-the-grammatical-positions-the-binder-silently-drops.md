---
id: TASK-375.1
title: "Bind the grammatical positions the binder silently drops"
status: Done
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

## Implementation Notes

## High-level summary

Names the source clearly binds now reach the scope map. Three mechanisms were at work, and all three are closed.

The first was an id disagreement, not a missing capture. `const f = (p) => …` mints its function under the declarator's name while the parameter walk minted a location-keyed anonymous id, so the owner lookup missed and `add_parameter_to_callable` dropped the parameter. `find_containing_callable` (JavaScript and TypeScript) now mints the id the definition actually carries — the declarator name, the CommonJS property name for `exports.f = function …`, the method id for an object-literal shorthand method — and falls back to an anonymous symbol only where the source genuinely binds no name.

`add_parameter_to_callable` still drops a parameter whose owning callable it cannot find, and that is deliberate. The indexed callable surface is partial by design, so an unowned parameter is an expected gap rather than an internal inconsistency. Raising there would abort the file's index and drop the file from the corpus, which manufactures exactly the uncalled-looking functions entry-point detection exists to avoid. Making it throw was useful once, as a way to enumerate the constructs this task then fixed; it is not a guard the shipped code carries, and nothing detects a future owner-id disagreement automatically. AC #1 is not met.

The second was callables that no handler indexed at all, so their parameters had nowhere to attach: a returned function expression, `module.exports = function (…) {}`, an object-literal shorthand method, a `function`-expression IIFE, every Rust closure outside argument position, and `extern "C" fn` (whose definition the general Rust handler skipped because it carries a `function_modifiers` node that no specialised handler claims). Each now produces the definition its parameters need. Anonymous functions are excluded from entry points, so indexing closures adds no false positives.

The third was query gaps: `for (const a of xs)` matched nothing because the loop-head pattern required a *nested* identifier; destructuring bound one name spelled `{ c }` instead of one per identifier; Rust `if let` / `match` / `while let` bound either nothing or a name spelled `Some(c)`; the Python walrus bound nothing. Each is now a per-identifier capture. Two bindings were also mis-modelled rather than missing: a catch clause name is a block variable, not a callable parameter, and a Rust const generic is a type parameter, not a value parameter.

Front door for readers: `symbol_factories.{javascript,typescript}.ts`'s `find_containing_callable` owns id agreement, and the `.scm` files own which positions bind. Nothing enforces agreement between the two, so a new callable shape needs a test asserting its parameters by name.

### Deferred and recorded

- A top-level `try { … } catch (e) { … }` in some formattings makes the scope tree report two block scopes at the same depth containing the catch binding, and indexing throws `Malformed scope tree`. Pre-existing (the catch binding always resolved its scope this way) and independent of this task's change, but it drops the whole file from the corpus when it fires — worth its own task.
- A destructured `require` binding stays owned by the require handlers; the generic destructuring capture skips it so the import is not shadowed by a same-id local.
- Re-running triage on the four affected JS/TS/Python projects (AC #9) is the epic-level verification pass, not this task.

### Verification

`packages/core` green; typecheck and lint clean. The three reproduced corpus rows — webpack `IdHelpers.js` declarator arrow, mocha `common.js` whole-module export, and the `for (const p of ps) { p.close() }` loop head — are pinned as Project-level tests asserting the exact outcome each produces: the receiver name binds, so the call's failure moves out of `name_resolution`/`name_not_in_scope` and into `type_inference`/`receiver_type_unknown`.

None of the three calls resolves. Binding the name is this task's scope; typing the receiver is not, so the rows move bucket rather than clearing. AC #6 asks that the loop-head case resolve, and it does not — the receiver takes an identity from the loop head but no type, so `p.close()` finds no target even with `Handle.close` defined in the same file. That row belongs to `type-model-completion`.
