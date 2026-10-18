---
id: TASK-376.17
title: "Split symbol_types into value types and callable return types and delete the dead member builders"
status: Done
assignee: []
created_date: "2026-09-07 06:55"
labels:
  - plan-export
  - receiver_type_inference
dependencies:
  - TASK-376.6
parent_task_id: TASK-376
priority: high
ordinal: 6500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 6, second half. Wave 3, alone: it reshapes `registries/type.ts`, which TASK-376.7, TASK-376.9 and TASK-376.10 all edit next. Requires TASK-376.6.

## Root cause

`TypeRegistry.symbol_types` (`resolve_references/registries/type.ts:52`) conflates a variable's value type with a callable's declared return type: `type_preprocessing/bindings.ts:38-47` keys a function's own location to its `return_type`, and `:50-59` does the same for a class method, in the one map a variable's declared type also lands in. That conflation is what makes `e.connect().exec()` resolve today, so it cannot be removed without re-aiming every read in the same change. Three builders construct a type's member map: `DefinitionRegistry.member_index` (`registries/definition.ts:229-279`, the live one), `extract_type_members` (`type_preprocessing/member.ts:65-148`, whose `methods` / `properties` maps are dead — STEP 2 at `type.ts:225-232` copies the map from `DefinitionRegistry` instead and STEP 3 reads only `.extends`), and `TypeRegistry.get_type_members` (`:267-314`, whose only caller is `Project.get_type_info` at `project/project.ts:707-714`, whose only callers are tests). `TypeMemberInfo` (`packages/types/src/type_member_info.ts:9-18`) exists only to carry that dead shape.

## Work plan

1. Split the store and land every read site in the same change: `symbol_types` becomes value types only; new `callable_return_types: Map<SymbolId, SymbolId>` holds function/method/constructor returns. Split `type_preprocessing/bindings.ts` into `value_bindings` (variable / parameter / property `type`) and `return_bindings` (`return_type`), and add class-property and Rust struct-field annotations as value bindings. Extend `remove_file` eviction (`type.ts:399-414`) to the new map, beside `symbol_type_arguments` from TASK-376.6.
2. Have `walk_property_chain` (`call_resolution/receiver_resolution.ts:440-530`) read `callable_return_types` for a `method` member and `symbol_types` otherwise — the method-return hop (`self.header().encoded_size()`) recorded rather than re-resolved.
3. Widen STEP 2 (`:225-232`) to read the `SemanticIndex`'s `classes` / `interfaces` / `enums` directly for `{ symbol_id, extends }`, and delete `extract_type_members` (`member.ts:65-148`), `TypeRegistry.get_type_members` (`:267-314`), the `definitions` field held only for it (`:60`), `Project.get_type_info` (`project.ts:707-714`) and `TypeMemberInfo` outright if its `extends` field has no reader left. Update `type_preprocessing/index.ts:9`. STEP 3 (`:234-260`) stays until TASK-376.7 deletes it.
4. Move `member.test.ts`'s `extract_type_members` cases: each is checked for an assertion that belongs on `DefinitionRegistry.member_index` and moved there. Move the `get_type_info` assertions across the `project.*.integration.test.ts` and `receiver_resolution.*.test.ts` families onto `definitions.get_member_index()` / `types.get_type_member()` with unchanged values.
5. Measure the call-edge deltas on angular, django, rustc and pandas with TASK-376.16's failure-taxonomy harness — control arm the tree before TASK-376.6, candidate arm this tree, same session — and record the row: the annotation resolver hands `method_lookup` far more receivers, and the row is the baseline TASK-376.13 measures rung 5 against.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `symbol_types` holds value types only, `callable_return_types` exists, every read site is re-aimed in the same change, and eviction covers the new map.
- [x] #2 `bindings.ts` returns value and return bindings separately, and class-property and Rust struct-field annotations are value bindings.
- [x] #3 `extract_type_members`, `TypeRegistry.get_type_members`, `Project.get_type_info` and the dead `TypeMemberInfo` shape are deleted, with their test assertions moved onto `get_member_index()` / `get_type_member()` with unchanged values.
- [x] #4 Chained-receiver resolutions that depended on the conflation (`e.connect().exec()`) stay green.
- [x] #5 The per-reason failure taxonomy and resolved-edge counts on angular, django, rustc and pandas are recorded against the pre-TASK-376.6 control arm in the same session.

<!-- AC:END -->

## Notes from wave 1

Per-reason rows come from `run_load_benchmark.ts --interleave` (control and candidate side by side, delta column) or `--baseline` (one arm); the predicate for a corpus with a triage config is `repository-root-excluding:<its exclude list>`. The tree these rows compare against is `recorded_failure_taxonomy_baseline.ts`.

## Notes from wave 2

- `extract_type_bindings` (`type_preprocessing/bindings.ts`) is keyed by `SymbolId`, not location: a TypeScript constructor parameter property and a Python class-body annotation are each two definitions over one span, and a location key typed only one of them. The value/return split keeps that key.
- `TypeRegistry` STEP 1 and STEP 1.5 both write through `record_declared_type(symbol_id, type_id, argument_ids, …)`, which records the type and the all-or-nothing `symbol_type_arguments` together and is never reached for a binding a construction typed. Routing a `return_type` binding into `callable_return_types` is a change to which map that helper writes, not to how annotations resolve.
- `TypeRegistry.update_file(file, index, references, context: TypeResolutionContext)` reads the file's language from `index.language`; `resolve_annotation` / `resolve_annotation_arguments` take a parsed annotation.
- `walk_property_chain`'s field-name collision branch reads the field's recorded `symbol_types` entry. It is the place the method-return hop joins.

## Implementation notes

### What the capability surface gains

A receiver chain hop through a function or method now continues on that callable's declared return type, read from its own store. `TypeRegistry` records three distinct facts: what a variable, parameter, class property or struct field holds (`get_symbol_type`), that value's type arguments (`get_symbol_type_arguments`), and what calling a function or method yields (`get_callable_return_type`). `e.connect().exec()`, Rust `self.header().encoded_size()` and `factory.open().exec()` through a namespace import resolve by reading the recorded return. A value's type never answers a callable question, and a callable's return type never answers a value one.

- **Rust enum methods.** Their return annotations are recorded like any other method's, so a chain through one (`self.parser().run()` inside `impl Mode`) resolves. This is the only resolution change this step makes on its own: +42 resolved calls and −12 raw entry points on rustc, and no change on angular, django or pandas against TASK-376.6's candidate rows.
- **Removed API.** `Project.get_type_info` is gone, along with `TypeRegistry.get_type_members`, `extract_type_members` and `TypeMemberInfo`. Each built a second, unread copy of a type's members. A type's members are read from `definitions.get_member_index()`, and a member lookup through inheritance from `types.get_type_member()`. `packages/types/src/type_member_info.ts` is `type_info.ts`, holding `TypeInfo` alone.
- **Declared types.** STEP 2 and STEP 3 read the file's `classes` / `interfaces` / `enums` directly for `{ symbol_id, extends }`. STEP 3 stays until TASK-376.7 replaces it.

### Tests moved and dropped

- **Moved.** The `extract_type_members` cases that state a member-index fact moved to `registries/definition.integration.test.ts`, one `Project` per language: methods, properties and fields, static and instance methods, Python `__init__` attributes, Protocol signatures, Rust impl methods on structs and enums, an empty class, and a constructor-only class. The `get_type_info` assertions across the `project.*.integration.test.ts`, `resolve_references.*.test.ts` and `receiver_resolution.*.test.ts` families read `get_member_index()` with unchanged values.
- **Dropped.** The heritage-tracking cases were dropped because heritage is not a member-index fact; `walk_inheritance_chain` and the receiver-resolution families already cover it. The enum-variant-as-property cases were dropped because the live member index never holds variants; `definition.test.ts` "keeps an enum's variants out of the member index" states that.

### Where resolution still stops, and who owns it

- `open().exec()` with a bare call at the head of the chain is indexed with the chain `['exec']` alone, so the call head never reaches receiver resolution. Python `self.connect().execute()` is indexed the same way. Both are index-time chain capture.
- A parameter of a Rust enum `impl` method (`fn apply(&self, p: Parser) { p.run() }`) carries a value binding but is not bound in the method's scope, so the call ends `name_not_in_scope`. TASK-376.8 owns Rust impl-block attachment.
- A factory written as an arrow function held in a `const` (`const make = (): Conn => …; const c = make(); c.exec()`) types nothing: STEP 1.5 follows only a `function` definition — TASK-376.9 widens initialiser capture.
- A constructor has no return annotation. A construction types its target through construction bindings (STEP 1), so `callable_return_types` holds functions and methods only.
- A method named like a field (`fn data(&self) -> Other` beside `data: Inner`) reached at a non-call position continues on the method's return type. The field fallback in `walk_property_chain` applies only when the method records no return.

### Measurement

Rows come from `run_load_benchmark.ts --baseline` over each corpus with the recorded commit and predicate. The control arm ran on `7614ff48`, the tree before TASK-376.6. The candidate arm ran on this step's tree. Same box, same session.

| Corpus (commit, predicate) | Arm | Call refs | Resolved | `receiver_type_unknown` | `member_type_unknown` | `method_not_on_type` | `polymorphic_no_implementations` | `no_parent_class` | Call edges | Raw entry points |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| angular/angular `5ad82313`, `repository-root` | control | 376856 | 148550 | 61737 | 7633 | 6068 | 941 | 173 | 141327 | 4263 |
| | candidate | 377609 | 152279 | 57230 | 7612 | 6938 | 1621 | 173 | 147963 | 3770 |
| | delta | +753 | **+3729** | −4507 | −21 | +870 | +680 | 0 | **+6636** | **−493** |
| rust-lang/rust `e7b59555`, `repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests` | control | 328739 | 82121 | 101145 | 24015 | 18156 | 492 | 1277 | 65061 | 16575 |
| | candidate | 328739 | 96662 | 78031 | 16543 | 33907 | 786 | 1277 | 76382 | 14831 |
| | delta | 0 | **+14541** | −23114 | −7472 | +15751 | +294 | 0 | **+11321** | **−1744** |
| django/django `957d0cee`, `repository-root-excluding:js_tests,scripts,docs` | control | 202710 | 82289 | 20133 | 2047 | 66115 | 0 | 845 | 69720 | 2419 |
| | candidate | 202814 | 83689 | 20133 | 2116 | 65220 | 0 | 375 | 71079 | 2399 |
| | delta | +104 | **+1400** | 0 | +69 | −895 | 0 | −470 | **+1359** | **−20** |
| pandas-dev/pandas `7986b425`, `repository-root` | control | 240516 | 111070 | 25675 | 1380 | 40303 | 0 | 447 | 78672 | 2280 |
| | candidate | 242417 | 113345 | 25738 | 1443 | 40198 | 1 | 51 | 80049 | 2262 |
| | delta | +1901 | **+2275** | +63 | +63 | −105 | +1 | −396 | **+1377** | **−18** |

`name_not_in_scope`, `constructor_target_not_a_class`, `no_enclosing_class_scope`, `class_definition_not_found` and `definition_has_no_body_scope` are unchanged on every corpus. `collection_dispatch_miss` moves by +2 on angular only. The control rows reproduce TASK-376.6's control rows exactly.

- **The deltas are the annotation resolver's recovery.** Against TASK-376.6's candidate rows, angular, django and pandas are identical on every column. rustc differs by +42 resolved calls, +40 call edges and −12 raw entry points, with `member_type_unknown` −97, `receiver_type_unknown` −18 and `method_not_on_type` +73: those are the Rust enum-method returns.
- **Rung 5's baseline is this row.** The resolver hands `method_lookup` 15,751 more receivers on rustc and 870 on angular that end `method_not_on_type`, and 294 and 680 that end `polymorphic_no_implementations`. TASK-376.13 measures rung 5 against these rows.

