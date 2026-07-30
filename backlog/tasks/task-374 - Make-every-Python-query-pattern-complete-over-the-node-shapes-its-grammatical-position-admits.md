---
id: TASK-374
title: "Make every Python query pattern complete over the node shapes its grammatical position admits"
status: To Do
assignee: []
created_date: "2026-07-29 09:37"
labels:
  - plan-export
  - syntactic_extraction
dependencies: []
priority: high
plan_dedup_keys:
  - 4bcb8ca0c2d8bb54b17bc9cc65d39edf1b5a349012c398c33f78ee31d2db7b7d
plan_source_tasks:
  - pt-7390b98aa1086ae8
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`packages/core/src/index_single_file/query_code_tree/queries/python.scm` enumerates **one node shape per grammatical position** where the Python grammar admits several. A position filled with `(attribute)`, `(call)` or `(subscript)` matches no pattern, tree-sitter emits no capture, and the definition ceases to exist — whole-symbol erasure, not a partially populated record.

- `python.scm:163-215` captures a class with inheritance only when the superclass is `(identifier)`. `class PGDDLCompiler(compiler.DDLCompiler):` yields **no `@definition.class`**, and because `capture_handlers.python.ts:102` attaches methods through `find_containing_class`, every method of that class is erased with it.
- `python.scm:314-325` captures a decorated class method only when the decorator is `(decorator (identifier))`. `@cython.cfunc`, `@util.memoized_property`, `@functools.lru_cache()` and `@lru_cache(maxsize=1)` yield **no `@definition.method`**; the plain pattern at `python.scm:251-258` cannot rescue them because it requires `function_definition` to be a direct child of the class body, while a decorated method is wrapped in `decorated_definition`.
- `python.scm:286-296` captures `@scope.method` on the `decorated_definition` node while `python.scm:59-65` captures it on the inner `function_definition`; the double capture keeps `@classmethod` methods out of the call graph even when their `@definition.method` fires.

The builders already do the shape discrimination the queries are duplicating: `symbol_factories.python.ts:509-531` (`extract_extends`) handles `identifier`, `attribute` and `subscript` bases, and `symbol_factories.python.ts:667-683` (`determine_method_type`) reads the decorator list off the node via `extract_decorators`. `queries/CAPTURE-SCHEMA.md:43-53` already states the contract: the query captures the complete syntactic unit, the builder derives the semantics from the node.

## Work plan

1. **Class definitions.** Replace the six patterns at `python.scm:163-215` with an unconditioned `(class_definition name: (identifier) @definition.class)` plus the Enum/Protocol discriminators kept only where they change the capture name (`@definition.enum`, `@definition.interface`), widened to accept `(identifier)`, `(attribute)` and `(subscript)` superclasses via an alternation `[ (identifier) (attribute attribute: (identifier)) ]`. Delete the now-redundant `!superclasses` pattern at `python.scm:204-207`. Base-class names keep coming from `extract_extends`, never from the query.
2. **Decorated methods.** Collapse `python.scm:270-325` so `@definition.method` is emitted by one pattern — `(class_definition body: (block (decorated_definition definition: (function_definition name: (identifier) @definition.method))))` — with no decorator-shape constraint. Keep `@decorator.property` and `@modifier.visibility` as separate narrow metadata patterns (they are not gates) and keep the `#not-eq? "__init__"` guard.
3. **Method scopes.** Delete the `@scope.method` capture at `python.scm:294`; `python.scm:62` is the single owner of that capture.
4. **Delete the duplicate decorator reference patterns** at `python.scm:827-836` (labelled "old reference captures for compatibility"); they re-emit the `@reference.call` captures of lines 804-817, so one `@property` currently yields `function_call name=property` twice. No compatibility layers.
5. **Fix the inert self/cls predicates.** `python.scm:838-844` writes `(#eq? @reference.this "self")` outside the pattern, so the predicate never binds and `@reference.this` fires on **every** identifier (probed: `cython`, `Row`, `cfunc`, `key`), giving three `variable_reference`s per identifier. Move the predicates inside the patterns.
6. **Delete the drifted static/instance call duplicates** at `python.scm:738-750`, which re-match `python.scm:722-728`; the only extra signal is `@reference.type_reference` on a capitalised receiver — fold it into the general pattern as a predicate or drop it. Keep exactly one `@reference.call` per call node.
7. **Populate `accessor_kind` for Python methods.** In `capture_handlers/capture_handlers.python.ts`, `handle_definition_method` (line 102) sets `accessor_kind: "getter"` when `extract_decorators` reports `property` and `"setter"` when it reports `<name>.setter`. Without it Python getter reads can never become edges: `call_resolution/call_resolver.ts:255-259` filters on `accessor_kind === "getter"`, and today only the JS/TS handlers populate it. `handle_definition_property` (line 179) is unchanged. Confirm `type_preprocessing/member.ts:35` does not let the `property` definition shadow the method in the member map.
8. **Lock the invariants with an audit.** Over `packages/core/tests/fixtures/{python,javascript,typescript}/code/`, assert (a) every `class_definition` / `function_definition` / `method_definition` / `decorated_definition` node yields a `definition` capture at its name range, and (b) no `(capture name, byte range)` pair occurs twice. Land this after the pattern work so it locks the invariant instead of reporting pre-existing failures. A call-node coverage audit is explicitly not the invariant to build — call nodes are already captured.
9. **Hand off the dotted-`extends` parent link.** `registries/type.ts:234-260` resolves parents via `resolutions.resolve(scope_id, parent_name)` on the flat extends name, so `compiler.DDLCompiler` still fails to link even once the class is captured (probed: `class PG(Mixin, compiler.DDLCompiler)` captures fine and fails with `method_lookup/method_not_on_type`). Raise this as a `name_resolution` / `import_resolution` dependency and record that the sqlalchemy `super()` rows close only after it.
10. **Add integration tests covering every evidence case in this task.** In `index_single_file.python.test.ts` assert with `toEqual` on typed literals: one `@definition.class` and all methods for each superclass shape (`Base`, `mod.Base`, `Base[T]`, `mod.Base[T]`, none) — including the sqlalchemy shape `class PGDDLCompiler(compiler.DDLCompiler)`; exactly one `@definition.method` and exactly one `@scope.method` per decorator shape (`@property`, `@staticmethod`, `@classmethod`, `@cython.cfunc`, `@util.memoized_property`, `@functools.lru_cache()`, `@lru_cache(maxsize=1)`); `accessor_kind: "getter"` for `@property def x` and `"setter"` for `@x.setter`; and that an identifier is captured as `@reference.this` only when it is `self` or `cls`. In a `Project` + `update_file` test assert that `@property def data` read as `r.data` creates an edge to the getter, and that `class PG(Base)` and `class PG(mod.Base)` both put the subclass method in the graph with the `super().visit_create_sequence(c)` edge asserted for the unqualified form now and for the qualified sqlalchemy form after step 9 lands. Update the fixture corpus under `packages/core/tests/fixtures/python/code/` as the audit in step 8 requires.
11. Keep the insulated suites green — `query_code_tree.test.ts`, `query_loader.test.ts`, `capture_handlers.*.test.ts`, `metadata_extractors.*.test.ts`, `references.test.ts`, `call_site_syntax.*.test.ts` — and confirm the capture/receiver-consistency Stop hook (`.claude/hooks/capture_receiver_consistency_stop.ts`) passes: every surviving `definition`/`decorator` capture needs a handler and every deleted pattern's handler must be checked for orphanhood.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `class PGDDLCompiler(compiler.DDLCompiler)` yields one `@definition.class` and every method of the class appears in the call graph.
- [ ] #2 The sqlalchemy `@cython.cfunc` false-positive clears, and `@util.memoized_property`, `@functools.lru_cache()`, `@lru_cache(maxsize=1)` and `@mod.dec(arg)` each yield exactly one `@definition.method`.
- [ ] #3 A `@classmethod` method appears in the call graph; exactly one `@scope.method` capture is emitted per method.
- [ ] #4 A Python identifier is captured as `@reference.this` only when it is `self` or `cls`; no identifier yields three `variable_reference`s any more.
- [ ] #5 One `@property` decorator yields exactly one `function_call name=property` reference, and one Python call node yields exactly one `@reference.call`.
- [ ] #6 Python method definitions carry `accessor_kind: "getter"` / `"setter"`, and `@property def data` read as `r.data` creates an edge to the getter (the `property` definition does not shadow the method in `type_preprocessing/member.ts`).
- [ ] #7 Integration tests (with the updated `tests/fixtures/python/code/` corpus) cover every evidence case in the group: sqlalchemy `@cython.cfunc`, the call-shaped and dotted decorator variants, and both sqlalchemy `super()` rows on `PGDDLCompiler` — the qualified-base `super()` edge asserted once the dotted-`extends` dependency lands.
- [ ] #8 A definition-coverage audit asserts every `class_definition` / `function_definition` / `method_definition` / `decorated_definition` node in the fixture corpus yields a definition capture at its name range, and a duplicate-capture assertion proves no `(capture name, byte range)` pair occurs twice.
- [ ] #9 The dotted-`extends` parent-link dependency (`registries/type.ts:245`) is filed against `name_resolution` with the sqlalchemy rows named as its consumer.
- [ ] #10 `query_code_tree.test.ts`, `query_loader.test.ts`, `capture_handlers.*.test.ts`, `metadata_extractors.*.test.ts`, `references.test.ts` and `call_site_syntax.*.test.ts` stay green and the capture/receiver-consistency Stop hook passes.

<!-- AC:END -->
