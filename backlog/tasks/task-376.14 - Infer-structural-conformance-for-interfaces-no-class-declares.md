---
id: TASK-376.14
title: "Infer structural conformance for interfaces no class declares"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - polymorphic_dispatch
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 14000
plan_dedup_keys:
  - c4ccc86ab6b165078aaebedc460bfd2ca55916575b4fa0a4edec90e7f090264e
plan_source_tasks:
  - pt-0b34a849ad9e20f7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 15. Requires §7 steps 4, 8 and 14.

## Root cause

The premise that these rows need a _declared_ cross-package `implements` edge is refuted: for angular's `CompilerFacade` the receiver resolves to core's **replica** declaration, which nothing implements — the compiler's implementation declares against the compiler's own copy. The same shape holds for `TcbEnvironment`. No declared edge exists to find, so the only mechanism that closes these rows is undeclared structural conformance, and it carries 20 of the group's 25 rows rather than being a 2-row edge case.

## Work plan

1. Add `resolve_references/call_resolution/structural_conformance.ts` with `infer_structural_subtypes(interface_id, definitions, types): SymbolId[]`: take candidates as the **intersection** over `members_by_name` for the interface's member names (for `TcbEnvironment`'s 6 members and core's `CompilerFacade`'s 14 the intersection is a singleton), match each candidate against its `get_member_closure`, and require 100% member coverage plus a minimum member floor. Language-agnostic — no language leaf.
2. Hook it lazily into `method_lookup.ts`'s interface branch (`:148-158`): when the declared fan-out is empty, call `infer_structural_subtypes`, register any inferred edges tagged `"structural"` in `type_subtypes`, and re-run the fan-out. Only genuine emptiness leaves `polymorphic_no_implementations` standing.
3. Extend `project/project.ts` Phase 3.5 to test each newly-added type against the **pending** interfaces only, bounding structural work by `|pending| × |new types per file|`.
4. Calibrate the floor: a one-member interface would match every class with that member name. Measure the false-edge rate on angular and TypeScript before fixing the constant, and consider requiring ≥2 _methods_. Confirm member-name matching does not create absurd matches on generic container classes (`ExpressionTranslatorVisitor<TFile, TStatement, …>`) and that an inferred edge into a widely-subclassed base does not explode the fan-out (`get_transitive_subtypes` guards cycles with `processed` at `method_lookup.ts:262`).
5. Adjust `method_lookup.test.ts:320-370`'s "fails with `polymorphic_no_implementations` for an interface no class implements" case **at the fixture** — give it a member set no class covers — not at the assertion.
6. Add integration tests (fixture: a reduced `CompilerFacade` cluster under `tests/fixtures/typescript/code/integration/` with two replica declarations, the accessor, one caller and the impl) covering every evidence case for this step: full member coverage resolves; one member missing does not; coverage available only via a superclass resolves (the `Environment` shape); the duplicated-interface `CompilerFacade` shape resolves with the two interface ids still distinct; the `TcbEnvironment` 6-member shape resolves to its single candidate; and a one-member interface does **not** fan out to every class carrying that member name.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `infer_structural_subtypes` exists, is evaluated only on the `polymorphic_no_implementations` path, and registers inferred edges tagged `"structural"`.
- [ ] #2 Angular's `CompilerFacade` (two replica declarations) and `TcbEnvironment` receivers resolve to their implementations, with the two interface ids remaining distinct.
- [ ] #3 Coverage via a superclass counts (through `get_member_closure`); a single missing member does not match; the member floor is calibrated against a measured false-edge rate on angular and TypeScript.
- [ ] #4 Phase 3.5 tests new types only against pending interfaces, keeping structural work bounded.
- [ ] #5 Integration tests with the reduced `CompilerFacade` fixture cover all of this step's evidence cases: full coverage, missing member, superclass coverage, duplicated interface, `TcbEnvironment`, and the one-member non-match.
- [ ] #6 `method_lookup.test.ts:320-370` is adjusted at the fixture, not the assertion, and the suite stays green.

<!-- AC:END -->
