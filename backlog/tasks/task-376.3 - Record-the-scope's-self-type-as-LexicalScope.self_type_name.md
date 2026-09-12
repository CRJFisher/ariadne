---
id: TASK-376.3
title: "Record the scope's self type as LexicalScope.self_type_name"
status: Done
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

§7 step 3. Wave 1; no dependencies. TASK-376.5 is the first reader.

## Root cause

`LexicalScope` (`packages/types/src/lexical_scope.ts:9-27`: `id`, `parent_id`, `name`, `type`, `location`, `child_ids`) has no field for the type whose instance `self`/`this`/`cls` denotes, so resolution reconstructs it by running the member index backwards. A Rust `impl` block whose type is declared in another file contributes zero method definitions (`capture_handlers/methods.rust.ts:47-55` gates emission on a per-file `find_class_by_name` / `find_enum_by_name`; reproduced on `rustc_ast_lowering/src/path.rs`, whose `impl<'hir> LoweringContext<'_, 'hir>` at `:23` implements a struct declared in `lib.rs:146`), so no definition-carried field could exist to be read either. The fact belongs on the scope, which is where every failing row asks for it.

## Work plan

1. Add to `packages/types/src/lexical_scope.ts`: `readonly self_type_name: SymbolName | null` — the type whose instance `self`/`this`/`cls` denotes inside this scope, as a name resolvable in this scope. Set on class-family scopes (class, interface, enum, trait bodies) and on Rust `impl` blocks (a plain block scope that nonetheless binds `self`); null everywhere else.
2. Add `extract_self_type_name(node, scope_type): SymbolName | null` to the `ScopeBoundaryExtractor` interface (`index_single_file/scopes/boundary_base.ts:111-119`, which today has exactly `extract_boundaries` and `sort_captures`), with a default on `CommonScopeBoundaryExtractor` (`:123`) returning the parent node's `name` field for `scope_type === "class"` and `null` otherwise. `PythonScopeBoundaryExtractor` implements the interface directly (`python_scope_boundary_extractor.ts:18`) rather than extending the common base, so it needs its own implementation, not an override.
3. Call it in the `process_scopes` capture loop (`scopes.ts:140-195`) and set the field on the constructed `LexicalScope` (`:178-185`). Leave `extract_scope_name` (`:35-102`) unchanged — `name` keeps meaning "this scope's own identifier"; a Rust `impl` block has an owner and no name.
4. Implement in the four boundary extractors: `javascript_typescript_scope_boundary_extractor.ts` (`class_body` → the class declaration's `name`, reusing the single parent read at `:59` inside `extract_class_body_boundaries` `:55-84`); `typescript_scope_boundary_extractor.ts` (`interface_body`, `enum_body`, beside the `:30-49` dispatch and the parent reads at `:99` and `:123`); `python_scope_boundary_extractor.ts` (the class body `block` walks up to `class_definition` and reads `name`; the walk exists at `:91-94`); `rust_scope_boundary_extractor.ts` (26 lines today, overriding only `extract_class_boundaries` `:16-24`: `field_declaration_list` → `struct_item.name`; `enum_variant_list` → `enum_item.name`; `declaration_list` under `trait_item` → the trait name; `declaration_list` under `impl_item` → `extract_impl_type(parent)` from `symbol_factories.rust.ts:338-360`, which unwraps `generic_type`, so `impl ValueVisitor<'tcx, M> for ValidityVisitor<'rt, …>` yields `ValidityVisitor` — the implemented type, never the trait).
5. Reject the `rust.scm` recapture alternative: `scope.type` feeds boundary sorting, `map_capture_to_scope_type` (`scopes.ts:307`) and `find_containing_scope` (`:310`), so an `impl` block stays a block scope and the new field carries the fact.
6. Add `build_index_single_file` inline tests asserting `self_type_name` for every evidence shape: a JS class body; a TS `interface_body` and `enum_body`; a Python class body block; and in `rust_scope_boundary_extractor.test.ts` a `struct_item` body, an `enum_item` body, a `trait_item` body, an inherent `impl S`, a generic `impl S<T>` and a trait impl `impl Tr for S` (asserting `S`, not `Tr`). Assert `null` for every non-class-family scope, for an anonymous class expression and for `impl Tr for &S`.
7. Add integration coverage at the index tier for the cross-file Rust shape that motivates the field: `struct S` in one file and `impl S` in another, asserting the `impl` block's scope records `self_type_name: "S"` even though the file declares no class. Create `tests/fixtures/rust/code/integration/` (it does not exist yet) and add the multi-`impl`-block fixture there.

Nothing reads the field yet — this step is testable at the `build_index_single_file` tier alone. TASK-377 rewrites `definitions/definition_builder.ts` and `scopes/scope_lookup.ts`; it shares no function with this step.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `LexicalScope.self_type_name` exists and is populated by all four boundary extractors for class, interface, enum, trait and Rust `impl` scopes.
  Evidence: `packages/types/src/lexical_scope.ts` carries the readonly field; `ScopeBoundaryExtractor.extract_self_type_name` is answered by the common base, which names a class-family type off the declaration around the captured body node and so serves JavaScript and TypeScript classes, TypeScript interfaces and enums, and Rust struct, enum and trait bodies. Two extractors override it: Rust for an `impl` block's declaration list, and the JavaScript/TypeScript extractor to withhold the name of a class expression no definition registers. `PythonScopeBoundaryExtractor` implements the interface directly, reading the class through `find_enclosing_class_definition`, which the boundary walk now shares. `process_scopes` reads it once per capture. `scopes.test.ts` › "self_type_name" pins every scope of a JavaScript, TypeScript, Python and Rust snippet.
- [x] #2 A Rust `impl Tr for S` scope records `S`, never `Tr`; a generic `impl S<T>` records `S`; `impl Tr for &S` records null.
  Evidence: `rust_scope_boundary_extractor.test.ts` › "RustScopeBoundaryExtractor.extract_self_type_name" (twelve direct cases) covers the trait impl (`impl ValueVisitor<M> for ValidityVisitor<M>` → `ValidityVisitor`), the generic impl (`impl<T> Container<T>` → `Container`), the reference impl and the scoped path (both null), and the blanket impls `impl<T> Visit for T` and `impl<Handler: Send> Service for Handler`, which record null because the implemented type is one of the block's own type parameters rather than a definition. The same shapes at the index tier in `scopes.test.ts` › "records the implemented type for every Rust impl block…".
- [x] #3 Every non-class-family scope, and every class expression no definition registers, records null.
  Evidence: the four `scopes.test.ts` › "self_type_name" cases list every scope of each snippet — module, function, method, block, arrow function and Python lambda — with `null`. The JavaScript case carries `const Anon = class { }` and `const Named = class Bar { }`: the named one records `name: "Bar"` and `self_type_name: null`, because a class expression's name binds only inside its own body, while `module.exports = class Exported { }` records `Exported`, the one class-expression shape `javascript.scm` registers a definition for. The TypeScript case pins the same assignment recording null, because `typescript.scm` registers a definition for a class declaration only.
- [x] #4 Integration and inline tests cover all of this step's evidence shapes: JS class body, TS interface and enum bodies, Python class body, Rust struct/enum/trait bodies, inherent/generic/trait/blanket impls, and the cross-file `struct S` + `impl S` pair.
  Evidence: the inline cases above; `tests/fixtures/rust/code/integration/{types.rs,impls.rs}` hold `struct Lowering` and `trait Visit` in one file and three `impl` blocks (two inherent, one trait) in another. `scopes.test.ts` › "records the type for a Rust impl block whose struct is declared in another file" indexes both halves: the declaring file's struct and trait bodies record `Lowering` and `Visit`, and the implementing file records `Lowering` on all three `impl` blocks with `index.classes.size === 0` and null on every method scope inside them.
- [x] #5 `scopes.test.ts`, `boundary_extractor.integration.test.ts` and `javascript_typescript_scope_boundary_extractor.test.ts` stay green.
  Evidence: the full core suite passes with `tsc --noEmit` and `pnpm lint` clean. Every `LexicalScope` literal in the test tree gained `self_type_name: null` (89 sites across eleven test files), because the field is required; every touched test file is purely additive, with no assertion loosened and no case removed. The 118 committed index fixtures under `tests/fixtures/*/index_single_file/` were regenerated so the goldens carry the field, and the fixture pair added here gained its generated counterpart.

<!-- AC:END -->

## Implementation Notes

## High-level summary

Every scope in which `self`, `this`, `cls` or `Self` means something records which type it means. `LexicalScope.self_type_name` is set as the scope tree is built, from the declaration around the captured body node: a class, interface, enum or trait names itself, and a Rust `impl` block names the type it implements — never the trait. Everything else records null, and so does every shape whose type has no name a later lookup could reach. Nothing reads the field yet; TASK-376.5 replaces the backwards member-index scan with it.

Start at `packages/types/src/lexical_scope.ts` for the field and the contract it owes its first reader, `scopes/boundary_base.ts` for the extractor method and the shared read, the two extractors that override it for each grammar's divergence, and the "self_type_name" describe in `scopes.test.ts` for every shape at the index tier, including the cross-file Rust fixture pair whose `impl` blocks name a struct declared elsewhere.

### Where the read lives

Every grammar anchors a class-family scope to the body node — `class_body`, `interface_body`, `enum_body`, Python's `block`, Rust's `field_declaration_list`, `enum_variant_list` and `declaration_list` — so naming the type is one parent read, and it lives once on `CommonScopeBoundaryExtractor`. Two extractors override it. Rust adds the `impl` block, which is a block scope rather than a class scope. JavaScript and TypeScript subtract: a class expression's name binds only inside its own body, so recording it would point `this` at whatever enclosing binding shares that name. Each language withholds exactly what its own query declines to register — `javascript.scm` registers a named class expression assigned to a CommonJS export and nothing else, and `typescript.scm` registers no class expression at all, so the TypeScript extractor withholds that shape too. `PythonScopeBoundaryExtractor` implements the interface directly rather than extending the base, so it carries its own read, through the `find_enclosing_class_definition` walk it shares with boundary extraction.

### What records null, and why the reader must walk to scopes rather than to names

The field names only a type a lookup can reach. A Rust `impl` on a reference, a tuple or a scoped path wraps its type, and recording the wrapped name would claim `self` IS the owned type, which the member ladder cannot yet distinguish from an inherent impl. A blanket `impl<T> Tr for T` implements one of the block's own type parameters, which stands for every implementor and not for a definition; spelled as Rust convention allows (`impl<Handler> Service for Handler`) it would otherwise bind `self` to an unrelated type of that name. The Rust read is its own function rather than `extract_impl_type` from `symbol_factories.rust.ts`, which falls back to the type node's full text and would record `&S`.

Because a scope that owns `self` can record null, a consumer walks out to the nearest enclosing class-family scope or `impl` block, not to the nearest non-null field. The two differ exactly at those nulls: an anonymous class nested inside a named one records null, and stopping at the first name would answer with the outer class, which does not own the member. `lexical_scope.ts` states this contract.

A trait or interface body records the declaration itself. Its members are what interface-typed dispatch resolves through; the implementor `Self` names at run time is not knowable at index time, and TASK-376.13's subtype closure is what fans out from there.

The Python class scope keeps `name: null`: its capture is the body `block`, which has no name field, and `extract_scope_name` is untouched. The self type is read off the enclosing `class_definition`.

### Reach beyond the scope tree

The field is part of the serialized index, so `CURRENT_SCHEMA_VERSION` moves to 8: a cache blob written before the field existed is a format miss and its file is re-indexed, rather than deserializing scopes whose `self_type_name` is absent. The 118 committed index goldens under `tests/fixtures/*/index_single_file/` are regenerated for the same reason. That regeneration also picked up drift unrelated to this step in `python/index_single_file/classes/enum_and_protocol_shapes.json`, whose golden was missing a `methods` array the indexer already produced on the base tree.
