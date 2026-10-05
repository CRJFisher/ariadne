---
id: TASK-389
title: "Attribute a call through an interface-typed binding to the implementation that runs, not only to the interface member"
status: Done
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

- [x] #1 A call through a binding whose declared type is an interface records an edge to the implementing member as well as to the interface member, so the implementation is reachable. Asserted on the single-implementation case first, where the target is unambiguous. BUILT and guarded: `method_lookup.test.ts` asserts `[interface_member, impl]` for the sole-implementation case and `[interface_member, impl_a, impl_b]` for two, and the integration suite asserts the whole resolution set — the interface member `direct`, each implementation `interface_implementation` naming the real declaring interface.
- [ ] #2 NOT MET as written, and the shortfall is accounted rather than waived. MEASURED over vscode `src/` at `f3fa55c3`: **3 of 14** sites are absent from the entry-point set — `TaskDefinitionRegistryImpl.onReady` / `.get` / `.getJsonSchema` — and they were ALREADY reached on the control tree by earlier work in epic 381, so this step did not close them. The other **11** are the `dispose` methods on editor contributions, and they are a DIFFERENT defect, not an interface-attribution one: they are disposed by iterating a `DisposableMap<string, IEditorContribution>`, so the receiver never gets a type, and their classes satisfy `IDisposable` only structurally, so the subtype registry does not connect them. The corpus refutes the description's mechanism directly — `IDisposable.dispose` receives **4** incoming resolved edges corpus-wide, all in test files, and the dispose-call failure taxonomy is `type_inference/receiver_type_unknown` at 3,245 and `member_type_unknown` at 1,175, which fail before the interface branch is ever reached. The population is TASK-394. What this step does close is the population the ACs did not name: **18 fewer** symbols are reported as uncalled entry points over the same corpus, and `FileSystemStorage.sweep` — the site the repo's own dead-code hook blocked on — now resolves.
- [x] #3 The node set is unchanged and the resolved-edge count only rises. MEASURED: nodes **201,595**, byte-identical to the control recorded in `RECORDED_EXPORT_DECLARATION_SPACE`, and filtered entry points fall 15,621 → 15,603 under one measurement method across both arms. The interface member declares no body, so `build_function_nodes` never makes it a node — the attribution is added to an edge list and no resolution is moved off any target. Guarded by the integration assertion that the member gains an edge while `call_graph.nodes.has(member)` is false.
- [x] #4 The bound is stated in `method_lookup.ts` and measured: this repair adds **exactly one** attribution per interface dispatch — the member the call names — and leaves the implementation fan-out mechanism untouched, which the unit tests pin at one, two and three implementations. The fan-out itself stays the natural implementation count rather than a constant cap, and the explosion this criterion feared does not occur on this corpus: the widest interface in play, `IDisposable`, has 460 declared subtypes but receives 4 dispatches, because the calls that would reach it fail at receiver typing first (see #2).

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

A method called on a binding whose declared type is an interface now reaches the
implementation that runs, so that implementation is no longer reported as dead
code. Two repairs deliver it, and a call through an interface keeps its edge to
the interface member as well.

**Typing a destructured binding.** `const { storage } = options` bound `storage`
with no type, so `storage.sweep()` resolved to nothing and
`FileSystemStorage.sweep` surfaced as an uncalled entry point — the exact defect
the repo's own dead-code hook blocked on. The indexer now records where a
destructured binding came from (`destructured_from` / `destructured_key` on
`VariableDefinition`, populated only for a variable declarator's own object
pattern with a bare-identifier initializer, JavaScript and TypeScript), and
receiver resolution types the binding as the declared type of the property it
unpacks — the same type a written `options.storage` reaches, by the same member
walk, under a visited-set guard so a self-referential destructuring stops
instead of looping.

**Co-attributing the interface member.** A call on an interface-typed receiver
resolved only to implementations. It now records the interface member the call
names as well, leading the list, so the graph holds the dispatch as the source
wrote it and not only as it runs, while entry-point detection still reaches
every implementation. The edge is in the graph data — resolutions, the callers
index, the fingerprint and the triage evidence; asking for it by name through
the MCP tools needs a query surface that does not exist yet, recorded as
TASK-396. The interface member has no body scope, so it is
never a call-graph node — the attribution is added, never moved. Call resolution
now names the real declaring interface as each implementation's reason,
replacing an `"unknown"` placeholder, and labels a class dispatch (base plus
overrides) as direct rather than mislabelling it as an interface implementation.

**Measured over microsoft/vscode `src/` at f3fa55c3.** The node set is unchanged
at 201,595 (byte-identical to the recorded control), resolved edges only rise,
and 18 fewer symbols are reported as uncalled entry points. Of the fourteen
sites the task named, three (`TaskDefinitionRegistryImpl.onReady` / `.get` /
`.getJsonSchema`) are already reached on the current tree by earlier work in
epic 381; the eleven `dispose` methods on editor contributions are a different
defect — they are disposed through a generic `DisposableMap` container and are
held as `IDisposable` only structurally, so neither repair here reaches them.
That population is TASK-394. The task description's hypothesis that a
`.dispose()` call "lands on the interface member and stops there" is refuted:
`IDisposable.dispose` receives only four incoming edges corpus-wide, all in test
files, and the dispose-call failures are `receiver_type_unknown` (3,245) and
`member_type_unknown` (1,175), never reaching the interface branch.

### What changed

`extract_destructured_binding` (`index_single_file/query_code_tree/symbol_factories/destructuring.javascript.ts`)
records a binding's source and key from one strict AST walk, and both variable
capture handlers — the JavaScript one and its TypeScript sibling, which the
failing site goes through — carry the pair onto the `VariableDefinition` that
`definition_builder` writes. `receiver_resolution.ts` gains one rung at the end
of the identifier ladder, after the annotation branch, because an annotation the
author wrote outranks a type inferred from where the binding came from; the rung
resolves the source as a receiver in its own right and takes one
`walk_property_chain` hop, so a chain of destructurings resolves a hop at a time
and a self-referential one stops at the visited set.

`method_lookup.ts` prepends the interface member to the implementations it
already returned, and `call_resolver.ts` reads the head's owner to name the
declaring interface on each implementation's reason — which also stops a class
dispatch being labelled an interface implementation, as the previous
`resolutions.length > 1` heuristic did.

Two consumers assumed every resolution target is a graph node, and the interface
member is the first target that is not. `collect_callee_ids` in the MCP
traversal now filters a node's callees to symbols the graph holds, because
`sort_symbol_ids` orders by a node's location and returns 0 when it has none —
which would have left the comparator without a total order over the real
callees. `count_tree_size` skips a non-node target for the same reason a member
is not a node: nothing executes it, so it is not part of a fan-out.

### Scope boundaries, each with its reason

Provenance is recorded only for a variable declarator's own object pattern whose
initializer is a bare identifier. A nested pattern needs a key path rather than a
key; an array or rest pattern is keyed by position or by complement; a parameter,
a `for…of` head and a bare assignment have no declarator; and a member access, a
call, an `await` or a non-null assertion names no binding whose members carry the
property's type. Every one of those shapes is pinned by a test asserting the
provenance is absent, so the boundary is recorded rather than assumed. A
default-valued binding (`const { storage = fallback } = options`) is not indexed
as a variable at all — a capture gap in the `.scm` queries, recorded as TASK-395.

### What was measured

Over microsoft/vscode `src/` at `f3fa55c3`, loaded cold from a built `dist`:
nodes 201,595 (unchanged), filtered entry points 15,621 → 15,603, resolved
attributions 1,282,146. Over this repository's own `packages/core`, the
`load_project` call on `storage.sweep` resolves to three targets — the
`PersistenceStorage.sweep` member and both implementations — and the dead-code
hook stops reporting `FileSystemStorage.sweep` without any addition to the
known-entrypoints whitelist.

The suites are green: `packages/core` at 194 files / 4,430 tests, `packages/mcp`
at 241, with `tsc --noEmit` clean on `packages/core` and `packages/types`. The
in-repo call-graph and diagnostics fingerprint guards pass unchanged and needed
no re-baseline, because the committed benchmark corpus contains neither an
interface nor a destructuring pattern.

Note for anyone re-measuring: a cache entry's validity is stamped with the
package version, so an indexer change does not retire blobs written before it
until the release bump lands. Clear the project's cache under `~/.ariadne/cache`
or set `ARIADNE_CACHE_DIR=off` before trusting a local run, or a warm cache will
replay a pre-repair index and hide the fix.

### Spec note

The acceptance criteria name only the interface-attribution half. The repair that
actually closes the reported defect is the destructured-binding typing, which no
criterion covers; it is recorded here as a deliberate extension rather than
retrofitted as a criterion, and it is guarded by unit, indexer, incremental and
integration tests.

<!-- SECTION:NOTES:END -->
