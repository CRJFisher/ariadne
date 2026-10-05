---
id: TASK-376.9
title: "Widen construction and initialiser capture across the four languages"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - collection_dispatch
dependencies:
  - TASK-376.17
parent_task_id: TASK-376
priority: high
ordinal: 9000
plan_dedup_keys:
  - f7a37bafb576bff500164bbfc4fc84a69a8fcb0bc6c33ac9298c889c9bb26634
plan_source_tasks:
  - pt-25d1e425201ddf9f
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 10. Wave 4, beside TASK-376.7 and TASK-376.10; shares `registries/type.ts` (STEP 1.5) with TASK-376.7 and `packages/types/src/symbol_definitions.ts` with it, in different members. Requires TASK-376.17 (STEP 1.5 is widened on the split store and resolves through TASK-376.6's `resolve_annotation`).

## Root cause

Rust struct-literal and `Cursor::new()` construction and inline chains already resolve; the real gaps are elsewhere. `construct_target_node` (`metadata_extractors.javascript.ts:299-329`, memoised per ancestor via `CONSTRUCT_TARGET_BY_ANCESTOR` at `:305-309` / `:325-327`, wrapped by `extract_construct_target` at `:455-461`) walks upward to a `variable_declarator` (`:313-316`) or `assignment_expression` (`:317-320`) without aborting on an `arguments` ancestor, so a nested `new` in an argument list steals the declarator (`const t = new _Tokenizer(new Src(), s)` binds `t` to `Src`; angular `lexer.ts:116`), and it covers neither class fields nor `this.x = new Y()` (TASK-374.6 item 3). `build_property_chain` (`:214-285`) accepts only `property_identifier` on the member-expression path (`:254-256`), so `this.#tm.getTransaction()` indexes as `["this","getTransaction"]` while the member-index key carries the `#`. `extract_call_initializer_name` (JS `symbol_factories.javascript.ts:522-553`, Rust `symbol_factories.rust.ts:863-891`) records only a bare callee name into `VariableDefinition.initialized_from_call` (`symbol_definitions.ts:265`, a single `SymbolName`), so `const i = s.getInfo()` is unrecoverable; and `symbol_factories.python.ts` has no initialiser extractor at all (only `extract_collection_source` at `:851-901`), which is why `TypeRegistry` STEP 1.5 (`type.ts:199-223`) has never fired for Python.

## Work plan

1. Replace `extract_call_initializer_name` (JS `:522-553`, Rust `:863-891`) with `extract_initializer_call(node): { property_chain: readonly SymbolName[] } | undefined` carrying the full callee chain, and change `initialized_from_call` (`symbol_definitions.ts:265`) to `readonly SymbolName[]` — `s.getInfo` → `["s", "getInfo"]`, the bare name being the length-1 case, keeping `name_resolution.ts:295-315`'s self-initializer rule (`is_self_initializer`, `:387-397`) working off the last segment.
2. Add the initialiser-call extractor to `symbol_factories.python.ts`, plus `extract_collection_source_key` parity with `symbol_factories.javascript.ts:699-716`; add `member_source?: { holder: SymbolName; member: SymbolName }` to `VariableDefinition` and drop `collection_source_key`'s `@language javascript,typescript` restriction (`:257-264`). Pass `initialized_from_call` and `member_source` through `capture_handlers.python.ts:478-490` to `builder.add_variable` alongside `collection_source`.
3. Widen `construct_target_node` (`:299-329`): abort the upward walk on an `arguments` ancestor — and memoise the abort, since the ancestor cache answers every later `new` under the same ancestor; additionally cover `field_definition` / `public_field_definition` and a `member_expression` assignment target rooted at `this`, keyed to the **property definition's** location so `definitions.get_symbol_at_location` finds it in STEP 1.
4. Make `build_property_chain` (`:254-256`) accept `private_property_identifier` beside `property_identifier`, pushing the `#`-prefixed text so the segment matches the member-index key.
5. Widen `TypeRegistry` STEP 1.5 (`:199-223`): relax the `function_def.kind !== "function"` guard (`:211`) to `function | method | constructor`, read the initialiser call chain, and route the return annotation through `resolve_annotation`, so `-> type[_HtmlFrameParser]` carries a class-object head that TASK-376.11 reads as `class_object`.
6. Extend JSDoc consumption to a `/** @type {X} */` block preceding `this.X = …` in a constructor and one preceding a local declarator. There are two `extract_jsdoc_type`s: the string-based one in `symbol_factories/jsdoc_extraction.javascript.ts:19-25` (with `find_preceding_jsdoc` at `:34-56`) and the node-based one in `metadata_extractors.javascript.ts:31-54`, which reads exactly one preceding sibling. Give both positions one reader; `@param {T} name` already works end to end.
7. Add `build_index_single_file` inline tests: `this.#tm.getTransaction()` yields `property_chain: ["this","#tm","getTransaction"]`; `const t = new Outer(new Inner(), x)` yields exactly one construct target, bound to `Outer`; a class-field initialiser and `this.x = new Y()` return the property definition's location; `initialized_from_call` is `["s","getInfo"]` for `const i = s.getInfo()` and `["inject"]` for `inject(Router)`, in JS, Rust and Python; `orig = BaseTask.__call__` records `member_source`.
8. Add integration tests at the `Project` tier (fixtures under `tests/fixtures/{javascript,typescript,python}/code/integration/`) covering every evidence case for this step: angular `lexer.ts:116` (`const t = new _Tokenizer(new Src(), s)` binding `t` to `_Tokenizer`); a JS/TS class field and `this.x = new Y()` receiver resolving (TASK-374.6 item 3 closes here); webpack's `this.#tm.getTransaction()`; a variable initialised from a _method_ call (`const i = s.getInfo(); i.m()`); the Python factory chain `def make() -> type[Parser]` then `p = make()(…)` and pandas' `parser = _parser_dispatch(flav); parser.read()`; and a JSDoc `/** @type {X} */` on both `this.X = …` and a local declarator.
9. Verify the Python `initialized_from_call` activation against django, pandas, celery and sqlalchemy with TASK-376.16's taxonomy harness before landing — it can only add types where none existed, but a wrong declared return type now propagates.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `initialized_from_call` carries the full callee chain in JS, Rust and Python, and Python has an initialiser-call extractor and `member_source` capture.
  Evidence: `VariableDefinition.initialized_from_call: readonly SymbolName[]` and `member_source: { holder, member }`, written by `extract_initializer_call` / `extract_member_source` in `symbol_factories.{javascript,python,rust}.ts`. `index_single_file.{javascript,python,rust}.test.ts` pin `["s","getInfo"]` / `["s","get_info"]`, `["inject"]`, `["self","inner","get"]`, and `orig = BaseTask.__call__` → `{ holder: "BaseTask", member: "__call__" }`.
- [x] #2 A nested `new` in an argument list no longer steals the declarator (angular `lexer.ts:116` binds to `_Tokenizer`); class fields and `this.x = new Y()` produce construct targets keyed to the property definition's location; the ancestor memo stays correct under the abort.
  Evidence: `index_single_file.javascript.test.ts` › "Construction and initialiser capture" (exactly one target for `new Outer(new Inner(), x)`; field, `#field`, declared and constructor-declared `this.x` targets equal the property locations); `index_single_file.typescript.test.ts` › "Construction capture" (fields and constructor parameter properties); `type.integration.test.ts` › angular lexer case.
- [x] #3 `this.#tm.getTransaction()` produces the `#`-prefixed chain segment and resolves against the member index.
  Evidence: inline chain tests in JS and TS; `type.integration.test.ts` › webpack `Compilation` fixture resolves `getTransaction`.
- [x] #4 STEP 1.5 fires for methods and constructors and for Python, with `type[X]` returns carrying the class-object head.
  Evidence: STEP 1.5 resolves the callee chain to a function or method; a constructor definition declares no return annotation (a class call is a construction, typed by STEP 1). `type.integration.test.ts` › Python `html.py` fixture (bare factory, `engine.connect()`, `self.connect()`), `type[_HtmlFrameParser]` recorded as head `type` with argument `[_HtmlFrameParser]` and no instance type, and a `-> _T` TypeVar return that types nothing.
- [x] #5 JSDoc `@type` is consumed for `this.X = …` in a constructor and for a local declarator.
  Evidence: one reader in `jsdoc_extraction.javascript.ts`; `symbol_factories.javascript.test.ts` › `extract_jsdoc_type`; `type.integration.test.ts` › `jsdoc_types.js` fixture resolves both positions.
- [x] #6 Integration tests cover all of this step's evidence cases: angular `lexer.ts:116`, JS/TS class fields and `this.x = new Y()`, webpack `#`-private chains, method-call initialisers, the pandas `_parser_dispatch` chain, `def make() -> type[Parser]`, and both JSDoc `@type` positions.
  Evidence: `type.integration.test.ts` › "constructions and call initialisers" over `tests/fixtures/{typescript,javascript,python}/code/integration/initialiser_capture/`, plus a cross-file method-call initialiser loaded in both orders.
- [x] #7 The four Python corpora are re-run with the taxonomy harness and no wrong declared-return-type propagation is introduced.
  Evidence: django, pandas, celery and sqlalchemy were indexed on the base tree and on this tree and every call reference diffed (a per-call superset of the taxonomy count). No call lost a target in any corpus. Calls resolved: celery +4, sqlalchemy +84, pandas +2,150, django 0; no recorded value type names a non-type definition. The audit found one wrong propagation — a return annotation naming a `TypeVar` or a `Union` alias variable (`-> _T`, `-> ArrayLike`) recorded as the value's type — fixed by guarding STEP 1.5 with `names_a_type` as STEP 1 and STEP 1.2 already were.

<!-- AC:END -->

## Implementation notes

- **Callee chains.** `initialized_from_call` is the callee chain, root first, in JS/TS, Rust and Python; a callee that is not a name chain (`make()(…)`, `a[k]()`, a Rust `::` path) records none. Name resolution's self-initializer carve-out applies to a one-segment chain only: a member call's last segment is never looked up in scope, and `let x = x.unwrap()` is followed by uses of the new binding.
- **`member_source` replaces `collection_source_key`.** The keyed alias fact was the same holder/member pair, so one field carries it for every language and collection dispatch reads its `member`. Python records it for TASK-376.11's qualified-member-read producer.
- **STEP 1.5.** The callee resolves from a self receiver (through `resolve_self_type`, which the project hands in as `find_self_type`, since registries never import call resolution), a type's static member, a module import's member, or the type already recorded for a value this file declares. Members come from `DefinitionRegistry.get_member_closure`. A value another file declares is not followed, so the answer is independent of resolution order; a both-orders cross-file test pins it. The recorded type must `names_a_type`.
- **Construction targets.** `construct_target_node` stops at an `arguments` ancestor (memoised), and types class fields and `this.x` writes at the field definition's name node. `this_field_write.javascript.ts` answers which field a write addresses: a body member, a TypeScript parameter property, or — in JavaScript — the field a constructor write declares (`@definition.field.assigned`) when the body declares none. Declared members are collected once per class body, and the builder dedupes inferred properties through a name index, so a class with many writes indexes in linear time.
- **Initialiser sources.** `symbol_factories/initializer_sources.{javascript,python,rust}.ts` hold everything a variable's initialiser names — `extract_collection_source`, `extract_member_source`, `extract_initializer_call` — with their tests beside them; `symbol_factories.python.ts` had outgrown the 32 KB tree-sitter file limit with them inline.
- **JSDoc.** `find_preceding_jsdoc` sits behind `extract_jsdoc_type` / `extract_jsdoc_return_type`, which anchor at the declaration statement; the metadata extractor, `extract_property_type` and the JS variable handler all read through them.
- **Found, left to their owners.**
  - `find_self_type` binds `this` inside a plain `function` nested in a method to the class (pre-existing in call resolution; STEP 1.5 follows the same rule).
  - A dropped subscript in a receiver chain (`df[c].explode()` → `DataFrame.explode`) is pre-existing and more often exposed now that more values carry types — TASK-376.10.
  - JS methods typed only by JSDoc `@returns` carry no `return_type`, so a method-call initialiser on them stays untyped.
  - Python `self.x = make()` attributes take no initialiser type — TASK-376.11.
  - `p = make()(io)` and `parser(io)` on a class object resolve in TASK-376.11.
  - `definition_builder.ts` sits 5 bytes under the 32 KB limit and needs splitting before it grows again.
