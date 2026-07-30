---
id: TASK-376.5
title: "Resolve self/this through find_self_type and delete the backwards member scan"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 5000
plan_dedup_keys:
  - fc71f83f8a03f59dc6fb0a28a5528c56f0b5533b80b6f90020c9b32d349ef3ca
plan_source_tasks:
  - pt-42272c770df71b37
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 5.

## Root cause

`resolve_keyword_base` (`call_resolution/receiver_resolution.ts:175-225`) reconstructs the self type by running the member index backwards: `find_class_from_scope` (`:542-574`) takes the first `kind === "method"` definition in the scope and reverse-scans `Map<class, Map<name, symbol>>` for it, with an escape hatch letting a Rust `impl` block count as a class scope (`:499-535`). It fails five independently reproduced ways — a getter/setter pair lands in `by_scope` (last-wins, `registries/definition.ts:110-119`) and `member_index` (getter-wins, `type_preprocessing/member.ts:27-37`) under different ids (webpack `lib/Module.js:304`/`:317`, angular `abstract_form.directive.ts:63,68`); the seed predicate excludes a constructor-only class (celery `certificate.py:100`); enums get no member index; a cross-file Rust `impl` contributes zero definitions; and the scan breaks on the first candidate, making each fatal.

## Work plan

1. Add `find_self_type(scope_id, context): Result<SymbolId, ResolutionFailure>`: walk to the nearest enclosing scope carrying `self_type_name`, resolve that name in the scope that records it, and verify the resolved definition is a `class` / `interface` / `enum`. **Stop at the first such scope** — continuing would bind `self` to an enclosing type, a wrong edge.
2. Rewrite `resolve_keyword_base` (`:175-225`) onto it. Keep `no_enclosing_class_scope`'s meaning; `class_definition_not_found` now means "this scope names its type and the name is not resolvable here", which is actionable. Keep the existing `find_enclosing_collection` fallback (`:184-193`) ahead of the error, and additionally bind `this` to the enclosing function itself when that function carries a `FunctionCollection` — express's `function View(){ this.lookup() }` with `View.prototype.lookup = fn`, whose members `attach_collection_members.ts:78-92` already folds onto the holder.
3. Delete `find_class_from_scope` (`:536-574`) and `find_containing_class_scope` (`:499-535`), including its `definitions?: DefinitionRegistry` parameter and its Rust block escape hatch. Confirm no consumer of the `block`-vs-`class` distinction is left behind.
4. Delete `get_child_scope_with_symbol_name` (`scopes/scopes.ts:249-266`) and its `processing_context.ts:23` member — zero non-test callers.
5. Repoint `call_resolution/constructor.rust.ts`: `resolve_self_type_rust` (`:50-64`) becomes a call into `find_self_type` — `Self` in Rust _is_ `self_type_name`.
6. Rewrite `receiver_resolution.test.ts`'s direct `find_containing_class_scope` cases against `find_self_type`.
7. Add integration tests at the `Project` + `update_file` tier covering every evidence case for this step: a JS class with a `get x()`/`set x()` pair declared before the method under test calling `this.other()` (webpack `lib/Module.js:304`/`:317`, angular `abstract_form.directive.ts:63,68`); a Python class whose only own member is `__init__` calling `self.m()` (celery `certificate.py:100`); a Rust `enum` with two `impl` blocks and `self.header().encoded_size()` (sqlx `PgCube`); two files with `struct S` in one and `impl S` with a `self.method()` call in the other; a Rust struct with a field and a method sharing a name; and express's `function View(){ this.lookup() }` with `View.prototype.lookup = fn`. Add the supporting fixtures under `tests/fixtures/{javascript,python,rust}/code/integration/`.

This is the step that flips the `self`/`this` rows.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `find_self_type` exists, stops at the nearest scope carrying `self_type_name`, and verifies the resolved definition is a class/interface/enum.
- [ ] #2 `find_class_from_scope`, `find_containing_class_scope` and `get_child_scope_with_symbol_name` are deleted with no remaining callers.
- [ ] #3 `constructor.rust.ts`'s `resolve_self_type_rust` routes through `find_self_type`.
- [ ] #4 All five reproduced failure modes clear: getter/setter pair, constructor-only class, enum receiver, cross-file Rust impl, and first-candidate break.
- [ ] #5 Integration tests cover all of this step's evidence cases: webpack `lib/Module.js` and angular `abstract_form.directive.ts` accessor pairs, celery `certificate.py:100`, sqlx `PgCube`, the cross-file `struct S`/`impl S` pair, the field/method name collision, and express `function View(){ this.lookup() }`.
- [ ] #6 `receiver_resolution.test.ts` and `constructor.rust.test.ts` are green with the rewritten cases.

<!-- AC:END -->
