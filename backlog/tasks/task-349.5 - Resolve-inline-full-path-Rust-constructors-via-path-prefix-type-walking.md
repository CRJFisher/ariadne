---
id: TASK-349.5
title: "Resolve inline-full-path Rust constructors via path-prefix type walking"
status: To Do
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

- [ ] #1 `Project` + `update_file` cross-file: `crate::runtime::Driver::new()` (inline full path, type not imported) resolves to the `Driver` constructor — the `new` definition is reachable, not an entry point.
- [ ] #2 Leading `crate`/`self`/`super` segments are normalized so deep paths resolve.
- [ ] #3 Ambiguity: when two in-scope modules expose a same-named type each with a `new`, the inline-path constructor disambiguates to the correct type via its `path_prefix`.
- [ ] #4 The in-scope constructor path (349.4: `use`-imported `Parker::new()`) and the TS `[namespace, class]` `property_chain` constructor branch stay green — the new branch only fires when the bare type name misses and `path_prefix` is present.
- [ ] #5 Integration tests over multi-file fixtures reproducing the cluster's inline-full-path constructor evidence cases demonstrate each constructor resolves cross-file (no longer an entry point); fixture additions/updates accompany any changed call-graph expectations.

<!-- AC:END -->
