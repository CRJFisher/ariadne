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
