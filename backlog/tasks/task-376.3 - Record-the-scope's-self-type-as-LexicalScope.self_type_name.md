---
id: TASK-376.3
title: "Record the scope's self type as LexicalScope.self_type_name"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - scope_construction
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 3000
plan_dedup_keys:
  - 8856e80a9a68e7e0fa80a9c0f2daf3a94cc408598de6c00ad4b8cb955917ed63
plan_source_tasks:
  - pt-371eef85759d23c4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 3.

## Root cause

`LexicalScope` (`packages/types/src/lexical_scope.ts:6-27`) has no field for the type whose instance `self`/`this`/`cls` denotes, so resolution reconstructs it by running the member index backwards. A Rust `impl` block whose type is declared in another file contributes zero method definitions (`capture_handlers/methods.rust.ts:37-56`, reproduced on `rustc_ast_lowering/src/path.rs`: zero classes, zero methods across ~600 lines), so no definition-carried field could exist to be read either. The fact belongs on the scope, which is where every failing row asks for it.

## Work plan

1. Add to `packages/types/src/lexical_scope.ts`: `readonly self_type_name: SymbolName | null` — the type whose instance `self`/`this`/`cls` denotes inside this scope, as a name resolvable in this scope. Set on class-family scopes (class, interface, enum, trait bodies) and on Rust `impl` blocks (a plain block scope that nonetheless binds `self`); null everywhere else.
2. Add `extract_self_type_name(node, scope_type): SymbolName | null` to the `ScopeBoundaryExtractor` interface (`index_single_file/scopes/boundary_base.ts:111-120`), with a default on `CommonScopeBoundaryExtractor` returning the parent node's `name` field for `scope_type === "class"` and `null` otherwise.
3. Call it in the `process_scopes` capture loop (`scopes.ts:140-195`) and set the field on the constructed `LexicalScope` (`:178-185`). Leave `extract_scope_name` (`:35-102`) unchanged — `name` keeps meaning "this scope's own identifier"; a Rust `impl` block has an owner and no name.
4. Override in the four boundary extractors: `javascript_typescript_scope_boundary_extractor.ts` (`class_body` → the class declaration's `name`, reusing the parent walk at `:55-74`); `typescript_scope_boundary_extractor.ts` (`interface_body`, `enum_body`, mirroring `:29-48`); `python_scope_boundary_extractor.ts` (class body `block` walks up to `class_definition` and reads `name`, walk exists at `:81-99`); `rust_scope_boundary_extractor.ts` (`field_declaration_list` → `struct_item.name`; `enum_variant_list` → `enum_item.name`; `declaration_list` under `trait_item` → the trait name; `declaration_list` under `impl_item` → `extract_impl_type(parent)` from `symbol_factories.rust.ts:246-268`, which unwraps `generic_type`, so `impl ValueVisitor<'tcx, M> for ValidityVisitor<'rt, …>` yields `ValidityVisitor` — the implemented type, never the trait).
5. Reject the `rust.scm` recapture alternative: `scope.type` feeds boundary sorting, `map_capture_to_scope_type` and `find_containing_scope`, so an `impl` block stays a block scope and the new field carries the fact.
6. Add `build_index_single_file` inline tests asserting `self_type_name` for every evidence shape: a JS class body; a TS `interface_body` and `enum_body`; a Python class body block; and in `rust_scope_boundary_extractor.test.ts` a `struct_item` body, an `enum_item` body, a `trait_item` body, an inherent `impl S`, a generic `impl S<T>` and a trait impl `impl Tr for S` (asserting `S`, not `Tr`). Assert `null` for every non-class-family scope, for an anonymous class expression and for `impl Tr for &S`.
7. Add integration coverage at the index tier for the cross-file Rust shape that motivates the field: `struct S` in one file and `impl S` in another, asserting the `impl` block's scope records `self_type_name: "S"` even though the file declares no class. Add the multi-`impl`-block Rust fixture under `tests/fixtures/rust/code/integration/`.

Nothing reads the field yet — this step is testable at the `build_index_single_file` tier alone.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `LexicalScope.self_type_name` exists and is populated by all four boundary extractors for class, interface, enum, trait and Rust `impl` scopes.
- [ ] #2 A Rust `impl Tr for S` scope records `S`, never `Tr`; a generic `impl S<T>` records `S`; `impl Tr for &S` records null.
- [ ] #3 Every non-class-family scope and anonymous class expression records null.
- [ ] #4 Integration and inline tests cover all of this step's evidence shapes: JS class body, TS interface and enum bodies, Python class body, Rust struct/enum/trait bodies, inherent/generic/trait impls, and the cross-file `struct S` + `impl S` pair.
- [ ] #5 `scopes.test.ts`, `boundary_extractor.integration.test.ts` and `javascript_typescript_scope_boundary_extractor.test.ts` stay green.

<!-- AC:END -->
