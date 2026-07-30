---
id: TASK-376.6
title: "Parse and resolve type annotations through one annotation resolver"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 6000
plan_dedup_keys:
  - 0e22b80c5c462fe09811b691c356acd4ba463187ec5a16d2d6572af18f27517e
plan_source_tasks:
  - pt-1a5dac3859e0733c
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 6.

## Root cause

`ResolutionRegistry.resolve` (`resolve_references/resolution_state.ts:90-96`) is a two-level `Map` lookup keyed on bare declared names, and six sites hand it raw annotation text with no parse: `registries/type.ts:161` (STEP 1), `:218` (STEP 1.5), `:246` (STEP 3), and `call_resolution/receiver_resolution.ts:278`, `:346`, `:460`. An annotation therefore resolves if and only if its source text is byte-identical to a declared name. Probed over a live `Project`: Rust `x: S` resolves while `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>`, `impl Emit` do not; TypeScript `a: F` resolves, `F | null` does not; Python `C` resolves, `Optional[C]`, `Union[C, None]`, `"C"` do not; JSDoc `{ChunkGraph}` resolves, `{ChunkGraph=}`, `{ChunkGraph|null}`, `{import("./a").X}` do not. The only parser in the codebase, `parse_single_type_argument` (`receiver_resolution.ts:473-498`), unwraps one hard-coded `Wrapper<Inner>` shape and rejects anything containing a comma. This one defect is 1049 of `receiver_type_inference`'s 1149 evidence rows.

Normalisation stays at **resolve time**: `metadata_extractors.rust.ts:44-60` (`extract_rust_type`) is unchanged, because the index-time strip discards exactly the data `symbol_type_arguments` and the element hop need, and because unwrapping is a policy (`Option<T>`/`Box<T>` unwrap because `Deref` makes methods reachable; `Vec<T>` must not).

## Work plan

1. Add `resolve_references/type_preprocessing/annotation.ts` — `parse_type_annotation(text, language)` returning `ParsedTypeAnnotation { head: readonly SymbolName[]; arguments: readonly ParsedTypeAnnotation[] }`, a pure registry-free marshaller matching the folder's existing character.
2. Add four language leaves: `annotation.typescript.ts` (`| null`, `| undefined`, `?`, `readonly`, `T[]` → head `Array` + argument, recursive `<…>`, dotted head); `annotation.javascript.ts` (`{X=}`, `{X|null}`, `{?X}`, `{Array<X>}`, `{import("./mod").X}`); `annotation.python.ts` (`Optional[X]`, `Union[X, None]`, quoted forward references, `[…]` arguments, dotted head); `annotation.rust.ts` (`&`, `&mut`, lifetimes, `dyn`, `impl`; `Option<T>` / `Box<T>` / `Rc<T>` / `Arc<T>` unwrap to `T` while `Vec<T>` / `HashMap<K, V>` keep head + arguments; `::`-qualified head). Keep the unwrap list fixed and short — it is the one place a wrong entry produces a false _positive_.
3. Add `TypeRegistry.resolve_annotation(scope_id, text, language, …)` and `resolve_annotation_arguments(...)` in `registries/type.ts`: parse, resolve a bare head through `resolutions.resolve`, and resolve a qualified head (`vfs.FileSystem`, `crate::a::State`, `compiler.DDLCompiler`) by resolving the first segment in the declaring scope, requiring `kind === "import"` with `import_kind === "namespace"`, then following `resolve_namespace_export` (already imported at `:20`) — the same collision safety STEP 1b relies on at `:182-191`.
4. Route all six raw call sites through it.
5. Split `symbol_types` and land every read site in the same change: `symbol_types` becomes value types only, new `callable_return_types: Map<SymbolId, SymbolId>` holds function/method/constructor returns, new `symbol_type_arguments: Map<SymbolId, readonly SymbolId[]>` holds resolved arguments. Split `type_preprocessing/bindings.ts` into `value_bindings` (variable / parameter / property `type`) and `return_bindings` (`return_type`), the conflation's source at `:38-47` and `:50-59`, and add class-property and Rust struct-field annotations as value bindings. Extend `resolved_by_file` eviction (`registries/type.ts:396-411`) to the new maps.
6. Fold STEP 1b (`:168-197`) into STEP 1 — a namespace-qualified constructor chain is the same qualified-head resolution — and have `constructor_bindings.ts` return one map keyed by qualified chain, so `:31-46` collapses.
7. Widen STEP 2 (`:225-232`) to read the `SemanticIndex`'s `classes` / `interfaces` / `enums` directly for `{ symbol_id, extends }`, and delete `extract_type_members` (`type_preprocessing/member.ts:60-143`) plus `TypeRegistry.get_type_members` (`:267-311`), the `definitions` field held only for it (`:60`), `Project.get_type_info` (`project/project.ts:582-584`) and `TypeMemberInfo`'s dead `methods`/`properties` fields. Update `type_preprocessing/index.ts:9`.
8. In `receiver_resolution.ts`, delete the `def.type` fallback in `resolve_identifier_base` (`:271-279`) and the `member_def.type` fallback in `walk_property_chain` (`:340-347`) — both duplicate STEP 1 in the same scope with the same resolver — and delete `parse_single_type_argument` (`:473-498`). Have `walk_property_chain` read `callable_return_types` for a `method` member and `symbol_types` otherwise, which is the method-return hop recorded rather than re-resolved.
9. Add pure unit tests in `annotation.test.ts`, one table per language, covering every probed evidence form: TypeScript `F`, `F | null`, `F | undefined`, `readonly F[]`, `F[]`, `Promise<F>`, `Map<K, V>`, `vfs.FileSystem`, `Provider<Foo<Bar>>`; JavaScript `{X}`, `{X=}`, `{X|null}`, `{?X}`, `{Array<X>}`, `{import("./a").X}`; Python `C`, `Optional[C]`, `Union[C, None]`, `"C"`, `List[C]`, `Mapper[_T]`, `type[C]`, `mod.C`; Rust `S`, `&S`, `&mut S`, `&'a S`, `Option<Enc>`, `Box<dyn Emit>`, `Vec<Enc>`, `impl Emit`, `HashMap<K, V>`, `crate::a::State`.
10. Add integration tests at the `Project` + `update_file` tier turning the §1 probe matrix into passing assertions — every row currently reading `receiver_type_unknown` / `member_type_unknown` for each of the forms above becomes a resolved call, and every row currently reading `n=1` becomes an insulation test. Include a two-hop `export *` namespace-barrel chain fixture per qualified-head case under `tests/fixtures/{typescript,rust,python,javascript}/code/integration/`, plus the chained-receiver cases (`e.connect().exec()`) that guard the `symbol_types` split.

The largest single recovery; §7 steps 8-16 all depend on it. Measure call-edge deltas on angular, django, rustc and pandas as it lands.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `parse_type_annotation` and its four language leaves exist as pure functions, and `TypeRegistry.resolve_annotation` is the only path from annotation text to a `SymbolId`.
- [ ] #2 All six raw `resolutions.resolve` annotation call sites route through `resolve_annotation`; `parse_single_type_argument` and both `def.type` / `member_def.type` fallbacks are deleted.
- [ ] #3 `symbol_types` holds value types only, with `callable_return_types` and `symbol_type_arguments` added, every read site re-aimed in the same change, and eviction covering the new maps.
- [ ] #4 `extract_type_members`, `TypeRegistry.get_type_members`, `Project.get_type_info` and `TypeMemberInfo.methods`/`properties` are deleted, with their test assertions moved onto `get_member_index()` / `get_type_member()` with unchanged values.
- [ ] #5 Unit tables in `annotation.test.ts` cover every probed form per language, including the Rust unwrap policy (`Option<T>`/`Box<T>`/`Rc<T>`/`Arc<T>` unwrap; `Vec<T>`/`HashMap<K, V>` do not).
- [ ] #6 Integration tests reproduce the whole §1 probe matrix: Rust `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>`, `impl Emit`; TypeScript `F | null` and `vfs.FileSystem`; Python `Optional[C]`, `Union[C, None]`, `"C"`, `mod.C`; JSDoc `{ChunkGraph=}`, `{ChunkGraph|null}`, `{import("./a").X}` — each resolving to the declared type.
- [ ] #7 Chained-receiver resolutions that depend on the old conflation (`e.connect().exec()`) stay green, and edge-count deltas are measured on angular, django, rustc and pandas.

<!-- AC:END -->
