---
id: TASK-376.10
title: "Resolve container element types and stop mistyping the container"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - receiver_type_inference
dependencies:
  - TASK-376.17
parent_task_id: TASK-376
priority: high
ordinal: 10000
plan_dedup_keys:
  - ad6c0a78f72e7a3016b06be3859a313d2189ab56ecd998df14168c44160adc8a
plan_source_tasks:
  - pt-0a1264c1f1e4bfa4
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 11. Wave 4, beside TASK-376.7 and TASK-376.9. Requires TASK-376.17 (it consumes `symbol_type_arguments` from TASK-376.6 and edits the `walk_property_chain` that step re-aimed). Carries the container half of TASK-394.

## Root cause

Container data is already captured; only the resolver hop is missing. `extract_receiver` (`call_resolution/receiver_resolution.ts:93-129`) builds a `ReceiverExpression` (`:51-66`: `base`, `chain`, `chain_arguments`, `method_name`, `scope_id`) and discards `call_site_syntax` entirely — the only reader is `call_resolver.ts:432-439`, which copies it onto the emitted `CallReference` — which is the one reason `suites[0].m()` and `suites.m()` are indistinguishable downstream. Nothing consumes the type arguments of `Suite[]`, `list[Suite]`, `dict[str, Suite]`, `Vec<Layer>` or `DisposableMap<string, IEditorContribution>`. Meanwhile `constructor_bindings.ts:38-44` keys the construct target of `var suites = [new Suite("root")]` to the **declarator**, typing the _container_ as `Suite`, and `get_collection_functions` (`collection_dispatch.ts:216-255`) pushes every resolved `stored_references` name (`:237-242`) without inspecting the target's kind, returning a non-function element as a call target and producing mocha's wrong `addTest -> suite` edge.

## Work plan

1. Consume `symbol_type_arguments` (recorded by TASK-376.6) for loop targets (`for (const x of map)`, `for x in xs`), destructuring targets, index targets and `.get(k)` reads, so the element type of a container binding is available where the element is used as a receiver. State in the module the closed set of container shapes that carry their element type (`Array` / `T[]`, `Map`, `Set`, `list`, `dict`, `Vec`, `HashMap`, and the vscode `DisposableMap` shape by its declared type arguments), and measure the set over vscode `src/` at `f3fa55c3`, where TASK-394's eleven `dispose` sites are disposed by iterating a `DisposableMap<string, IEditorContribution>`.
2. Add `index_access?: { key_is_literal: boolean }` to `ReceiverExpression` (`:51-66`) and populate it in `extract_receiver` (`:93-129`) from `call_site_syntax` — `receiver_kind === "index_access"` with `index_key_is_literal` is already emitted by `call_site_syntax.typescript.ts:189-194` and `call_site_syntax.python.ts:143-148`. A non-literal key stays unresolved and remains the `is_dynamic_dispatch` classifier feature at `derive_syntactic_features.ts:27-28`.
3. Take the element type from `symbol_type_arguments` on the container's binding, or from the container's element expressions (`FunctionCollection.stored_references`). One element type, never a union.
4. Add the non-callable guard to `get_collection_functions` (`:216-255`): return `collection_dispatch_miss` instead of a target when a resolved element is not a function/method definition, so the element flows on as a receiver type instead. `collection_dispatch` is narrowed here, not widened — the keyed-alias and keyless-union paths are untouched.
5. Remove the container mistyping in `type_preprocessing/constructor_bindings.ts:38-44` — **in this same commit**, or currently-green resolutions that depend on `var suites = [new Suite()]` typing the container regress. The signal moves to the element channel.
6. Confirm whether `element_type_annotation` is needed at all: for every evidence row the annotation lives on the holder's own `type` field. Drop the field rather than carry it if no counter-example appears.
7. Add integration tests (fixtures under `tests/fixtures/{javascript,typescript,python,rust}/code/integration/`) covering every evidence case for this step: mocha `@param {Suite[]} suites` + `suites[0].afterEach()`; mocha `var suites = [suite]` + `suites[0].beforeAll()`; mocha `var s = suites[0]; s.addTest(t)` asserting **no** edge to the element identifier (the wrong `addTest -> suite` edge is gone); a Python `list[Suite]` and `dict[str, Suite]` element receiver; a Rust `Vec<Layer>` element receiver; a TypeScript `for (const c of contributions)` over a `Map<string, IEditorContribution>` and a `map.get(k)!.dispose()` (the TASK-394 container shape); a non-literal index key staying unresolved; and the `var suites = [new Suite("root")]` container case asserting the container is no longer typed `Suite` while the element receiver still resolves.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Element receivers resolve from `symbol_type_arguments` for `Suite[]`, `list[Suite]`, `dict[str, Suite]`, `Vec<Layer>` and `Map<K, V>` / `DisposableMap<K, V>` loop and `.get()` reads, and from container element expressions where no annotation exists; the container-shape set is stated in the module and measured over vscode `src/`.
- [x] #2 `ReceiverExpression.index_access` is populated from `call_site_syntax`, and a non-literal key stays unresolved and keeps feeding the `is_dynamic_dispatch` classifier feature.
- [x] #3 `get_collection_functions` returns `collection_dispatch_miss` for a non-callable element; mocha's `addTest -> suite` edge is gone.
- [x] #4 The container mistyping removal lands in the same commit as the element hop, with no regression in resolutions that previously depended on it.
- [x] #5 Integration tests cover all of this step's evidence cases: mocha `@param {Suite[]}` + `suites[0].afterEach()`, `var suites = [suite]` + `suites[0].beforeAll()`, `var s = suites[0]; s.addTest(t)` with no element-identifier edge, Python `list[Suite]`/`dict[str, Suite]`, Rust `Vec<Layer>`, the TypeScript `Map` loop and `.get()` shapes, a non-literal key, and the `[new Suite("root")]` container case.
- [x] #6 `collection_dispatch.test.ts`'s keyed-alias and keyless-union paths stay green.

<!-- AC:END -->

## Implementation notes

- **Element fact.** `TypeRegistry.get_container_element` records one `{ shape, element }` per container binding: from its sequence literal's constructions (STEP 1.1), or from an annotation whose head is in the closed set `type_preprocessing/container_shape.ts` states and measures over vscode `src/` at `f3fa55c3` (13,429 of 226,418 annotated value bindings: `Array` 12,601, `Map` 547, `Set` 263, `DisposableMap` 18). The element argument resolves on its own, not through `symbol_type_arguments`, which are all or nothing and drop every `Map<string, V>`. `element_type_annotation` was never added: every evidence row carries the annotation on the holder's own `type`.
- **Reads.** `call_resolution/container_element.ts` says what a read yields: an index or `get(k)` read yields the element of either shape; iterating a sequence yields elements; iterating a keyed container yields entries (JS `Map`, Rust `HashMap`) or keys (Python `dict`), so only `values()` or an entry's value half is the element. `VariableDefinition.iterated_from` carries loop and array-pattern bindings, including the counted half of Python `enumerate(xs)` and Rust `.enumerate()`. `SelfReferenceCall.index_access` carries `this.cursors[0]` like `ReceiverExpression.index_access`.
- **Container mistyping removed in the same change.** `extract_constructor_bindings` returns `{ values, elements }`: `[new Suite()]` types the element, never the container. A literal types an element only when every element is a construction (a Python call, or a namespace call whose chain `names_a_type`); `FunctionCollection.elements_are_references` marks an all-names literal whose names' types supply the element. A literal mixing the two, or holding a spread, member read or call, types no element. Python argument lists no longer leak an inner construction onto the outer binding.
- **Collection dispatch.** `get_collection_functions` drops a stored identifier whose definition is not callable (function, method, class, or an unresolvable import), so mocha's `addTest -> suite` edge is gone and the element flows on as a receiver.
- **Module layout.** Namespace member lookup moved out of `receiver_resolution.ts` into `call_resolution/namespace_member.ts` to bring the file back under the 28 KB warning without an import cycle; the TASK-360 type-token return moved to `type_token_return.ts`.
- **Corpus diff against `f910129e`.** mocha +10 edges and 4 wrong `isPending`/`addTest -> suite` parameter edges retargeted to `Suite`; celery +11, and `Cluster([Node(...)]).start()` retargeted from `Node.start` to `Cluster.start`; tokio +2; vscode `src/vs/editor` +109 (27 of them getter reads now emitted); express unchanged. Lost: 7 edges, every one a non-literal-key index read (`this.cursors[i + 1].setState()`, `NAMESPACES[ns][key].to_python()`), which AC #2 leaves unresolved. They had resolved only through the container mistyping this task removes.
- **TASK-394's `DisposableMap` sites stay unresolved.** The real field is `_instances = this._register(new DisposableMap<string, IEditorContribution>())`: unannotated, with the construction's type arguments as the only element source and `_register<T>(o: T): T` wrapping it. Reaching the element needs a type-parameter environment bound from call arguments and declared instantiations, which is TASK-376.15. The fixture `container_elements/contributions.ts` annotates the field and says why it differs from the real site.
- **Out of scope, recorded.**
  - `zip(xs, ys)` (Python) and JS `arr.entries()` over an Array leave their bindings unresolved; they never produce a wrong edge.
  - A string-key index read can bind to a same-named member: the whole chain is tried before the chain minus its last segment.
  - `this.get(k)!.m()` on a class that is itself a map is not an element read.
  - Rust `for &x in &v`, `drain(..)` and nested tuple patterns; JS rest, default and nested array patterns.
