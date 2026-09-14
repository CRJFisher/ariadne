---
id: TASK-376.7
title: "Single-source the heritage graph and publish multi-valued parent_types"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - polymorphic_dispatch
dependencies:
  - TASK-376.17
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

§7 step 8. Wave 4, beside TASK-376.9 and TASK-376.10. Requires TASK-376.17 (it deletes STEP 3 from the `type.ts` that step reshaped, and resolves through TASK-376.6's `resolve_annotation`).

## Root cause

`DefinitionRegistry.type_subtypes` (`registries/definition.ts:153-154`, with its inverse `subtype_parents` at `:156-162` and the single writer `register_subtype` at `:444-458`) is populated twice from `def.extends` — by `register_type_inheritance` (`:588-602`, called at `:293-296`) through `resolve_type_name_in_scope` (`:609-621`), whose same-scope lookup excludes imports (`:197-220`), and by `resolve_cross_file_type_inheritance` (`:674-722`) through `resolutions.resolve` — and the inverse direction is built a third time by `TypeRegistry` STEP 3 (`registries/type.ts:234-260`), which keeps `resolved_parents[0]` as the parent class (`:253`) and demotes the rest to `implemented_interfaces`, which `get_type_member` (`:372-397`) then checks exactly one level deep (`:384-393`). `register_type_inheritance` runs twice per file because `populate_registries` (`project/project.ts:349`) and `fix_import_locations_for_file` (`:385`) both call `definitions.update_file`. The graph is therefore missing qualified TypeScript heritage (`implements o.TypeVisitor` parses to `nested_type_identifier`, which `extract_implements` at `symbol_factories.typescript.ts:245-274` does not handle), every Rust trait edge (`capture_handlers/methods.rust.ts:26-57`, `:85-115`, `:117-147` destructure `impl_info` from `find_containing_impl` at `symbol_factories.rust.ts:417-450` and never read its `trait_name`), every dotted Python base (`class PGDDLCompiler(compiler.DDLCompiler)`, TASK-374.4), every base past the first, and every edge registered under `is_subtype_registered` (`:724-736`), which matches the child's parents **by name** and so collapses two same-named interfaces from different modules — exactly Angular's `CompilerFacade` shape.

## Work plan

1. Widen heritage capture. `symbol_factories.typescript.ts`: `extract_implements` (`:245-274`) gains a `nested_type_identifier` arm and the `generic_type`-wrapping case; `extract_class_extends` (`:209-240`) gains a `member_expression` arm. Both push the qualified text verbatim — `ClassDefinition.extends` / `InterfaceDefinition.extends` entries (`packages/types/src/symbol_definitions.ts:91`, `:163`) may now be qualified as written (`"o.TypeVisitor"`, `"compiler.DDLCompiler"`), and the extractor no longer discriminates.
2. `capture_handlers/methods.rust.ts`: all three impl-block handlers drop the per-file `builder.find_class_by_name` / `find_enum_by_name` gate (`:47-55` and its twins) and emit the method unconditionally, carrying `impl_self_type: impl_info.struct_name` and `impl_trait_name: impl_info.trait_name`. Add `impl_self_type?: SymbolName` and `impl_trait_name?: SymbolName` to `MethodDefinition` (`symbol_definitions.ts:106-125`), tagged `@language rust`. The trait-default handler (`:59-83`) is unchanged.
3. Make `resolve_cross_file_type_inheritance` (`:674-722`) the single heritage builder: resolve each `extends` entry and each `impl_trait_name` through `TypeRegistry.resolve_annotation` (covering `o.TypeVisitor`, `compiler.DDLCompiler`, `BaseClass<T>`), and write every edge through `register_subtype` with a source tag. Change `type_subtypes` to `Map<SymbolId, Map<SymbolId, SubtypeEdgeSource>>` with `type SubtypeEdgeSource = "declared" | "structural"`, and make `subtype_parents` the multi-valued, source-ordered `parent_types: Map<SymbolId, SymbolId[]>` rather than adding a parallel map — one inverse index, one writer, `forget_type_edges` (`:491`) and `verify_reverse_indices` (`:748`) extended to the new shapes. Return the set of parent `SymbolId`s whose subtype set changed rather than `Set<FilePath>`. Keying on the terminal `SymbolId` is collision-safe by construction (`kind:file:span:name`), so Angular's two `CompilerFacade` declarations stay distinct.
4. Replace `is_subtype_registered` (`:724-736`) with a check on the resolved parent id, so a same-named parent from another module is a second edge, not a duplicate.
5. Delete `register_type_inheritance` (`:588-602`), its call site (`:293-296`) and `resolve_type_name_in_scope` (`:609-621`).
6. Delete `TypeRegistry` STEP 3 (`registries/type.ts:234-260`), `parent_classes`, `implemented_interfaces` and the "first resolved name is the parent class" heuristic. Make `walk_inheritance_chain(class_id)` (`:345-365`) return a BFS linearisation over `parent_types` (self, then bases in declaration order, then their bases) while keeping its signature, so `receiver_resolution.ts:224` still reads `chain[1]` for `super`; drop `get_type_member`'s separate one-level interface pass (`:384-393`), since the BFS chain now contains every ancestor. Verify no Phase-4 consumer (`project.ts:443-458`) depends on the inverse direction being populated after `type_preprocessing`; heritage now resolves in Phase 3.5 (`:417-427`).
7. Preserve the hit behaviour TASK-389 added: an interface-typed receiver still resolves to `[method_symbol, ...impls]` (`method_lookup.ts:176-182`), and `call_resolver.ts:394-425` still derives the interface id from `get_member_owner`.
8. Add registry unit tests: the builder resolves `"o.TypeVisitor"` through a namespace import to the terminal interface id and keys the edge on that id; a class implementing two same-named interfaces from different modules registers **both** edges; `parent_types` is source-ordered for `class X extends Base implements I`; `verify_reverse_indices` reports a corrupted edge map. Move the existing heritage cases in `definition.test.ts` to the new return type with their behavioural assertions intact.
9. Add integration tests (fixtures under `tests/fixtures/{typescript,rust,python}/code/integration/`) covering every evidence case for this step: angular's three `implements o.TypeVisitor` sites (`compiler/src/output/abstract_emitter.ts:216`, `compiler-cli/src/ngtsc/translator/src/translator.ts:85-86`, `…/type_translator.ts:39`) presenting implementers; Rust `impl DocFolder for CacheBuilder` recording the trait edge once for a multi-method block and an inherent `impl` recording none; Rust `fn walk<V: Visitor>(v: &mut V) { v.visit_item(); }` reaching every `impl Visitor for T`; a Rust trait default-body `self.fold_item` reaching a cross-file override; base/mixin `self.m()` reaching a subclass override, same file and cross file; `class C(Other, Mid)` with the member two hops up the second base (the full MRO case); and sqlalchemy's `class PG(compiler.DDLCompiler)` with `super().visit_create_sequence(c)` resolving to the base method, mirroring the bare-base case already pinned in `resolve_references.python.test.ts` — TASK-374.4 closes here.

Gates TASK-376.13, TASK-376.8 and TASK-376.14.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `resolve_cross_file_type_inheritance` is the only heritage builder; `register_type_inheritance`, `resolve_type_name_in_scope`, `is_subtype_registered`, `TypeRegistry` STEP 3, `parent_classes` and `implemented_interfaces` are deleted.
- [x] #2 `parent_types` is the multi-valued, source-ordered inverse index written by `register_subtype`, `type_subtypes` edges carry `"declared" | "structural"`, and `verify_reverse_indices` covers both.
- [x] #3 `walk_inheritance_chain` returns a BFS linearisation and `chain[1]` still serves `super`; `get_type_member` resolves members any number of hops up, through interfaces as well as classes; the `[method_symbol, ...impls]` hit behaviour from TASK-389 is unchanged.
- [x] #4 Qualified TypeScript heritage (`implements o.TypeVisitor`, `extends o.Base`), dotted Python bases (`compiler.DDLCompiler`) and Rust trait edges (`impl Tr for S`) are recorded, including for a cross-file impl whose type is declared elsewhere.
- [x] #5 Two same-named interfaces from different modules register both edges and stay distinct ids (angular `CompilerFacade`).
- [x] #6 Integration tests cover all of this step's evidence cases: angular's three `o.TypeVisitor` implementers, `impl DocFolder for CacheBuilder`, the generic `fn walk<V: Visitor>` fan-out, the Rust trait default-body cross-file override, cross-file base/mixin `self.m()`, `class C(Other, Mid)` two hops up the second base, and the sqlalchemy dotted-base `super()` edge.

<!-- AC:END -->

## Implementation notes

- **Builder.** `DefinitionRegistry.resolve_type_heritage` is the single heritage builder. It was renamed from `resolve_cross_file_type_inheritance` because it now resolves every edge, same-file and Rust included. It runs in Phase 3.5 and resolves each name through `TypeRegistry.resolve_type_name`, the annotation resolver. It returns the parent ids whose subtype sets changed, and `Project` maps those to files for re-resolution.
- **Graph storage.** The graph moved into `registries/subtype_graph.ts` (`SubtypeGraph`), composed by `DefinitionRegistry` in the same way as `MemberIndex`. An edge in `type_subtypes` carries `{ source: "declared" | "structural", written_by }`. `written_by` records which file wrote the edge, so a Rust `impl Trait for T` in a file that declares neither end is evicted with that file. `edges_by_file` indexes those writers. Evicted edges are held per writing file until its next heritage pass, which lets a dropped `implements` re-dispatch the parent's call sites. `Project.remove_file` drains the same record for a deleted file. `verify()` checks `parent_types` (membership, no duplicates, declared before structural) and `edges_by_file` against `type_subtypes`.
- **Type registry.** `TypeRegistry` takes the `DefinitionRegistry` in its constructor and reads `get_parent_types`, and `TypeResolutionContext` no longer carries `definitions`. `find_constructor_in_class_hierarchy` walks `get_parent_types` rather than re-resolving `extends` names.
- **Rust impl methods.** `MethodDefinition` carries `impl_self_type` and `impl_trait_name`. An impl method whose type another file declares is emitted in `SemanticIndex.unattached_impl_methods`, with its parameters, and is persisted. Emitting those methods without attaching them produced false entry points, so `DefinitionRegistry.attach_impl_methods` resolves `impl_self_type` in Phase 3.5 and joins each method to that type's member index and ownership, credited to the impl file. This is TASK-376.8 work-plan step 1. Retrying callers resolved before the impl file arrived stays with TASK-376.8 and TASK-376.13.
- **Known gap.** A receiver typed by a trait-bound generic (`fn walk<V: Visitor>(v: &mut V)`) stays unresolved, because binding `V` through its bound is TASK-376.15 step 2. The `dyn Visitor` fan-out and the trait's full subtype set are asserted, and the generic form is an `it.todo` in `type.integration.test.ts`.
- **Fixture corpus.** On the Rust fixture corpus, raw entry points go from 63 to 57. The six trait-impl `process`/`get_name` methods reached through `&dyn Handler`, and the two new `visit_item` impls, drop out. `descend` and `visit` in `integration/impls.rs` are now indexed and genuinely uncalled. The per-corpus tallies in `call_resolver.test.ts` are re-pinned for the new heritage fixtures and the resolved trait dispatches.
