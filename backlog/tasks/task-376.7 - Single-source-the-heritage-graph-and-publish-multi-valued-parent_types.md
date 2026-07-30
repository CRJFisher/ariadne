---
id: TASK-376.7
title: "Single-source the heritage graph and publish multi-valued parent_types"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - polymorphic_dispatch
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 7000
plan_dedup_keys:
  - 18677ae125ac654f63e0c65c2e53cd412010ee840433a4badb088799a63f4cdc
plan_source_tasks:
  - pt-3c0eabc716806a85
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 8. Requires §7 step 6 (the annotation resolver) and the diagnostic completeness landed on the epic.

## Root cause

`DefinitionRegistry.type_subtypes` (`registries/definition.ts:89`) is built twice from `def.extends` — by `register_type_inheritance` (`:348-367`) through `resolve_type_name_in_scope`, whose index excludes imports (`:108-119`), and by `resolve_cross_file_type_inheritance` (`:439-489`) through `resolutions.resolve` — and the inverse direction is built a third time by `TypeRegistry` STEP 3 (`registries/type.ts:234-260`), which keeps `resolved_parents[0]` as the parent class and demotes the rest to `implemented_interfaces`, which `get_type_member` then checks exactly one level deep (`:369-394`). The graph is therefore missing qualified TypeScript heritage (`implements o.TypeVisitor` parses to `nested_type_identifier` and is dropped by `symbol_factories.typescript.ts:244-273`), every Rust trait edge (`capture_handlers/methods.rust.ts:26-57` computes `impl_info.trait_name` and discards it), every base past the first, and every edge registered under `is_subtype_registered` (`:491-504`), which short-circuits after the first same-named parent — exactly Angular's `CompilerFacade` shape.

## Work plan

1. Widen heritage capture. `symbol_factories.typescript.ts`: `extract_implements` (`:244-273`) gains a `nested_type_identifier` arm and the `generic_type`-wrapping case; `extract_class_extends` (`:208-239`) gains a `member_expression` arm. Both push the qualified text verbatim — `AnyDefinition.extends` entries may now be qualified as written (`"o.TypeVisitor"`, `"compiler.DDLCompiler"`), and the extractor no longer discriminates.
2. `capture_handlers/methods.rust.ts`: all three handlers (`:37-56`, `:95-114`, `:127-146`) drop the per-file `builder.find_class_by_name` / `find_enum_by_name` gate and emit the method unconditionally, carrying `impl_self_type: impl_info.struct_name` and `impl_trait_name: impl_info.trait_name` (`find_containing_impl`, `symbol_factories.rust.ts:328-355`, already extracts both). Add `impl_self_type?: SymbolName` and `impl_trait_name?: SymbolName` to `MethodDefinition` in `packages/types/src/symbol_definitions.ts`, tagged `@language rust`.
3. Make `resolve_cross_file_type_inheritance` (`:439-489`) the single heritage builder: resolve each `extends` entry through `TypeRegistry.resolve_annotation` (covering `o.TypeVisitor`, `compiler.DDLCompiler`, `BaseClass<T>` and Rust `impl_trait_name`), record `SubtypeEdgeSource: "declared"`, publish the inverse edge into a multi-valued `parent_types: Map<SymbolId, SymbolId[]>` (all bases, source order), and return the set of interface `SymbolId`s whose implementer set changed rather than `Set<FilePath>`. Change `type_subtypes` to `Map<SymbolId, Map<SymbolId, SubtypeEdgeSource>>` with `type SubtypeEdgeSource = "declared" | "structural"`. Keying on the terminal `SymbolId` is collision-safe by construction (`kind:file:span:name`), so Angular's two `CompilerFacade` declarations stay distinct.
4. Replace `is_subtype_registered` (`:491-504`) with `registered_parent_names: Map<SymbolId, Set<SymbolName>>`.
5. Delete `register_type_inheritance` (`:348-367`), its call site (`:173-176`) and `resolve_type_name_in_scope` (`:374-386`) — they register a strict subset and run twice per file because `apply_index_and_resolve` calls `definitions.update_file` at both `project/project.ts:236` and `:262`.
6. Delete `TypeRegistry` STEP 3 (`registries/type.ts:234-260`), the "first resolved name is the parent class" heuristic (`:253`) and `implemented_interfaces`. Make `walk_inheritance_chain(class_id)` return a BFS linearisation (self, then bases in declaration order, then their bases) while keeping its signature, so `receiver_resolution.ts:213` still reads `chain[1]` for `super`; drop `get_type_member`'s separate one-level interface pass (`:369-394`), since the BFS chain now contains every ancestor. Verify no Phase-4 consumer depends on `parent_types` being populated after `type_preprocessing`.
7. Add registry unit tests: the builder resolves `"o.TypeVisitor"` through a namespace import to the terminal interface id and keys the edge on that id; a class implementing two same-named interfaces from different modules registers **both** edges; `parent_types` populates correctly for `class X extends Base implements I` — the case the deleted heuristic mis-assigned. Move the existing cases at `definition.test.ts:931-1140` to the new return type with their behavioural assertions intact.
8. Add integration tests (with fixtures under `tests/fixtures/{typescript,rust,python}/code/integration/`) covering every evidence case for this step: angular's three `implements o.TypeVisitor` sites (`compiler/src/output/abstract_emitter.ts:216`, `compiler-cli/src/ngtsc/translator/src/translator.ts:85-86`, `…/type_translator.ts:39`) presenting implementers; Rust `impl DocFolder for CacheBuilder` recording the trait edge once for a multi-method block and an inherent `impl` recording none; Rust `fn walk<V: Visitor>(v: &mut V) { v.visit_item(); }` reaching every `impl Visitor for T`; a Rust trait default-body `self.fold_item` reaching a cross-file override; base/mixin `self.m()` reaching a subclass override, same file and cross file; and `class C(Other, Mid)` with the member two hops up the second base (the full MRO case).

Gates §7 steps 14 and 15.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `resolve_cross_file_type_inheritance` is the only heritage builder; `register_type_inheritance`, `resolve_type_name_in_scope`, `is_subtype_registered`, `TypeRegistry` STEP 3 and `implemented_interfaces` are deleted.
- [ ] #2 `parent_types` is multi-valued in source order and `type_subtypes` edges carry `"declared" | "structural"`.
- [ ] #3 `walk_inheritance_chain` returns a BFS linearisation and `chain[1]` still serves `super`; `get_type_member` resolves members any number of hops up, through interfaces as well as classes.
- [ ] #4 Qualified TypeScript heritage (`implements o.TypeVisitor`, `extends o.Base`) and Rust trait edges (`impl Tr for S`) are recorded, including for a cross-file impl whose type is declared elsewhere.
- [ ] #5 Two same-named interfaces from different modules register both edges and stay distinct ids (angular `CompilerFacade`).
- [ ] #6 Integration tests cover all of this step's evidence cases: angular's three `o.TypeVisitor` implementers, `impl DocFolder for CacheBuilder`, the generic `fn walk<V: Visitor>` fan-out, the Rust trait default-body cross-file override, cross-file base/mixin `self.m()`, and `class C(Other, Mid)` two hops up the second base.

<!-- AC:END -->
