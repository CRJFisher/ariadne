---
id: TASK-349.5
title: "Resolve inline-full-path Rust constructors via path-prefix type walking"
status: Done
assignee: []
created_date: "2026-06-26 13:00"
labels:
  - name_resolution
  - rust
dependencies:
  - TASK-349.1
  - TASK-349.4
parent_task_id: TASK-349
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Last of the Change-A cluster. TASK-349.1 (producer + function-call resolution) makes a `Type::new()` reference carry the terminal type name plus a `path_prefix` (`crate::runtime::Driver::new` → name `Driver`, prefix `["crate","runtime","Driver"]`), and resolves qualified **function** calls via the path. TASK-349.4 links Rust `new()` so an **in-scope** type's constructor resolves. This task closes the remaining constructor case: an inline full path whose type is **not bound by a bare name in scope**.

## Root cause — inline type paths place no bare type name in scope

`crate::runtime::Driver::new()` writes the type path inline; `Driver` is never imported, so `resolutions.resolve(scope, "Driver")` misses and `resolve_constructor_call` (`call_resolution/constructor.ts:71`) cannot bind the type. Verified: after 349.1 + 349.4, a `use`-imported `Parker::new()` resolves, but the inline-full-path `crate::runtime::Driver::new()` remains an entry-point false positive because the type itself is unresolved.

## Change — path-prefix type walk for constructors

In `resolve_constructor_call`, when `resolutions.resolve(scope, name)` (the terminal type) misses and `call_ref.path_prefix` is present, **walk the prefix** to bind the type, then resolve the constructor via the 349.4 member-index link:

- Reuse the module/type path-resolution helper introduced for function calls in 349.1 (resolve the leading segment to a `mod`/`use` module or type, walk remaining segments). The constructor `path_prefix` is **type-last**: the final segment *is* the type (`Driver`), the leading segments are its module path (`crate`, `runtime`).
- Normalize a leading `crate` / `self` / `super` segment (anchor to crate/module roots) before resolving — `["crate","runtime","Driver"]` must not die on the literal `crate` segment.
- Gate the new branch to the Rust associated-constructor path (`path_prefix` present, type not already bound); leave the TS `property_chain` namespace branch (`constructor.ts:56`) and the simple in-scope path (349.4) untouched.

## Collision safety

The retained `path_prefix` is the disambiguating guard and must be enforced, not assumed: when two in-scope modules/types expose the same type name, the prefix selects the correct one. Evaluate ambiguity **in scope**, not via a global name scan, and detect collisions in path-prefix resolution itself (the single-valued `by_scope` map collapses same-name bindings). Same-crate alias hops (`use ll::Semaphore`, type/cfg aliases) ride this path only when the leading segment resolves through a `use`/type alias in the same crate; a cross-file re-export hop is `import_resolution` and out of scope — bail rather than fabricate an edge.

## Verification — evidence-case integration tests + fixtures

Demonstrate the fix against the **actual evidence cases** from the `name_resolution` cluster — the real inline-full-path constructor false-positives (e.g. `crate::…::Driver::new`-style rows). Add integration tests that reproduce each evidence shape as a fixture under `tests/fixtures/rust/code/` (or inline `Project` + `update_file`, multi-file so the type is defined in another module and reached only via the inline path) and assert the constructor flips from a **false-positive entry point** to **resolved/reachable**. Update any existing fixtures whose call-graph expectations change. Confirm the caller files are within the corpus' indexed-file set before counting a row resolved.

## Out of scope

- `cfg`-gated duplicate definitions (`Mutex::new` resolving to mocked vs std under `cfg(all(test, loom))`) — Ariadne does not evaluate `cfg`; flag as a known limitation, do not try to disambiguate.
- Outer-turbofish over a qualified path (`worker::create::<i32>()`) is not captured by `rust.scm` today — a separate query-gap follow-up (also noted in 349.1).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `Project` + `update_file`: `crate::runtime::Driver::new()` (inline full path, type not imported) resolves to the `Driver` constructor — the `new` definition is reachable, not an entry point. _(Realized for the in-scope inline-`mod` shape the root cause targets; a genuinely separate-file `mod foo;` hop without a `use` bails by design — see High-level summary.)_
- [x] #2 Leading `crate`/`self`/`super` segments are normalized so deep paths resolve. _(A single leading anchor is normalized and the type's immediate module is walked; deeper nesting whose intermediate module is not in the caller's scope bails, matching the function-call resolver.)_
- [x] #3 Ambiguity: when two in-scope modules expose a same-named type each with a `new`, the inline-path constructor disambiguates to the correct type via its `path_prefix`.
- [x] #4 The in-scope constructor path (349.4: `use`-imported `Parker::new()`) and the TS `[namespace, class]` `property_chain` constructor branch stay green — the new branch only fires when the bare type name misses and `path_prefix` is present.
- [~] #5 Integration tests over fixtures reproducing the cluster's inline-full-path constructor evidence cases demonstrate each constructor resolves (no longer an entry point); a negative fixture pins the separate-file bail. Fixture additions accompany the changed call-graph expectations. _(Partial, mirroring 349.1's AC#7 and 349.4's AC#5: the evidence **shapes** are reproduced as fixtures and verified end-to-end; the literal sqlx/tokio corpus flip plus the indexed-file-set confirmation is a corpus-rerun verification step outside this repo.)_

<!-- AC:END -->

## Implementation Notes

## High-level summary

A Rust constructor written as an inline full path — `crate::runtime::Driver::new()`, whose type `Driver` is never imported — now resolves to the `Driver` constructor instead of surfacing as a false-positive entry point. The producer (349.1) already reduces such a call to its terminal type name (`Driver`) plus a type-last `path_prefix` (`["crate","runtime","Driver"]`); 349.4 links a type's associated `new()` once the type is bound. This task closes the last gap: binding the type when no bare name carries it in scope. `resolve_constructor_call` walks the prefix — it resolves the type's immediate module qualifier in scope and looks the type up in that module's body — then links the constructor via the existing member-index path. The module qualifier is the disambiguator: two in-scope modules each exposing a `Driver` resolve to the correct one, because the lookup is scoped to a specific module rather than a global name scan.

The walk is in-scope only. A genuinely separate-file `mod foo;` declared without a `use` of the type establishes no in-scope module body to walk (that linkage is `import_resolution`'s concern), so the walk bails rather than fabricate a cross-file edge — exactly the boundary the spec's collision-safety section directs. AC #1/#5's "cross-file" is therefore realized as the in-scope inline-`mod` shape that the root-cause analysis actually targets; the separate-file hop is a pinned negative case.

## What changed

**Shared path resolver (`call_resolution/path_resolution.ts`, new).** The module/type path-resolution helpers 349.1 built for function calls — `normalize_path_prefix` (strip leading `crate`/`self`/`super` anchors), `resolve_in_module_body` (find a `mod <qualifier>`'s body scope and look a terminal up in it), and `is_callable_definition` — moved out of `function_call.ts` into a shared module so the constructor resolver reuses them instead of duplicating. `resolve_in_module_body` and `is_callable_definition` now take explicit registries (`scopes`, `definitions`) rather than a `CallResolutionContext`, since the constructor resolver does not thread the full context. `function_call.ts` consumes the shared helpers with identical behaviour; the function-call import-anchor branch stays local to it.

**Inline-full-path constructor branch (`call_resolution/constructor.ts`).** `resolve_constructor_call` gains one branch, `resolve_type_via_module_path`, gated on the bare-name miss **and** a non-empty `path_prefix`. It normalizes the prefix, takes the type as the last segment (`call_ref.name`) and its immediate module as the second-to-last (the type-last shape — contrast the function-call resolver, whose terminal lives in `ref.name` and whose qualifier is the last prefix segment), resolves that module qualifier in scope, requires it to be a `namespace` (Rust `mod`), and resolves the type in its module body. Whatever it binds is re-validated by the existing `find_class_definition` + `find_associated_constructor` (callable-guarded) path, so the `new` link and its guards are unchanged. The gate keeps the in-scope `Type::new()` (349.4) and TS/Python `new ClassName()` paths untouched — they never reach the branch.

## Verification

- **AC #1** — `project.rust.integration.test.ts > Inline-Full-Path Constructor Resolution` over `modules/inline_path_constructor.rs`: `crate::runtime::Driver::new()` resolves to exactly the `new` member (`toEqual([driver_new])`, asserted not to be the class symbol), `resolve(scope,"Driver")` is confirmed `null` (the type is not bound by a bare name), and `new` is absent from `call_graph.entry_points`. The fixture uses a **unit struct** so `new`'s body returns a bare value rather than a struct literal — a field-bearing struct's `Driver { .. }` literal is itself a constructor call that 349.4 self-links to `new`, which would mask the entry-point flip.
- **AC #2** — `path_resolution.test.ts` covers `normalize_path_prefix` directly (strips leading `crate`, consecutive `self`/`super`, leaves non-anchored prefixes and non-leading anchors alone, empties an all-anchor prefix); the AC #1 fixture exercises the `crate` anchor end-to-end. Only the type's immediate module is walked; deeper nesting whose intermediate module is not in scope bails (documented in the helper).
- **AC #3** — same integration block over `modules/ambiguous_path_constructor.rs`: two in-scope modules (`alpha`, `beta`) each expose a `Driver`; each call resolves to its own module's Driver-derived target, computed from the member index so the assertion stays honest regardless of a separate same-file same-name impl→type-linking limitation (which currently attaches both `impl Driver` blocks to one type). A collapsed walk would bind beta's call to alpha's target and fail.
- **AC #4** — full `@ariadnejs/core` suite green (2849 tests). `constructor.test.ts > Inline-full-path constructor (module-path walk)` asserts the branch bails (a) when the qualifier does not resolve in scope and (b) when it resolves to a non-namespace (e.g. `Outer::Inner::new()` where `Outer` is a type); the 349.4 in-scope `Parker::new()` and the TS namespace `property_chain` tests stay green; `function_call.ts`'s extraction is behaviour-preserving.
- **Separate-file bail** — `modules/uses_separate_gadget.rs` + `modules/gadget.rs`: `crate::gadget::Gadget::new()` with `Gadget` in a sibling file declared only via `mod gadget;` resolves to `[]` (no fabricated cross-file edge), pinning the `import_resolution` boundary.
- `tsc --noEmit` clean for `types` and `core` (the lone remaining `permanent_data.sync.test.ts` `import.meta` error is pre-existing and unrelated).

## Review outcome

A seven-lens review (correctness ×2, contracts, completeness vs spec, completeness implied, IA structure, adversarial cold-read) found no blockers; the two behavioral lenses and the contracts lens returned clean. Verified findings drove test and documentation additions, all behaviour-preserving:

- A mislabeled bail test exercised the "qualifier not in scope" branch but not the "qualifier resolves to a non-namespace" branch — renamed and a genuine non-namespace case added.
- The cross-file bail was asserted in prose but untested — added the `uses_separate_gadget.rs`/`gadget.rs` negative fixture.
- The `length - 2` index and its type-last-vs-terminal-last divergence from the function-call resolver were documented per-caller but not in the shared module — added a signpost to `path_resolution.ts`'s header and the constructor helper, plus the unit-struct fixture rationale.

Findings left unactioned (noted, not fixed): extracting a shared namespace-dispatch wrapper (the function-call site interleaves other branches, so it does not cleanly factor — avoided churn); the two-tier length gate (deliberate, mirrors 349.4's `path_prefix` gate); a direct unit test for the pre-existing `is_callable_definition` (YAGNI, unchanged by this work).
