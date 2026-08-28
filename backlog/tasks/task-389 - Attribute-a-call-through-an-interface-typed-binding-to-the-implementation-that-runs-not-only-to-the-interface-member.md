---
id: TASK-389
title: "Attribute a call through an interface-typed binding to the implementation that runs, not only to the interface member"
status: To Do
assignee: []
created_date: "2026-08-27 22:30"
labels:
  - call-graph
  - bug
  - polymorphic_dispatch
dependencies:
  - TASK-381.8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

Fourteen methods that microsoft/vscode calls are reported as uncalled entry
points, and each one is called through a binding whose declared type is an
interface. The call site resolves; it just lands on the interface member and
stops there, so the implementation that actually runs gains no incoming edge
and surfaces to the user as dead code.

Measured over vscode's `src/` at `f3fa55c3`, against the same corpus with
TASK-381.8 reverse-applied: 14 symbols lose their only incoming resolved call
edge while 21,421 gain one. Eleven are `dispose` methods on editor
contributions —

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

— and three are members of `TaskDefinitionRegistryImpl` reached through
`export const TaskDefinitionRegistry: ITaskDefinitionRegistry = new
TaskDefinitionRegistryImpl()`: `onReady` at
`src/vs/workbench/contrib/tasks/common/taskDefinitionRegistry.ts:151`, `get` at
`:155` and `getJsonSchema` at `:163`. Every one of the 14 keeps its node — the
literal node set difference between the two arms is zero — so nothing is lost
from the graph; what moves is which end of the edge the call is attributed to.

## Why they appear now

They are not a regression introduced by the declaration-space key. They are a
pre-existing dispatch behaviour that the export gate was hiding: `lifecycle.ts`
and `event.ts`, which declare `IDisposable` and `Event`, were two of the 676
files that gate discarded. With no `IDisposable` in the corpus a `.dispose()`
call had no interface member to prefer and fell through to a concrete method.
Readmitting the declarations gives member lookup an interface member to bind,
and it binds it exclusively.

The same shape reaches `TaskDefinitionRegistry`, whose declared type is
`ITaskDefinitionRegistry` and whose sole implementation is a file-private class.
A single-implementation interface is the case where attributing the call to the
implementation is unambiguous, so it is the one to fix first.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A call through a binding whose declared type is an interface records an edge to the implementing member as well as to the interface member, so the implementation is reachable. Asserted on the single-implementation case first, where the target is unambiguous.
- [ ] #2 All 14 sites listed above have at least one incoming resolved call edge over vscode's `src/` at `f3fa55c3` and are absent from the raw entry-point set.
- [ ] #3 The node set is unchanged and the resolved-edge count only rises: this repair adds attributions, it never moves one off the interface member, because a consumer asking "who calls `IDisposable.dispose`" is asking a real question.
- [ ] #4 An interface with many implementations does not fan one call site out to all of them without a bound; whatever bound is chosen is stated in the module and measured over this corpus.

<!-- AC:END -->
