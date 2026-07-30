---
id: TASK-376.10
title: "Resolve container element types and stop mistyping the container"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
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

§7 step 11.

## Root cause

Container data is already captured; only the resolver hop is missing. `extract_receiver` (`call_resolution/receiver_resolution.ts:90-126`) discards `call_site_syntax` entirely, which is the one reason `suites[0].m()` and `suites.m()` are indistinguishable downstream. Nothing consumes the type arguments of `Suite[]`, `list[Suite]`, `dict[str, Suite]` or `Vec<Layer>`. Meanwhile `constructor_bindings.ts:38-44` keys the construct target of `var suites = [new Suite("root")]` to the **declarator**, typing the _container_ as `Suite`, and `get_collection_functions` (`collection_dispatch.ts:216-255`) happily returns a non-function element as a call target, producing mocha's wrong `addTest -> suite` edge.

## Work plan

1. Consume `symbol_type_arguments` (recorded in §7 step 6) for loop targets, destructuring targets and index targets, so the element type of a container binding is available where the element is used as a receiver.
2. Add `index_access?: { key_is_literal: boolean }` to `ReceiverExpression` (`receiver_resolution.ts:48-63`) and populate it in `extract_receiver` (`:90-126`) from `call_site_syntax` — `receiver_kind === "index_access"` with `index_key_is_literal === true` is already emitted by `call_site_syntax.typescript.ts:160-166` and `call_site_syntax.python.ts:143`. A non-literal key stays unresolved and remains the `F9` classifier feature at `derive_syntactic_features.ts:27`.
3. Take the element type from `symbol_type_arguments` on the container's binding, or from the container's element expressions (`FunctionCollection.stored_references`). One element type, never a union.
4. Add the non-callable guard to `get_collection_functions` (`collection_dispatch.ts:216-255`): return `collection_dispatch_miss` instead of a target when a resolved element is not a function/method definition, so the element flows on as a receiver type instead. `collection_dispatch` is narrowed here, not widened — the keyed-alias and keyless-union paths are untouched.
5. Remove the container mistyping in `type_preprocessing/constructor_bindings.ts:38-44` — **in this same commit**, or currently-green resolutions that depend on `var suites = [new Suite()]` typing the container regress. The signal moves to the element channel.
6. Confirm whether `element_type_annotation` is needed at all: for every evidence row the annotation lives on the holder's own `type` field. Drop the field rather than carry it if no counter-example appears.
7. Add integration tests (fixtures under `tests/fixtures/{javascript,typescript,python}/code/integration/`) covering every evidence case for this step: mocha `@param {Suite[]} suites` + `suites[0].afterEach()`; mocha `var suites = [suite]` + `suites[0].beforeAll()`; mocha `var s = suites[0]; s.addTest(t)` asserting **no** edge to the element identifier (the wrong `addTest -> suite` edge is gone); a Python `list[Suite]` and `dict[str, Suite]` element receiver; a Rust `Vec<Layer>` element receiver; a non-literal index key staying unresolved; and the `var suites = [new Suite("root")]` container case asserting the container is no longer typed `Suite` while the element receiver still resolves.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Element receivers resolve from `symbol_type_arguments` for `Suite[]`, `list[Suite]`, `dict[str, Suite]` and `Vec<Layer>`, and from container element expressions where no annotation exists.
- [ ] #2 `ReceiverExpression.index_access` is populated from `call_site_syntax`, and a non-literal key stays unresolved and keeps feeding the `F9` classifier feature.
- [ ] #3 `get_collection_functions` returns `collection_dispatch_miss` for a non-callable element; mocha's `addTest -> suite` edge is gone.
- [ ] #4 The container mistyping removal lands in the same commit as the element hop, with no regression in resolutions that previously depended on it.
- [ ] #5 Integration tests cover all of this step's evidence cases: mocha `@param {Suite[]}` + `suites[0].afterEach()`, `var suites = [suite]` + `suites[0].beforeAll()`, `var s = suites[0]; s.addTest(t)` with no element-identifier edge, Python `list[Suite]`/`dict[str, Suite]`, Rust `Vec<Layer>`, a non-literal key, and the `[new Suite("root")]` container case.
- [ ] #6 `collection_dispatch.test.ts`'s keyed-alias and keyless-union paths stay green.

<!-- AC:END -->
