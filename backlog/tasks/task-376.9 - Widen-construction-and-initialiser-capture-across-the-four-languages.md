---
id: TASK-376.9
title: "Widen construction and initialiser capture across the four languages"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - collection_dispatch
dependencies: []
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

§7 step 10.

## Root cause

Rust struct-literal and `Cursor::new()` construction and inline chains already resolve; the real gaps are elsewhere. `extract_construct_target` (`metadata_extractors.javascript.ts:394-420`) walks upward without aborting on an `arguments` ancestor, so a nested `new` in an argument list steals the declarator (`const t = new _Tokenizer(new Src(), s)` binds `t` to `Src`; angular `lexer.ts:116`), and it covers neither class fields nor `this.x = new Y()`. `build_property_chain` (`:240`) accepts only `property_identifier`, so `this.#tm.getTransaction()` indexes as `["this","getTransaction"]` while the member-index key carries the `#`. `extract_call_initializer_name` (JS `:459-491`, Rust `:762-789`) records only a bare callee name, so `const i = s.getInfo()` is unrecoverable, and Python has no initialiser extractor at all — which is why `TypeRegistry` STEP 1.5 has never fired for Python.

## Work plan

1. Replace `extract_call_initializer_name` (JS `symbol_factories.javascript.ts:459-491`, Rust `symbol_factories.rust.ts:762-789`) with `extract_initializer_call(node): { property_chain: readonly SymbolName[] } | undefined` carrying the full callee chain, and change `MethodDefinition.initialized_from_call` (`packages/types/src/symbol_definitions.ts:263`) to `readonly SymbolName[]` — `s.getInfo` → `["s", "getInfo"]`, the bare name being the length-1 case, keeping `name_resolution.ts:292-305`'s self-initializer rule working off the last segment.
2. Add the initialiser-call extractor to `symbol_factories.python.ts`, plus `extract_collection_source_key` parity with `symbol_factories.javascript.ts:636`; add `member_source?: { holder: SymbolName; member: SymbolName }` to the definition types and drop `collection_source_key`'s `@language javascript,typescript` restriction. Pass `initialized_from_call` and `member_source` through `capture_handlers.python.ts:442-456` to `builder.add_variable` alongside `collection_source`.
3. Widen `extract_construct_target` (`metadata_extractors.javascript.ts:394-420`): abort the upward walk on an `arguments` ancestor; additionally cover `field_definition` / `public_field_definition` and a `member_expression` assignment target rooted at `this`, keyed to the **property definition's** location so `definitions.get_symbol_at_location` finds it in STEP 1.
4. Make `build_property_chain` (`metadata_extractors.javascript.ts:240`) accept `private_property_identifier` beside `property_identifier`, pushing the `#`-prefixed text so the segment matches the member-index key.
5. Widen `TypeRegistry` STEP 1.5 (`registries/type.ts:199-223`): relax the `function_def.kind !== "function"` guard (`:211`) to `function | method | constructor`, read the initialiser call chain, and route the return annotation through `resolve_annotation`, so `-> type[_HtmlFrameParser]` yields a `class_object` value rather than nothing.
6. Extend `jsdoc_extraction.javascript.ts`'s `extract_jsdoc_type` consumption to a `/** @type {X} */` block preceding `this.X = …` in a constructor and one preceding a local declarator (`@param {T} name` already works end to end).
7. Add `build_index_single_file` inline tests: `this.#tm.getTransaction()` yields `property_chain: ["this","#tm","getTransaction"]`; `const t = new Outer(new Inner(), x)` yields exactly one construct target, bound to `Outer`; a class-field initialiser and `this.x = new Y()` return the property definition's location; `initialized_from_call` is `["s","getInfo"]` for `const i = s.getInfo()` and `["inject"]` for `inject(Router)`, in JS, Rust and Python.
8. Add integration tests at the `Project` tier (fixtures under `tests/fixtures/{javascript,typescript,python}/code/integration/`) covering every evidence case for this step: angular `lexer.ts:116` (`const t = new _Tokenizer(new Src(), s)` binding `t` to `_Tokenizer`); a JS/TS class field and `this.x = new Y()` receiver resolving; webpack's `this.#tm.getTransaction()`; a variable initialised from a _method_ call (`const i = s.getInfo(); i.m()`); the Python factory chain `def make() -> type[Parser]` then `p = make()(…)` and pandas' `parser = _parser_dispatch(flav); parser.read()`; and a JSDoc `/** @type {X} */` on both `this.X = …` and a local declarator.
9. Verify the Python `initialized_from_call` activation against all four Python corpora before landing — it can only add types where none existed, but a wrong declared return type now propagates.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `initialized_from_call` carries the full callee chain in JS, Rust and Python, and Python has an initialiser-call extractor and `member_source` capture.
- [ ] #2 A nested `new` in an argument list no longer steals the declarator (angular `lexer.ts:116` binds to `_Tokenizer`); class fields and `this.x = new Y()` produce construct targets keyed to the property definition's location.
- [ ] #3 `this.#tm.getTransaction()` produces the `#`-prefixed chain segment and resolves against the member index.
- [ ] #4 STEP 1.5 fires for methods and constructors and for Python, with `type[X]` returns yielding a class object.
- [ ] #5 JSDoc `@type` is consumed for `this.X = …` in a constructor and for a local declarator.
- [ ] #6 Integration tests cover all of this step's evidence cases: angular `lexer.ts:116`, JS/TS class fields and `this.x = new Y()`, webpack `#`-private chains, method-call initialisers, the pandas `_parser_dispatch` chain, `def make() -> type[Parser]`, and both JSDoc `@type` positions.
- [ ] #7 The Python corpora are re-run and no wrong declared-return-type propagation is introduced.

<!-- AC:END -->
