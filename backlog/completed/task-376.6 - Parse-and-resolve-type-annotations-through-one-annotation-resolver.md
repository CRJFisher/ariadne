---
id: TASK-376.6
title: "Parse and resolve type annotations through one annotation resolver"
status: Done
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

§7 step 6, first half. The second half — the `symbol_types` / `callable_return_types` split, the `bindings.ts` value/return split, the method-return hop in `walk_property_chain`, and the deletion of `extract_type_members` / `get_type_members` / `get_type_info` / `TypeMemberInfo` — is TASK-376.17, per the parent epic's wave plan.

## Root cause

`ResolutionRegistry.resolve` (`resolve_references/resolution_state.ts:134-141`) is a two-level `Map` lookup keyed on bare declared names, and six sites handed it raw annotation text with no parse: `registries/type.ts` STEP 1, STEP 1.5 and STEP 3, and in `call_resolution/receiver_resolution.ts` the `def.type` fallback in `resolve_identifier_base`, the `member_def.type` fallback in `walk_property_chain`, and `resolve_token_argument_type`. An annotation therefore resolved if and only if its source text was byte-identical to a declared name. Probed over a live `Project`: Rust `x: S` resolved while `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>`, `impl Emit` did not; TypeScript `a: F` resolved, `F | null` did not; Python `C` resolved, `Optional[C]`, `Union[C, None]`, `"C"` did not; JSDoc `{ChunkGraph}` resolved, `{ChunkGraph=}`, `{ChunkGraph|null}`, `{import("./a").X}` did not. The only parser in the codebase, `parse_single_type_argument`, unwrapped one hard-coded `Wrapper<Inner>` shape and rejected anything containing a comma. This one defect is 1049 of `receiver_type_inference`'s 1149 evidence rows.

Normalisation stays at **resolve time**: `metadata_extractors.rust.ts` (`extract_rust_type`) is unchanged, because the index-time strip discards exactly the data `symbol_type_arguments` and the element hop need, and because unwrapping is a policy (`Option<T>`/`Box<T>` unwrap because `Deref` makes methods reachable; `Vec<T>` must not).

## Work plan

1. Add `resolve_references/type_preprocessing/annotation.ts` — `parse_type_annotation(text, language)` returning `ParsedTypeAnnotation { head: readonly SymbolName[]; arguments: readonly ParsedTypeAnnotation[]; module_specifier?: string }`, a pure registry-free marshaller.
2. Add four language leaves and the shared scanner: `annotation.typescript.ts` (`| null`, `| undefined`, `?`, `readonly`, `T[]` → head `Array` + argument, recursive `<…>`, dotted head, inline `import("…").X`); `annotation.javascript.ts` (`{X=}`, `{X|null}`, `{?X}`, `{!X}`, `{Array.<X>}`, then the TypeScript grammar); `annotation.python.ts` (`Optional[X]`, `Union[X, None]`, `X | None`, quoted forward references, `[…]` arguments, dotted head); `annotation.rust.ts` (`&`, `&mut`, lifetimes, `dyn`, `impl`; `Option<T>` / `Box<T>` / `Rc<T>` / `Arc<T>` unwrap to `T` when written bare or through `std`/`core`/`alloc`, while `Vec<T>` / `HashMap<K, V>` keep head + arguments; `::`-qualified head); `annotation_syntax.ts` (one quote-aware bracket scanner under every split).
3. Add `TypeRegistry.resolve_annotation` / `resolve_annotation_arguments` over one head resolver, `resolve_type_head`: a bare head resolves in lexical scope; a qualified head descends one module per segment, only out of an import that denotes a whole module (a namespace import, or a named import of a submodule — `from django.db import models`) and then through `resolve_module_member`; a Rust `::` head goes to the Rust path resolver, which `Project` injects as `TypeResolutionContext.resolve_rust_type_path` because registries never import `call_resolution`; an inline `import("./m").X` resolves among the named module's members and records the module as a `module_path_read` of the file, so load order does not matter.
4. Route all six raw sites through it: STEP 1, STEP 1.5 and STEP 3 call `resolve_annotation`; the two receiver fallbacks are deleted (item 7); the type-token path reads `symbol_type_arguments` (item 8).
5. Add `symbol_type_arguments: Map<SymbolId, readonly SymbolId[]>` with `get_symbol_type_arguments`, recorded all-or-nothing from the annotation that decides a binding (STEP 1 and STEP 1.5), never from an annotation a construction overrode, and evicted in `remove_file` and `clear`. Key `extract_type_bindings` by `SymbolId` rather than location, so two definitions over one span — a TypeScript constructor parameter property, a Python class-body annotation — each keep their binding.
6. Fold STEP 1b into STEP 1 — a namespace-qualified constructor chain is the same qualified-head resolution under the same `names_a_type` guard — and have `constructor_bindings.ts` return one map keyed by location to the constructed name chain. `TypeRegistry.update_file` takes one `TypeResolutionContext` in place of its optional `import_source_resolver`.
7. In `receiver_resolution.ts`, delete the `def.type` fallback in `resolve_identifier_base` and the `member_def.type` fallback in `walk_property_chain`; a field that shares a callable's name continues through the field's recorded type.
8. Delete `parse_single_type_argument`. `infer_generic_return_from_type_token` parses the method's parameter annotations (`is_type_token_for`: a single-argument generic wrapping exactly the return type parameter, never an `Array`), and `resolve_token_argument_type` reads the token binding's single recorded type argument.
9. Unit tables per language in `annotation.{typescript,javascript,python,rust}.test.ts`, the dispatch table in `annotation.test.ts`, and the scanner in `annotation_syntax.test.ts`.
10. Integration tests at the `Project` + `update_file` tier in `registries/type.integration.test.ts` for the §1 probe matrix, its insulation rows, a two-hop barrel fixture per qualified-head case under `tests/fixtures/{typescript,rust,python,javascript}/code/integration/annotation_*` in both load orders, chained and factory receivers through nullable return annotations, Python heritage through a module alias, incremental re-edit, and the construction-wins argument rule.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `parse_type_annotation` and its four language leaves exist as pure functions, and `TypeRegistry.resolve_annotation` is the only path from annotation text to a `SymbolId`.
- [x] #2 All six raw `resolutions.resolve` annotation call sites route through `resolve_annotation`; `parse_single_type_argument` and both `def.type` / `member_def.type` fallbacks are deleted.
- [x] #3 `symbol_type_arguments` is recorded from the deciding annotation, read by the type-token path, and evicted with its file.
- [x] #4 STEP 1b is folded into STEP 1 and `constructor_bindings.ts` returns one chain-valued map.
- [x] #5 Unit tables cover every probed form per language, including the Rust unwrap policy (`Option<T>`/`Box<T>`/`Rc<T>`/`Arc<T>` unwrap; `Vec<T>`/`HashMap<K, V>` and a user-qualified `widgets::Option<T>` do not).
- [x] #6 Integration tests reproduce the whole §1 probe matrix: Rust `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>`, `impl Emit`; TypeScript `F | null` and `vfs.FileSystem`; Python `Optional[C]`, `Union[C, None]`, `"C"`, `mod.C`; JSDoc `{ChunkGraph=}`, `{ChunkGraph|null}`, `{import("./a").X}` — each resolving to the declared type.
- [x] #7 Chained-receiver resolutions (`e.connect().exec()`) stay green, and edge-count deltas are measured on angular, django, rustc and pandas.

<!-- AC:END -->

## Implementation notes

### What the capability surface gains

A receiver typed by any wrapped or qualified annotation now reaches its type's methods, so those methods stop surfacing as false entry points. On the four measurement corpora this is the largest recovery the epic has landed (table below). Specifically, calls now resolve through:

- nullish unions in all four languages
- Rust references, lifetimes and the fixed smart-pointer set, including a `Box<T>` field hop (`self.inner.enc()`)
- constructor parameter properties, typed through the property's own annotation
- module-qualified annotations and constructor chains, through namespace imports, submodule imports and Rust `::` paths (`a::State`, `crate::a::State`), across two-hop `export *` / `pub use` / star-import barrels
- JSDoc and TypeScript inline `import("./m").X` types
- Python base classes written through a module alias (`class Dog(zoo.Animal)`), which makes inherited `self.m()` and `super()` resolve — the `no_parent_class` rows fall on django and pandas
- factory variables and chained calls whose declared return type is nullable

### Where resolution now stops, and who owns it

- `Box<dyn Emit>` / `impl Emit` type the binding as the trait; the call still ends `polymorphic_no_implementations` because no Rust trait-impl edge is recorded yet — TASK-376.7.
- TypeScript qualified heritage (`class Dog extends zoo.Animal`) never reaches STEP 3: the indexer drops the `nested_type_identifier` / member-expression base — TASK-376.7.
- A Rust `Self::Assoc` annotation resolves to nothing: the Rust path resolver substitutes `Self` only for a callable terminal, never a type terminal.
- A JSDoc `@type` on a `const` is not captured by the indexer, so `/** @type {X} */ const y` stays untyped — TASK-376.9.
- `get<T>(token: Array<T>): T` no longer infers `T` from its argument. `Array<T>` and `T[]` parse to the same shape and both hold values of `T` rather than designating it; the previous acceptance of `Array<T>` and rejection of `T[]` was an artefact of comparing raw text.
- The fold of STEP 1b applies `names_a_type` to namespace-qualified constructions, exactly as direct `new User()` constructions already required, so `new ns.plain_function()` types nothing.

### Measurement

Rows come from `run_load_benchmark.ts --baseline` over each corpus with the recorded commit and predicate, the control arm on `7614ff48` (the tree before this step) and the candidate arm on this step's tree, same box, same session. `call_references` counts synthetic callback invocations, which exist only for resolved calls, so it grows with resolution.

| Corpus (commit, predicate) | Arm | Call refs | Resolved | `receiver_type_unknown` | `member_type_unknown` | `method_not_on_type` | `polymorphic_no_implementations` | `no_parent_class` | Call edges | Raw entry points |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| angular/angular `5ad82313`, `repository-root` | control | 376856 | 148550 | 61737 | 7633 | 6068 | 941 | 173 | 141327 | 4263 |
| | candidate | 377609 | 152279 | 57230 | 7612 | 6938 | 1621 | 173 | 147963 | 3770 |
| | delta | +753 | **+3729** | −4507 | −21 | +870 | +680 | 0 | **+6636** | **−493** |
| rust-lang/rust `e7b59555`, `repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests` | control | 328739 | 82121 | 101145 | 24015 | 18156 | 492 | 1277 | 65061 | 16575 |
| | candidate | 328739 | 96620 | 78049 | 16640 | 33834 | 786 | 1277 | 76342 | 14843 |
| | delta | 0 | **+14499** | −23096 | −7375 | +15678 | +294 | 0 | **+11281** | **−1732** |
| django/django `957d0cee`, `repository-root-excluding:js_tests,scripts,docs` | control | 202710 | 82289 | 20133 | 2047 | 66115 | 0 | 845 | 69720 | 2419 |
| | candidate | 202814 | 83689 | 20133 | 2116 | 65220 | 0 | 375 | 71079 | 2399 |
| | delta | +104 | **+1400** | 0 | +69 | −895 | 0 | −470 | **+1359** | **−20** |
| pandas-dev/pandas `7986b425`, `repository-root` | control | 240516 | 111070 | 25675 | 1380 | 40303 | 0 | 447 | 78672 | 2280 |
| | candidate | 242417 | 113345 | 25738 | 1443 | 40198 | 1 | 51 | 80049 | 2262 |
| | delta | +1901 | **+2275** | +63 | +63 | −105 | +1 | −396 | **+1377** | **−18** |

`name_not_in_scope`, `constructor_target_not_a_class`, `no_enclosing_class_scope`, `class_definition_not_found`, `collection_dispatch_miss` (±2) and `definition_has_no_body_scope` are unchanged on every corpus. Reading the deltas:

- **rustc and angular** carry the recovery: `receiver_type_unknown` falls by 23,096 and 4,507. Part of it moves to `method_not_on_type` (+15,678 and +870): the receiver now has a type, but the method sits on a trait, a `Deref` target or a standard-library type the project does not hold. Another part moves to `polymorphic_no_implementations` (+294 and +680): an interface or trait receiver with no recorded implementer. Those are TASK-376.7, TASK-376.8 and TASK-376.13's rows.
- **django and pandas** gain mostly through heritage. Dotted Python bases now resolve, so `no_parent_class` falls by 470 and 396, and inherited `self.m()` calls land.
- **Fan-out.** Raw entry points fall and resolved totals rise on all four corpora. These are aggregate counts: new false negatives by literal set difference are TASK-376.18's measurement, and rung-5 fan-out is TASK-376.13's row.
