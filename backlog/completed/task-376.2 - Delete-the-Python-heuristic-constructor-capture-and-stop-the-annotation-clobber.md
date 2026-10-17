---
id: TASK-376.2
title: "Delete the Python heuristic constructor capture and stop the annotation clobber"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 2000
plan_dedup_keys:
  - 8cc3142ff2d835f7edcfe613ce5d67ae9fadb4a5f00295d8a586cfe6412543c2
plan_source_tasks:
  - pt-c86aedb46bb9c742
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 2. Wave 1; no dependencies. Lands before TASK-376.6, which rewrites STEP 1 and must keep the guard this step adds.

## Root cause

`queries/python.scm:683-693` captures **every** call with an argument list whose callee is an identifier as `@reference.constructor` (only `super` is excluded, by `#not-eq?`). `preprocess_references.python.ts:27-57` is the precise builder — it resolves the callee and requires `def.kind === "class"` before rewriting the call to a `ConstructorCallReference`, reading `ref.potential_construct_target` at `:50` — so the heuristic doubles constructor edges when the callee is a class and is the entire source of `constructor_lookup / constructor_target_not_a_class` in Python. Separately, `TypeRegistry` STEP 1 (`resolve_references/registries/type.ts:153-166`) accepts any binding whose annotation resolves, including a speculative constructor binding that resolves to a _function_, and `extract_type_data` (`:99-135`) spreads `ctor_bindings.direct` **after** `type_bindings_from_defs` (`:109-112`), so on a shared location key the inferred binding overwrites the declared one and Python `p: Parser = make()` types `p` as the function `make`.

## Work plan

1. Confirm `potential_construct_target` still reaches `preprocess_references.python.ts:50` from the plain `@reference.call` capture (`references.ts:242` and `:403` populate it from `extract_construct_target`), then delete the heuristic capture at `queries/python.scm:683-693` and the paragraph of the header comment (`:649-666`) that describes it.
2. In `registries/type.ts` STEP 1, skip a binding whose resolved `type_id` is not a `class` / `interface` / `enum` definition — a speculative constructor binding that resolves to a function is not a type.
3. In `extract_type_data` (`:109-112`), keep the annotation and construction bindings apart so a declared type beats an inferred one without erasing it.
4. Add integration tests at the `Project` + `update_file` tier covering every evidence case behind these rows: a Python module-level and method-level plain call that must **not** produce a constructor edge; a genuine `C()` construction that still resolves through `preprocess_references.python.ts`; celery/django call sites currently reporting `constructor_target_not_a_class` from the heuristic; the `p: Parser = make()` clobber regression (declared `Parser` wins over inferred `make`); and the pandas `parser = _parser_dispatch(flav)` shape asserting no spurious constructor edge. Create `tests/fixtures/python/code/integration/` (it does not exist yet) for the multi-file cases.
5. Keep `preprocess_references.python.test.ts` green — it is the surviving builder's insulation.

The corpus-level count of the cleared `constructor_target_not_a_class` population is recorded by TASK-376.18 against TASK-376.16's baseline row.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 The heuristic `@reference.constructor` capture is gone from `queries/python.scm` and constructor edges in Python come solely from `preprocess_references.python.ts`.
  Evidence: `python.scm` holds no `@reference.constructor` pattern and `CAPTURE-SCHEMA.md`'s Python section no longer lists one; `project.python.integration.test.ts` › "records each call once: constructions as constructor calls to the class, plain calls as function calls" pins every call in `tests/fixtures/python/code/integration/uses_parsers.py` with the definition it resolves to, named by kind and file, so a resolution to the class in `parsers.py` is distinguishable from one to the importing file's own alias.
- [x] #2 The phantom `constructor_target_not_a_class` population in Python clears in the integration cases; real `C()` constructions still resolve.
  Evidence: the same test admits no `constructor_target_not_a_class` outcome anywhere in the file, and all three `Parser()` sites resolve to the class. Running that test against the sources at `279221d4` records 16 calls where this tree records 11: a second, failed constructor record at `helper(1)`, `helper(2)`, `dispatch(flavor)` and `make()` — the four `constructor_target_not_a_class` outcomes — and each `Parser()` recorded twice. Measured over the integration fixtures only; the corpus population is TASK-376.18's row.
- [x] #3 STEP 1 rejects a binding whose resolved type cannot answer a member lookup, and a symbol carrying both a construction and an annotation is never typed as a factory function.
  Evidence: `names_a_type` in `registries/type.ts` guards STEP 1; `type.test.ts` › "STEP 1 type-kind guard and binding order" covers all five outcomes — a construction naming a function is skipped, the constructed class beats a declared annotation, the annotation answers when the construction names a function, a construction under an unresolvable annotation types the symbol, and a construction naming a class types the symbol. At the Project tier, `project.python.integration.test.ts` › "types the constructed and annotated variables as the class, so their method calls resolve" reads the bindings directly, and `project.javascript.integration.test.ts` › "types a variable constructed from a constructor function, so its prototype method calls resolve" pins the function-collection clause.
- [x] #4 Integration tests with Python fixtures cover all evidence cases for this step: the doubled-constructor call sites, a genuine construction, `p: Parser = make()`, and the pandas `_parser_dispatch` shape.
  Evidence: `tests/fixtures/python/code/integration/{parsers,uses_parsers}.py` carry a module-level and a method-level plain call, a construction inside `__init__` and inside a function, the annotated factory result, an unresolvable `Optional[...]` annotation over a construction, and `parser = dispatch(flavor)`. The celery/django sites are covered by shape equivalence with `helper(1)`: the deleted capture matched any bare-identifier callee, so a framework call site is that shape.
- [x] #5 `preprocess_references.python.test.ts` and `type_preprocessing/{bindings,constructor_bindings}.test.ts` stay green.
  Evidence: all three pass; the Python cases of `constructor_bindings.test.ts` now read a file's bindings off its references after preprocessing, through a `Project`, because a Python construction exists as a constructor call only after its callee has resolved to a class. Every assertion in those cases is unchanged.

<!-- AC:END -->

## Implementation Notes

### High-level summary

Python stops reporting phantom failed constructions for ordinary calls, and a symbol takes the type of the class it is constructed from, falling back to its declared annotation when the initialiser constructs nothing. The heuristic query that captured every argument-bearing call as a constructor is gone, so a construction is recorded once, by the resolver that checks the callee is a class. `TypeRegistry` reads constructor bindings from the file's preprocessed references, records a binding only when the name can answer a member lookup, and consults the construction before the declared annotation.

Start at `queries/python.scm`'s call section for what the index records, `preprocess_references.python.ts` for the one constructor rewrite, and `registries/type.ts` for `names_a_type` and STEP 1's binding order. The Python fixtures under `tests/fixtures/python/code/integration/` carry every evidence shape at the Project tier.

### Why `project.ts` is touched

`x = C()` types `x` as `C` only because the construction reaches `extract_constructor_bindings`. A Python construction is a plain call in the index and becomes a `constructor_call` only once `preprocess_references.python.ts` resolves its callee to a class, so those bindings exist only on the preprocessed side. `TypeRegistry.update_file` therefore takes the file's references as the `ReferenceRegistry` holds them, and `project/project.ts` phase 4 passes `this.references.get_file_references(file_id)` — one argument, which is the whole of the change to that file. `extract_constructor_bindings` states the precondition on the module it constrains.

### What may be a symbol's type

`names_a_type` admits a class, an interface or an enum — the kinds carrying a member index — and any symbol holding a function collection. The second clause is load-bearing: a JavaScript constructor function (`function Vehicle() {}` with `Vehicle.prototype.start = ...`) is a `function` definition, and `new Vehicle()` is the only route by which its prototype methods are reached, so admitting kind alone drops those call edges. A type alias is deliberately excluded: it carries no member index, so binding through one names something with nothing to look up.

### Which of two bindings types a symbol

One symbol can carry both a construction and an annotation (`h: Handler = HandlerA()`). STEP 1 takes the construction first, because the constructed class is the one whose methods actually run and that edge is what a call graph is for: annotating with a Protocol or a base class must not cost the implementation the call reaches. The annotation answers whenever the construction names nothing that can hold members — either there is no construction, or its callee is a factory, which is exactly `p: Parser = make()`.

Keeping the two apart is what makes that possible. Merging them into a single map lets whichever is spread last delete the other outright, so an annotation the resolver cannot reach erases the construction that would have typed the symbol: `a: Optional[Parser] = Parser()`, `a: "Parser" = Parser()` and `a: Parser | None = Parser()` are ordinary Python whose annotation text names no definition.

### Deviations from the work plan

- Step 1 says to delete the header paragraph describing the heuristic. It is rewritten rather than removed — deleting it would leave the call section undocumented — and `CAPTURE-SCHEMA.md`'s Python section drops its `@reference.constructor` entry the same way.
- Step 3 asks for the declared annotation to beat the inferred construction, by spreading annotation bindings last. The order is inverted, and this is the one place the step departs from its plan on purpose. Deleting the heuristic capture already removes the clobber the step is named for: `make()` is a plain call, so `p: Parser = make()` records no construction at all and the annotation types `p` whatever the order. What annotation-first does reach is `h: Handler = HandlerA()`, where it loses the call edge to `HandlerA.process` entirely (`polymorphic_no_implementations`), re-points `w: A = B()` at a method in another file, and widens `g: Base = Derived()` from the override that runs to both. Naming the callee that runs is the top of this codebase's intention tree, and `2d998e83` moved the same way, so the construction leads and the annotation answers when the construction names no type. `ExtractedTypeData` keeps `annotation_bindings` and `construction_bindings` apart so neither erases the other.
- Criterion 2 is met over the integration fixtures rather than a corpus count, which is TASK-376.18's row against TASK-376.16's baseline.

### A limit the binding order inherits

`construct_target` walks up to the enclosing assignment, so a construction anywhere inside an initialiser claims the whole declarator: `w: Parser = Wrapper().build()` types `w` as `Wrapper`, and `x: Foo = do_something(Bar())` types `x` as `Bar`. The tree at `279221d4` does the same — it also spread constructions last — so this is inherited rather than introduced, and it holds with no annotation at all. Making `extract_construct_target` yield a target only for a construction that is the direct value of the assignment would fix it for every language; that is a change to the metadata extractors, not to this step. `project.python.integration.test.ts` pins the shape over `uses_parsers.py:40` so it cannot change silently.

### Rows this step does not claim

`parser = dispatch(flavor)` followed by `parser.close()` reports `receiver_type_unknown`: the factory declares no return type, so nothing types `parser`. TASK-376.11's value channel is where that receiver gains a type.

The `@reference.constructor` name survives in `classify_entry_points/extract_entry_point_diagnostics.ts`, which derives capture names from a CallReference's `call_type`; a Python constructor call still reports it, because the rewritten reference is a constructor call.

`query_code_tree.test.ts` pins two `definition.variable` duplications the new fixture exposes at its typed local assignments. Both occur with the base grammar and are owned by TASK-374.5, as that invariant already states.

Five index-tier tests in `index_single_file.python.test.ts` and one in `project.integration.test.ts` described the heuristic and are restated as what the index records: a plain call carrying the assignment target it lands in, with the construction recorded at the Project tier as one constructor CallReference.

After merge with TASK-376.16, the Python row of `call_resolver.test.ts` › "resolved-plus-failed invariant" changes: the two new fixture files add references, and each Python call now yields one CallReference instead of two.

### Verification

`tsc --noEmit` clean, 194 test files and 4,438 tests green, `pnpm lint` clean.

Every call in the four fixture corpora resolves identically to the tree at `279221d4` for TypeScript, JavaScript and Rust, measured by resolving each corpus on both trees and diffing every call's target set. Python differs only as intended: 139 failed constructor records disappear (the phantom `constructor_target_not_a_class` population), 21 duplicate constructor records collapse to one each, `uses_parsers.py:31 p.parse()` gains its resolution, and two calls that failed on both trees change reason from `method_not_on_type` to `receiver_type_unknown` — a symbol the heuristic mistyped is now honestly untyped.

Each fix is pinned by a test that fails without it: dropping the function-collection clause from `names_a_type` fails the JavaScript prototype case; merging the annotation and construction bindings into one map fails both Project-tier Python cases; consulting the annotation before the construction fails the precedence case.
