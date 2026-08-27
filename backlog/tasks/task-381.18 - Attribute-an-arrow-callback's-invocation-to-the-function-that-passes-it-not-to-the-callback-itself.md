---
id: TASK-381.18
title: "Attribute an arrow callback's invocation to the function that passes it, not to the callback itself"
status: To Do
assignee: []
created_date: "2026-08-25 10:55"
labels:
  - bug
  - call_resolution
  - entry_points
dependencies:
  - TASK-381.1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

An arrow function passed to a higher-order function is recorded as calling
itself, and the function that actually passes it has no edge to it at all.

Seventeen lines are enough to see it, and to see that the same construct written
as a `function` expression behaves correctly:

```ts
function helper_from_arrow(value: number): number { return value + 1; }
function helper_from_function_expression(value: number): number { return value + 2; }

export function dead_with_arrow(values: number[]): number[] {
  return values.map((value) => helper_from_arrow(value));
}

export function dead_with_function_expression(values: number[]): number[] {
  return values.map(function (value) {
    return helper_from_function_expression(value);
  });
}
```

The reported graph:

```text
<anonymous>@10  -> helper_from_arrow                     (real call)
<anonymous>@10  -> <anonymous>@10                        (synthetic, SELF)
dead_with_function_expression -> <anonymous>@14          (synthetic, correct)
```

`dead_with_function_expression` reaches its callback. `dead_with_arrow` reaches
nothing — its callback, and `helper_from_arrow` which only that callback calls,
hang off a self-loop with no path from any entry point.

Two consequences, both on the capability this codebase exists for.

A caller under-reports what it reaches. Anything a function does through an
arrow callback is invisible from that function, so "what does this function
call" and "what dies if I delete it" are both answered wrongly. Deleting
`dead_with_arrow` silently orphans `helper_from_arrow`, and nothing in the graph
says so.

An orphaned arrow callback never surfaces as unreachable. The synthetic edge
exists so that callbacks are not reported as unreachable; for an arrow it
achieves that by making the callback its own caller, which suppresses the report
whether or not any real caller exists. A callback nothing reaches looks exactly
like one that is called.

Measured on the first 200 path-sorted `.ts` files of `microsoft/vscode`
`src/vs/base` at corpus commit f3fa55c3 — 4,917 nodes, 1,092 of them anonymous —
**782 anonymous functions are recorded as calling themselves, and every one of
those 941 total self-edges that has an anonymous caller comes from the synthetic
callback invocation**. The remaining 159 self-edges all have named callers and
none is a callback invocation: those are ordinary recursion and are correct. So
72% of the anonymous callables in that slice carry the defect.

The mechanism. `resolve_callback_invocations`
(`packages/core/src/resolve_references/call_resolution/call_resolver.ts:449-513`)
emits the synthetic invocation with `scope_id: callable.defining_scope_id`, and
`call_resolver.ts:105` turns that into the caller by walking
`find_enclosing_function_scope`. For an arrow, `defining_scope_id` is the
arrow's OWN function scope — for the arrow at 2:21-4:3 in a probe file it is
`function:…:2:21:4:3`, the identical span — so the walk stops on the callee at
its first step and returns the callback as its own caller. For a `function`
expression at 8:24-10:3 the same field holds `function:…:7:28:11:1`, the
enclosing function's scope, and the edge lands where it should. The asymmetry
comes from how each form's `scope_id` is captured, not from the scope walk,
which is doing exactly what it documents.

Anonymous `function` expressions also log `Could not find body scope for
anonymous function …` on the same probe file and reach the call graph without a
body scope. That is a separate symptom in the same area, recorded here so it is
not mistaken for this defect while fixing it.

This surfaced while measuring the load harness against real code
(`packages/core/src/benchmark_corpus_load`), which is why it hangs off
TASK-381.1; it is a correctness defect on its own terms and not a performance
one.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A synthetic callback invocation is attributed to the function whose body holds the receiver call, for arrow functions and `function` expressions alike. On the probe file above, `dead_with_arrow -> <anonymous>@10` is reported and `<anonymous>@10 -> <anonymous>@10` is not.
- [ ] #2 No call graph reports an anonymous callable as its own caller through a callback invocation. Over the 200-file `folder-ts:src/vs/base` slice at f3fa55c3 the count goes from 782 to 0, while the 159 named-caller self-edges — genuine recursion — are untouched.
- [ ] #3 Deleting the only function that passes an arrow callback makes that callback, and anything only it calls, reachable from nothing. Asserted on the probe file: with `dead_with_arrow` removed, `helper_from_arrow` is reported.
- [ ] #4 A regression test in `call_resolver.test.ts` pins the arrow and `function`-expression forms side by side, so the two cannot diverge again without a failure.
- [ ] #5 The seven-number fingerprint over the in-repo `packages/core/benchmark_corpus` moves only in the components this fix should move, and the committed member list in `call_graph_fingerprint.corpus.test.ts` is re-derived from the corpus source rather than pasted from a run.
- [ ] #6 `Could not find body scope for anonymous function` is either fixed or filed as its own task with its own evidence; it is not left as an unexplained warning on the corpus.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## What the user gets

A function that passes a callback reaches it. Ask "what does `dead_with_arrow`
call" and the arrow it hands to `map` is in the answer; delete
`dead_with_arrow` and `helper_from_arrow`, which only that arrow calls, is
reported as reachable from nothing. Both answers were wrong before, in opposite
directions: the caller reached nothing, and the callback was its own caller, so
an orphaned callback could never surface.

On the probe file the reported graph is now symmetric between the two forms,
and both callbacks are nodes:

```text
dead_with_arrow               -> <anonymous>@5   (synthetic)
<anonymous>@5                 -> helper_from_arrow
dead_with_function_expression -> <anonymous>@9   (synthetic)
<anonymous>@9                 -> helper_from_function_expression
```

## Two defects, one construct

The synthetic invocation carried `scope_id: callable.defining_scope_id`. That
field says where the callback is DEFINED; the invocation happens where the
receiver call is WRITTEN. For a `function` expression the two coincide by
accident, for an arrow they do not, and the enclosing-function walk returned the
arrow itself. The invocation now carries the receiver call's own `scope_id`,
which is the same field every real call site uses, so the two forms cannot
diverge again through this path.

Repairing that alone left five anonymous callables still their own caller, and
the cause was the second defect — the one AC #6 names. `find_body_scope_for_definition`
matched an anonymous definition to the smallest scope CONTAINING it. An
anonymous definition spans its whole node, but its scope opens at the parameter
list: `(v) => v` puts the two on the same span, while `async (v) => v` and
`function (v) {…}` open the scope after the definition starts. So no scope
contained those definitions, and the match either threw — the
`Could not find body scope for anonymous function` warning — or, where an
enclosing callback existed, silently handed over that callback's scope. A
callback that borrows its neighbour's scope reports the neighbour's calls as its
own, including its own invocation. The match now takes the outermost anonymous
scope INSIDE the definition's span, which is the definition's own scope for all
three forms and never a nested callback's.

Both fixes are needed for AC #2. On the vs/base slice the resolver fix alone
takes anonymous-caller self-edges from 700 to 4, and the body-scope fix takes
those last four to 0 — every one of them an `async` arrow nested inside another
arrow, at `async.ts:2090`, `:2096`, `:2507` and `:2513`, each having borrowed the
outer arrow's scope. The warning is fixed rather than filed:
it is the same construct, and no task remains open against it.

## Measured on the vs/base slice

`microsoft/vscode@f3fa55c3` · `folder-ts:src/vs/base` · 200 of 479 files (185
indexed, 15 dropped) · Darwin 24.6.0 · node v22.22.1. Control arm is this tree
with only the two source files reverted, run in the same session; its seven
components reproduce TASK-381.10's committed baseline row exactly.

| component | before | after |
| --- | --- | --- |
| nodes | 4489/ed52bfdc4390ce91 | 4500/be6ba857c971b4bd |
| call edges | 4612/78fe76a12e7b741f | 4613/5ae4a7e202248f96 |
| unresolved | 8107/af65333659086bff | 8107/d6d22e85763d6577 |
| raw entry points | 1518/47cd168e752835d0 | 1518/47cd168e752835d0 |
| indirect keys | 821/8ffe9ec8ebd60173 | 821/8ffe9ec8ebd60173 |
| dropped | 15/e9240d8d08cdeafd | 15/e9240d8d08cdeafd |
| indirect evidence | 821/f2be5826108a3188 | 821/f2be5826108a3188 |

Self-edges with an anonymous caller: **700 → 0**. Self-edges with a named
caller — ordinary recursion — **110 → 110**, byte-identical. The task was
written against 782 and 159 measured on an earlier tree; 700 and 110 are what
the same slice produces on the tree this step branched from, and the control arm
is that tree.

Every moved member accounts for:

- **nodes +11, −0.** Eleven anonymous callables that had no body scope now have
  one, so each becomes a node. A strict superset; nothing is lost.
- **call edges −722.** 700 are the anonymous self-edges. The remaining 22 are
  calls that were attributed to the wrong caller because the anonymous function
  holding them had no node (17 recorded against `module:<file>`) or had borrowed
  a neighbour's scope (5).
- **call edges +723.** 703 are caller-to-callback edges — 576 from a named
  caller, 127 from an anonymous one. 20 are those mis-attributed calls landing on
  the function that holds them. The three callback edges that vanish rather than
  move gain a better caller in the same pass: `doRefreshSubTree`, `debounce` and
  `throttle` now reach the callbacks that previously reached themselves.
- **unresolved calls ±59, count unchanged.** The same call sites, re-attributed
  from `module:<file>` to the anonymous node that now exists to hold them.
- No callee anywhere in the slice loses every incoming edge, and the raw
  entry-point set does not move.

`Could not find body scope for anonymous function` is emitted zero times over
the slice, against 15 before — one per anonymous definition, across nine files.
Eleven of the fifteen sit in files that survive the load; the other four are in
`dom.ts`, `cancellation.ts` and `filters.ts`, which the load drops, so they
never reach the graph either way. That is why the node count moves by 11 and
not by 15.

## The in-repo corpus does not exercise this

The epic expects this step to move the seven-number fingerprint, and over
`packages/core/benchmark_corpus` it moves in **zero** components: the corpus
holds no anonymous callable at all — no arrow, no `function` expression, no
lambda — so the committed member list needs no edit. Each of its seven lists was
re-derived from the corpus source to confirm that, name by name and span by
span, rather than compared against a run. The guard therefore does not cover
this construct, which is carried as follow-up work rather than fixed here:
adding one would move all seven components and `file_counts`, which is exactly
the movement this step exists to isolate.

## Where the guards live

`call_resolver.test.ts` pins the two forms side by side twice: once over
`resolve_calls_for_files` with each form's `defining_scope_id` set as the indexer
produces it, and once end to end over the probe file through `Project`, asserting
both caller-to-callback edges and nothing else. `scope_lookup.test.ts` pins the
scope-opens-after-the-definition shape and the nested-callback case. All four
were run against the pre-fix tree first: three fail there.

<!-- SECTION:NOTES:END -->
