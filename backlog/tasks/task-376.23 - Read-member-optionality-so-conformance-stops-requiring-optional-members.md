---
id: TASK-376.23
title: >-
  Read member optionality so structural conformance stops requiring optional
  members
status: To Do
assignee: []
created_date: '2026-09-18 18:20'
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
- [ ] #1 Member optionality is indexed: a TypeScript optional member signature (`m?(): void`) and a Rust trait method with a default body are recorded as optional on the member's definition, and `LocalMemberInfo.is_optional` either gets its producer or is deleted.
- [ ] #2 `structural_conformance.ts` requires only the mandatory members, and the member floor counts the same set it requires.
- [ ] #3 The floor and the width bound are re-measured over angular, TypeScript and vscode with optionality read, the false-edge rate is re-stated in the module doc, and the recovery is compared against TASK-376.14's measured baseline (`polymorphic_no_implementations` 7,790 → 7,738 on TypeScript `src`).
- [ ] #4 `project.integration.test.ts` › "disposes a contribution reached through a keyed container" gains the case the bound currently refuses: a contribution declaring only the mandatory `dispose` conforms, and the `dispose`-only carriers in `disposable_carriers.ts` still do not (the interface is below the re-derived floor, or the width bound refuses the answer — whichever the measurement says).
<!-- AC:END -->
