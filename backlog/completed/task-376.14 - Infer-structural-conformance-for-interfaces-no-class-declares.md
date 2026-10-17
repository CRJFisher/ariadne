---
id: TASK-376.14
title: "Infer structural conformance for interfaces no class declares"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
updated_date: "2026-09-18 08:40"
labels:
  - plan-export
  - polymorphic_dispatch
dependencies:
  - TASK-376.4
  - TASK-376.7
  - TASK-376.13
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

§7 step 15. Wave 6, beside TASK-376.8 and TASK-376.15; shares `project/project.ts` Phase 3.5 with TASK-376.8. Requires TASK-376.4 (`members_by_name`, `get_member_closure`), TASK-376.7 (edge sources) and TASK-376.13 (the subtype-dispatch index). Carries the structural half of TASK-394.

## Root cause

The premise that these rows need a _declared_ cross-package `implements` edge is refuted: for angular's `CompilerFacade` the receiver resolves to core's **replica** declaration, which nothing implements — the compiler's implementation declares against the compiler's own copy. The same shape holds for `TcbEnvironment`, and for vscode's `IEditorContribution`, which declares `dispose(): void` without extending `IDisposable`. No declared edge exists to find, so the only mechanism that closes these rows is undeclared structural conformance, and it carries 20 of the group's 25 rows rather than being a 2-row edge case.

## Work plan

1. Add `resolve_references/call_resolution/structural_conformance.ts` with `infer_structural_subtypes(interface_id, definitions, types): SymbolId[]`: take candidates as the **intersection** over `members_by_name` for the interface's member names (for `TcbEnvironment`'s 6 members and core's `CompilerFacade`'s 14 the intersection is a singleton), match each candidate against its `get_member_closure`, and require 100% member coverage plus a minimum member floor. Language-agnostic — no language leaf.
2. Hook it lazily into `method_lookup.ts`'s interface branch (`:167-183`): when the declared fan-out is empty, call `infer_structural_subtypes`, register any inferred edges through `register_subtype` tagged `"structural"`, and re-run the fan-out. Only genuine emptiness leaves `polymorphic_no_implementations` standing.
3. Extend `project/project.ts` Phase 3.5 (`resolve_files`, `:417-427`) to test each newly-added type against the **pending** interfaces only, bounding structural work by `|pending| × |new types per file|`.
4. Calibrate the floor: a one-member interface would match every class with that member name. Measure the false-edge rate on angular, TypeScript and vscode `src/` at `f3fa55c3` before fixing the constant, and consider requiring ≥2 _methods_. vscode is the adversarial corpus: `IDisposable` has 460 declared subtypes and thousands of classes carry a `dispose` member, so the bound must be stated in the module and its fan-out measured there (TASK-394 AC #3). Confirm member-name matching does not create absurd matches on generic container classes (`ExpressionTranslatorVisitor<TFile, TStatement, …>`) and that an inferred edge into a widely-subclassed base does not explode the fan-out (`get_transitive_subtypes` guards cycles with `processed` at `method_lookup.ts:292`).
5. Adjust `method_lookup.test.ts`'s "fails with `polymorphic_no_implementations` for an interface no class implements" case **at the fixture** — give it a member set no class covers — not at the assertion.
6. Add integration tests (fixture: a reduced `CompilerFacade` cluster under `tests/fixtures/typescript/code/integration/` with two replica declarations, the accessor, one caller and the impl) covering every evidence case for this step: full member coverage resolves; one member missing does not; coverage available only via a superclass resolves (the `Environment` shape); the duplicated-interface `CompilerFacade` shape resolves with the two interface ids still distinct; the `TcbEnvironment` 6-member shape resolves to its single candidate; a one-member interface does **not** fan out to every class carrying that member name; and the vscode `IEditorContribution` shape — a class satisfying `IDisposable` only structurally — resolves its `dispose()` through the element receiver TASK-376.10 types, with the fan-out bound asserted.

## Carried from TASK-376.13

The index TASK-376.13 landed is `ResolutionState.subtype_dispatch_files`: type → the files whose lookup enumerated that type's subtype closure, whether the lookup resolved or failed. It does not separate failures, so step 3's **pending** interfaces are the interfaces whose dispatches ended `polymorphic_no_implementations` (the failure's `partial_info.resolved_receiver_type`), not the index's keys.

An inferred structural edge changes the interface's subtype closure exactly as a declared edge does. Phase 3.5 re-answers callers from the `changed_types` set (`resolve_type_heritage`'s changed parents and `take_changed_member_types`) through `Project.files_dispatching_through`; every interface that gains or loses an inferred edge — in Phase 3.5 or lazily in step 2 — joins that set, or a caller resolved before the conforming class arrived stays unresolved and resolution depends on file arrival order again. Step 6 includes the interface / conforming class / caller order matrix through `update_file`, as `project.integration.test.ts` › "Dispatch through a subtype closure, whatever order files arrive in" does for declared edges.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `infer_structural_subtypes` exists, is evaluated only on the `polymorphic_no_implementations` path, and registers inferred edges tagged `"structural"` through `register_subtype`.
  Evidence: `call_resolution/structural_conformance.ts` exports `infer_structural_subtypes` (whole-answer discovery) and `conforming_candidates` (the per-candidate half). `method_lookup.ts`'s `resolve_interface_implementations` is the only lazy caller and reaches it only when `DefinitionRegistry.has_declared_subtype(interface_id)` is false — a stronger gate than an empty fan-out, so a member no declared implementer declares stays a failure instead of becoming a structural search. Edges are written through `DefinitionRegistry.infer_subtype`, which calls `SubtypeGraph.register_subtype(..., "structural", subtype_file)`. `method_lookup.test.ts` › "never asks about conformance for an interface a class already declares" pins the gate.

- [x] #2 Angular's `CompilerFacade` (two replica declarations) and `TcbEnvironment` receivers resolve to their implementations, with the two interface ids remaining distinct.
  Evidence: MEASURED over angular/angular at `5ad8231` (`packages/`): `CompilerFacade` (17 methods) gains its one edge to `CompilerFacadeImpl`, and `TcbEnvironment` (5 methods) gains two, to `Environment` and `TypeCheckFile`. The ids stay distinct because `SubtypeGraph` keys both ends on `SymbolId`; `project.integration.test.ts` › "keeps the two replica declarations distinct, each reaching the one implementation" asserts it, and also that only the replica a call dispatches through is asked about — conformance is inferred where a dispatch needs it, never swept over every interface the project holds.

- [x] #3 Coverage via a superclass counts (through `get_member_closure`); a single missing member does not match; the member floor is calibrated against a measured false-edge rate on angular, TypeScript and vscode, and the fan-out bound is stated in the module.
  Evidence: the candidate seed is the rarest required member name's carriers plus their subtype closure, and each candidate is confirmed against its whole `get_member_closure` — which is what makes the `Environment` shape (three members on the class, three on its base) match. The floor and the width bound are stated and measured in `structural_conformance.ts`'s module doc over angular at `5ad8231`, microsoft/TypeScript at `cc5c6e2d3` (`folder:src`, 601 files) and microsoft/vscode at `f3fa55c3` (`src`, 8,494 files): 61 interfaces, 226 edges, **23 false — 10.2%**, widest answer 24. The floor is three methods rather than two because two was measured and refuted: at two methods with no width bound angular infers 51 edges of which **31** are false (`RDomTokenList` `{add, remove}` alone taking 14, `IInjectorService` `{get, has}` 11). The fan-out bound is `MAXIMUM_CONFORMING_CLASSES = 32`, forced by vscode, where `{layout, focus, dispose}` on `IAICustomizationManagementSectionWidget` matched **286** classes — 55% of all edges an unbounded run produced.

- [x] #4 Phase 3.5 tests new types only against pending interfaces, keeping structural work bounded.
  Evidence: `structural_conformance.ts`'s `infer_conformance_to_pending_interfaces`, called once from Phase 3.5, closes the pass's `changed_types` over each one's subtype closure — conformance is a property of a whole member closure, so a base arriving is what completes its subclass's coverage while only the base is a changed type — filters that to classes, then for each interface in `ResolutionRegistry.get_undeclared_interfaces()` runs the cheap `conforming_candidates` trigger over just those classes; only a trigger that answers yes runs the full discovery, so the width bound is applied to the whole conforming set in one place rather than to a pass's slice of it. The pending set is a new index, `ResolutionState.undeclared_interface_files`, because TASK-376.13's `subtype_dispatch_files` cannot separate failures. It keys on file, so it evicts through the same `without_files` machinery, and it holds an interface that no class *declares* rather than one with no implementation at all — so an interface already answered structurally stays in the set and the second class to conform connects as the first did.

- [x] #5 Integration tests with the reduced `CompilerFacade` fixture cover all of this step's evidence cases: full coverage, missing member, superclass coverage, duplicated interface, `TcbEnvironment`, the one-member non-match, and the vscode `IEditorContribution` shape.
  Evidence: `project.integration.test.ts` › "Dispatch through an interface no class declares against" over `tests/fixtures/typescript/code/integration/structural_conformance/`: full coverage resolves under the interface / conforming class / caller order matrix (both drivers); `near_impl.ts`, one member short, stays out of the fan-out; the `Environment` shape resolves through its superclass under its own order matrix and with the base arriving at each later position, which is the arrival the closure change turns on; the two replicas stay distinct; a one-member `IDisposable` and a two-member `RDomTokenList` are both refused in a project where the facade's own inferred edge is asserted beside them, so the refusal is the floor's and not the step's absence; and the `IEditorContribution` shape — vscode's declaration verbatim, optional markers included — resolves its `dispose()` through a `Map<string, IEditorContribution>` element receiver with the fan-out asserted to be the one class covering all three members, never the three others carrying `dispose`. The module's language-agnostic claim has two cases of its own: a Python `Protocol` no class names as a base, and a Rust trait covered from an inherent `impl` block. The `TcbEnvironment` six-member single-candidate shape is the `Environment` fixture; the angular replica shape reached through an accessor's return type has its own case.

- [x] #6 `method_lookup.test.ts`'s no-implementer case is adjusted at the fixture, not the assertion, and the suite stays green.
  Evidence: the case is now "fails with polymorphic_no_implementations for an interface no class implements or conforms to" — the interface declares three methods so it clears the floor and conformance is genuinely consulted, and the file holds a class covering two of the three. The assertion is unchanged.

<!-- AC:END --><!-- AC:END -->

## What landed

`DefinitionRegistry` gained three readers and one writer for this step, and a
duplicate walk went with them: `method_lookup.ts`'s private
`get_transitive_subtypes` is deleted and both of its callers read
`SubtypeGraph.get_subtype_closure` instead, beside the existing
`get_supertype_closure`.

`MethodLookup` carries a third fact, `undeclared_interface`, so the dispatch
recorder reads what the lookup found rather than inferring it from a failure
reason — and reads it whether or not conformance then answered the call, which
is what keeps the interface in the pending set for the next class to arrive.

## Gaps found and not closed here

Conformance reads member names and not optionality, so an interface marking
members optional is answered only by a class declaring all of them — vscode's
`IEditorContribution` among them, whose other two members are optional. Nothing
in the pipeline indexes optionality today, and reading it would drop that
interface's required set to one method and put it below the member floor, so
closing the bound means re-deriving the floor against the required set over the
same three corpora. TASK-376.23 carries it; the bound is stated in
`structural_conformance.ts` and visible where the fixture's `dispose`-only
carriers stay out of the fan-out.

Two order-independence gaps sit outside this step's mechanism and are visible in
the fixture:

- A bare call as a receiver (`getCompilerFacade().compileNgModule(m)`) is
  indexed with a `property_chain` of `["compileNgModule"]` — no receiver — so
  the call fails at name resolution. Binding the call first
  (`const f = getCompilerFacade(); f.compileNgModule(m)`) resolves.
- A receiver typed by an accessor's **return annotation** is not re-answered
  when the annotated type arrives after the caller: the caller imports the
  accessor, not the interface, so `files_affected_by` does not reach it and it
  never dispatched through the interface, so the subtype-dispatch index does not
  either. The accessor case is therefore tested at a fixed arrival order, and
  the order matrix runs over a caller that names the interface itself.

## Notes from wave 1

`DefinitionRegistry.get_members_by_name(name)` returns every type whose member index holds `name`, and `get_member_closure(type_id)` returns a type's own members plus those inherited through same-kind parents only, nearest declaration winning. Both exist without a pipeline caller until this step lands.
