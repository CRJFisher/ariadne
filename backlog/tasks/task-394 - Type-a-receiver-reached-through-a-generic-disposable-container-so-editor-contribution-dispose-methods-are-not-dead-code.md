---
id: TASK-394
title: "Type a receiver reached through a generic disposable container so editor-contribution dispose methods are not dead code"
status: To Do
assignee: []
labels:
  - call-graph
  - bug
  - polymorphic_dispatch
dependencies:
  - TASK-389
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

Eleven `dispose` methods on editor contributions in microsoft/vscode are
reported as uncalled entry points, and each is disposed only through a generic
container the indexer cannot see into. TASK-389 fixed the sibling population —
calls through an interface-typed binding — and confirmed on the corpus that
these eleven are a **different** defect that its mechanism does not reach:

```
src/vs/editor/browser/services/markerDecorations.ts:21
src/vs/editor/contrib/anchorSelect/browser/anchorSelect.ts:96
src/vs/editor/contrib/contextmenu/browser/contextmenu.ts:384
src/vs/editor/contrib/format/browser/formatActions.ts:173
src/vs/editor/contrib/gotoError/browser/gotoError.ts:55
src/vs/editor/contrib/inPlaceReplace/browser/inPlaceReplace.ts:52
src/vs/editor/contrib/indentation/browser/indentation.ts:564
src/vs/editor/contrib/message/browser/messageController.ts:52
src/vs/editor/contrib/smartSelect/browser/smartSelect.ts:71
src/vs/editor/standalone/browser/quickInput/standaloneQuickInputService.ts:188
src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts:55
```

## Why TASK-389 does not close them

The task-389 write-up hypothesised that a `.dispose()` call lands on the
`IDisposable` interface member and stops there. Measured over vscode's `src/`
at `f3fa55c3`, that is refuted: `IDisposable.dispose` receives only 4 incoming
resolved edges corpus-wide, all in test files. The eleven contributions are
disposed through `codeEditorContributions.ts`, which holds them in
`this._register(new DisposableMap<string, IEditorContribution>())` and disposes
each by iterating that map — a generic-container element read, not a call on an
interface-typed binding.

Two facts stop task-389's repair from reaching them:

1. **The receiver never gets a type.** The dispose site iterates a
   `DisposableMap<string, IEditorContribution>`; typing the element requires
   flowing the container's type argument to the loop variable. The corpus-wide
   dispose-call failure taxonomy is `type_inference/receiver_type_unknown` at
   3,245 and `type_inference/member_type_unknown` at 1,175 — the call fails
   before it ever reaches the interface branch, where implementation fan-out
   would already have supplied an edge.
2. **The classes are `IDisposable` implementers only structurally.** A
   contribution `implements IEditorContribution`, and `IEditorContribution`
   declares `dispose(): void` without extending `IDisposable`. Nothing in the
   source names `IDisposable` as a supertype of the class, so the subtype
   registry does not connect them, and a receiver typed `IDisposable` would not
   fan out to them even if the container element were typed.

## What closing them requires

- **Generic type-argument flow into container elements** — carry the element
  type of `Map` / `DisposableMap` / `Array` into the receiver typed by a
  `for…of` over the container or a `.get()` on it. This is the mechanism the
  3,245 `receiver_type_unknown` dispose sites need, and it is a capability
  beyond a property hop.
- **Structural interface satisfaction** — a class whose members cover an
  interface's signatures satisfies it without an `implements` clause. This
  carries real fan-out risk: `IDisposable` alone has 460 direct declared
  subtypes over this corpus, and a structural rule would widen every
  `.dispose()` dispatch, so whatever bound is chosen must be stated in the
  module and measured over this corpus.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A method called on the element of a typed generic container (`for (const x of map)` / `map.get(k)` where the container is `Map<K, V>` / `DisposableMap<K, V>` / `V[]`) resolves against `V`, so the element's members are reachable. The bound on which container shapes carry their element type is stated in the module and measured over the corpus.
- [ ] #2 All 11 sites listed above have at least one incoming resolved call edge over vscode's `src/` at `f3fa55c3` and are absent from the raw entry-point set.
- [ ] #3 Whatever structural-satisfaction rule is adopted (if any) states its fan-out bound in the module and is measured over this corpus: `IDisposable` has 460 direct declared subtypes here, so an unbounded structural rule is refused rather than shipped.
- [ ] #4 The node set is unchanged and the resolved-edge count only rises, as in TASK-389: this repair adds attributions, it never removes one.

<!-- AC:END -->
