---
id: TASK-376.23
title: >-
  Read member optionality so structural conformance stops requiring optional
  members
status: Done
assignee: []
created_date: '2026-09-18 18:20'
updated_date: '2026-09-28 02:55'
labels:
  - polymorphic_dispatch
dependencies:
  - TASK-376.14
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

`structural_conformance.ts` requires every member name in an interface's closure, because nothing tells it which of them a conforming type may leave out: no definition carries member optionality. `MethodDefinition` has no optional field, and `LocalMemberInfo.is_optional` is declared in `@ariadnejs/types` with no producer and no consumer anywhere in the pipeline.

So a class satisfying an interface in the source language is missed whenever the interface marks members optional. vscode's `IEditorContribution` is the shape: `dispose(): void; saveViewState?(): string; restoreViewState?(state): void;` — a contribution declaring `dispose` alone conforms as TypeScript reads it, and conformance answers only a class declaring all three. Rust's trait methods with default bodies are the same shape. Each missed edge leaves its target looking unreachable, which is the false-positive entry point TASK-376.14 exists to remove.

The fix is not local to this module. Reading optionality drops `IEditorContribution`'s required set to **one** method, which puts the interface below `MINIMUM_CONFORMING_METHODS` and removes its edges altogether — so the floor has to be re-derived against the required set rather than the declared one, over the same three corpora TASK-376.14 measured (angular at `5ad8231`, microsoft/TypeScript at `cc5c6e2d3`, microsoft/vscode at `f3fa55c3`), and `structural_conformance.ts`'s measured module doc re-stated with the new numbers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Member optionality is indexed: a TypeScript optional member signature (`m?(): void`) and a Rust trait method with a default body are recorded as optional on the member's definition, and `LocalMemberInfo.is_optional` either gets its producer or is deleted.
  Evidence: `MethodDefinition.optional` and `PropertyDefinition.optional` (`@ariadnejs/types`). TypeScript sets it from the `?` token of a `method_signature` or `property_signature` (`is_optional_member_signature`, `symbol_factories.typescript.ts`); Rust's `handle_definition_method_default` sets it on every trait method with a body, and a bodiless `function_signature_item` leaves it unset. `member_info.ts` — `LocalMemberInfo` and `LocalParameterInfo`, neither with a producer or consumer — is deleted. Pinned by `capture_handlers.typescript.test.ts` › "records which interface members a conforming type may leave out", `methods.rust.test.ts` (default body → `optional: true`) and `capture_handlers.rust.test.ts` (signature → unset).
- [x] #2 `structural_conformance.ts` requires only the mandatory members, and the member floor counts the same set it requires.
  Evidence: a conforming class must carry every mandatory member of the interface's closure. The floor counts **the interface's methods the class carries**, optional ones included — not the mandatory set alone, which the measurement refuted (below): counting only mandatory methods drops 25 real edges across the corpora and recovers none the carried count does not. An interface whose members are all optional identifies nothing. `structural_conformance.test.ts` › "optional members" pins all four shapes.
- [x] #3 The floor and the width bound are re-measured over angular, TypeScript and vscode with optionality read, the false-edge rate is re-stated in the module doc, and the recovery is compared against TASK-376.14's measured baseline (`polymorphic_no_implementations` 7,790 → 7,738 on TypeScript `src`).
  Evidence: MEASURED at angular `5ad8231` (`packages/`, 4,745 files), TypeScript `cc5c6e2d3` (`src`, 601 files), vscode `f3fa55c3` (`src`, 8,494 files). Six policies were compared over the same pending interfaces in one load per corpus. Edges (interfaces) — required every name, 3-method floor: TS 38 (11), angular 10 (7), vscode 179 (44), reproducing TASK-376.14. Mandatory names, floor over carried methods (landed): TS 79 (13), angular 11 (8), vscode 182 (46) — a strict superset, 45 edges gained, 0 lost, every gained edge an implementation (TypeScript `*Host` interfaces onto its project and harness hosts, `ILocalPtyService` → `PtyHostService`, `IResolvedTextFileEditorModel` → `TextFileEditorModel`, `TestingZoneType` → `ZoneImpl`). Mandatory methods only: loses 25 edges (vscode `EncodedTokensProvider`, `ITunnelDiscoveryProvider`; TS `GetPackageJsonEntrypointsHost`, `WatchFactoryHost`, …). Floor counting properties: vscode 628 edges at ≥3, 2,499 at ≥2. False rate 23 / 272 = 8.5% (was 23 / 226 = 10.2%). Width bound 32 holds: widest admitted answer 24; refusals `IAICustomizationManagementSectionWidget` (286) and `IVisibleEditorPane` (62). Recovery on the current tree, same session: TypeScript `polymorphic_no_implementations` 7,905 → 7,848 (−57), resolved 80,508 → 80,565 of 107,701 — beside TASK-376.14's own 7,790 → 7,738 (−52) on its tree. angular 1,860 → 1,851; vscode 6,442 → 6,432. Rust, where a default body now marks a trait method optional: over tokio (790 files), serde (208) and axum (305) at most two traits per corpus reach conformance at all, and the one edge optionality adds is serde's `Serializer` → `TaggedSerializer`, an implementation; rust-lang/rust is unmeasured.
- [x] #4 `project.integration.test.ts` › "disposes a contribution reached through a keyed container" gains the case the bound currently refuses: a contribution declaring only the mandatory `dispose` conforms, and the `dispose`-only carriers in `disposable_carriers.ts` still do not (the interface is below the re-derived floor, or the width bound refuses the answer — whichever the measurement says).
  Evidence: the two halves of this criterion cannot both hold — a contribution declaring only `dispose` and a `dispose`-only carrier have identical member sets, so any rule admitting one admits the other. The measurement decided for the floor: `code_editor_widget.ts` gains `HoverController` (`dispose` only), and the test asserts it and the three carriers are all refused while `FoldingController` (all three methods) still answers the keyed-container dispatch. vscode's own `IEditorContribution` has 75 declared implementers and never reaches conformance. The case the old bound refused is a new test, "answers through an interface whose optional member the conforming class leaves out" (`build_program_host.ts`, TypeScript's `ReadBuildProgramHost` shape), and the Rust trait fixture gains a default-body `visit_pat` that `Collector` leaves out; both fail with optionality unread.
<!-- AC:END -->
