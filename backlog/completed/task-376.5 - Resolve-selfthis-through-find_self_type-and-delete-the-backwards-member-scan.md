---
id: TASK-376.5
title: "Resolve self/this through find_self_type and delete the backwards member scan"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - method_lookup
dependencies:
  - TASK-376.3
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

§7 step 5. Wave 2. Requires TASK-376.3 (`self_type_name`). Shares `receiver_resolution.ts` with TASK-376.6 in the same wave, in different functions.

## Root cause

`resolve_keyword_base` (`call_resolution/receiver_resolution.ts:178-228`) reconstructs the self type by running the member index backwards: `find_class_from_scope` (`:738-767`) takes the first `kind === "method"` definition in the scope and reverse-scans `Map<class, Map<name, symbol>>` for it, with an escape hatch in `find_containing_class_scope` (`:701-736`) letting a Rust `impl` block count as a class scope. It fails four independently reproduced ways — a getter/setter pair lands in `by_scope` (last-wins, `registries/definition.ts:212-219`) and `member_index` (getter-wins, `type_preprocessing/member.ts:28-42`) under different ids (webpack `lib/Module.js:304`/`:317`, angular `abstract_form.directive.ts:63,68`); the seed predicate excludes a constructor-only class (celery `certificate.py:100`) and every constructor body and field initialiser (TASK-374.6 items 1 and 2); a cross-file Rust `impl` contributes zero definitions; and the scan breaks on the first candidate, making each fatal. The fifth mode the plan recorded — enums having no member index — closed with TASK-374; sqlx `PgCube` (`sqlx-postgres/src/types/cube.rs`, every `impl` in the one file) is re-probed at the start of this step and kept as an insulation case if it already resolves.

`resolve_self_type_rust` lives in `call_resolution/path_resolution.rust.ts:286-299` with the signature `(scope_id, scopes, definitions)`; the `Self` keyword guard sits at its call site, `constructor.ts:60-62`. It walks to the class scope and calls `find_class_from_scope`, so it inherits every failure above.

## Work plan

1. Add `find_self_type(scope_id, context): Result<SymbolId, ResolutionFailure>`: walk to the nearest enclosing scope carrying `self_type_name`, resolve that name in the scope that records it, and verify the resolved definition is a `class` / `interface` / `enum`. **Stop at the first such scope** — continuing would bind `self` to an enclosing type, a wrong edge.
2. Rewrite `resolve_keyword_base` (`:178-228`) onto it. Keep `no_enclosing_class_scope`'s meaning; `class_definition_not_found` now means "this scope names its type and the name is not resolvable here", which is actionable. Keep the existing `find_enclosing_collection` fallback (`:188-196`) ahead of the error, and additionally bind `this` to the enclosing function itself when that function carries a `FunctionCollection` — express's `function View(){ this.lookup() }` with `View.prototype.lookup = fn`, whose members `index_single_file/definitions/attach_collection_members.ts:55-94` already folds onto the holder. `super` keeps reading `inheritance_chain[1]` (`:224`).
3. Delete `find_class_from_scope` (`:738-767`) and `find_containing_class_scope` (`:701-736`), including its `definitions?: DefinitionRegistry` parameter and its Rust block escape hatch. Confirm no consumer of the `block`-vs-`class` distinction is left behind.
4. Delete `get_child_scope_with_symbol_name` (`scopes/scopes.ts:249-266`) and its `processing_context.ts:23-26` member — zero non-test callers; it is stubbed in ten test mocks, which lose the stub.
5. Repoint `resolve_self_type_rust` (`path_resolution.rust.ts:286-299`) onto `find_self_type` — `Self` in Rust _is_ `self_type_name` — and keep the keyword guard at `constructor.ts:60-62`.
6. Rewrite `receiver_resolution.test.ts`'s direct `find_containing_class_scope` cases against `find_self_type`. Leave the destructured-binding rung (`:286-300`, TASK-389) and the namespace hops (`:320-434`, TASK-375.2) untouched.
7. Add integration tests at the `Project` + `update_file` tier covering every evidence case for this step: a JS class with a `get x()`/`set x()` pair declared before the method under test calling `this.other()` (webpack `lib/Module.js:304`/`:317`, angular `abstract_form.directive.ts:63,68`); a Python class whose only own member is `__init__` calling `self.m()` (celery `certificate.py:100`); a `this.m()` call inside a constructor body and a getter read inside a class-field initialiser, each with a negative control (TASK-374.6 items 1 and 2 close here); a Rust `enum` with two `impl` blocks and `self.header().encoded_size()` (sqlx `PgCube`); a Rust struct with a field and a method sharing a name; and express's `function View(){ this.lookup() }` with `View.prototype.lookup = fn`. For the cross-file `struct S` / `impl S` pair, assert at the unit tier that `find_self_type` returns `S` from the `impl` scope; the end-to-end `self.method()` edge needs the member half and lands with TASK-376.8.

This is the step that flips the `self`/`this` rows.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `find_self_type` exists, stops at the nearest scope carrying `self_type_name`, and verifies the resolved definition is a class/interface/enum.
- [x] #2 `find_class_from_scope`, `find_containing_class_scope` and `get_child_scope_with_symbol_name` are deleted with no remaining callers or test stubs.
- [x] #3 `path_resolution.rust.ts`'s `resolve_self_type_rust` routes through `find_self_type`.
- [x] #4 All reproduced failure modes clear: getter/setter pair, constructor-only class, constructor body and field initialiser, first-candidate break; and `find_self_type` names the type from a cross-file Rust `impl` scope.
- [x] #5 Integration tests cover all of this step's evidence cases: webpack `lib/Module.js` and angular `abstract_form.directive.ts` accessor pairs, celery `certificate.py:100`, the constructor-body and field-initialiser cases, sqlx `PgCube`, the field/method name collision, and express `function View(){ this.lookup() }`.
- [x] #6 `receiver_resolution.test.ts`, `constructor.rust.test.ts` and `path_resolution.rust.test.ts` are green with the rewritten cases.

<!-- AC:END -->

## Notes from wave 1

`LexicalScope.self_type_name` is set by every boundary extractor: the class-family scope (`type: "class"`, which also covers interface, enum and trait bodies) names its declaration, and a Rust `impl` block — a `type: "block"` scope — names the implemented type (`type_identifier`, or the identifier under a `generic_type`; null for a reference or a path). The Python class scope keeps `name: null` (its capture is the body `block`) while `self_type_name` carries the class; an anonymous class expression records null.

## Implementation notes

### Where the self type name is looked up

The name is resolved from the **parent** of the scope that records it, not from the recording scope. A type is declared outside the body that names it, so a member named after its own class (`class Foo { Foo = 5 }`, a Python class attribute `Foo = 5`) can only shadow the declaration — resolving inside the body binds `self` to the member and drops every `this.m()` edge in the class. Every language agrees: a class/struct/enum's `defining_scope_id` is the scope above its body, including a CommonJS-exported class expression. Starting outside also reaches a Rust `impl`'s `use`, which sits in the module scope above the block.

When the lexical binding is not a class/interface/enum, `find_type_declared_in_scope` (`registries/definition.ts`) asks the lookup scope for a type of that name **by kind**. A scope holds one symbol per name, so TypeScript declaration merging — `class Foo` beside `namespace Foo` — can give the slot to the namespace; only a type can be what `self` denotes, so the type is asked for directly rather than taken from whichever declaration won the name.

### Correction to this task's framing

"This is the step that flips the `self`/`this` rows" overstates it, measured rather than assumed. Reverting the three source files and re-running this step's new integration tests leaves **two** failing: express's `function View(){ this.lookup() }` with `View.prototype.lookup = fn`, and a Python class whose only own member is `__init__` calling an inherited `self.helper()`. The accessor-pair (webpack, angular), constructor-body, field-initialiser, sqlx `PgCube`, Rust enum-with-two-impls and Rust field/method-collision cases all already resolved before this step — wave 1 (TASK-376.3, .4, .12) closed them, and the deleted scan only ever needed **one** ordinary method anywhere in the class to seed its reverse lookup, which every one of those shapes still has. They are kept as regression guards, not as proof of this step.

What this step does change on the capability surface: the two cases above resolve; a cross-file Rust `impl` can name its type (unit tier — the end-to-end `self.method()` edge needs the member half, TASK-376.8); and `class_definition_not_found` now means "this scope names its type and nothing here supplies it", which is actionable, where before it meant "no member happened to seed the scan".

sqlx `PgCube` was re-probed as the description asks: it resolves, and is kept as an insulation case.
