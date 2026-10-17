---
id: TASK-376.26
title: Carry a class through a parameter into the function that constructs it
status: Done
assignee: []
created_date: '2026-09-19 13:40'
labels:
  - receiver_type_inference
  - scope_construction
dependencies:
  - TASK-376.11
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

The value channel (`call_resolution/value_source.ts`) answers what a binding holds from facts recorded in the binding's own file and scope: an annotation, a construction, an initialiser, a collection element. Every one of those is intraprocedural. A class that reaches its construction site through a parameter is invisible to all of them, because the fact that types the parameter was recorded in a different function.

Django is the shape. `get_form_class()` returns `self.form_class`; a caller writes `form_class = self.get_form_class()` and then `form_class(**defaults)`. The construction site's receiver is a parameter or a local whose only evidence is a call to another function, so `resolve_constructor_call` ends `constructor_target_not_a_class` and every method the constructed form declares looks unreachable. The same shape carries a class into a factory as an argument (`def build(cls, **kw): return cls(**kw)`), which is how most Python and TypeScript factory code is written.

Closing this needs a dataflow the pipeline does not have: the callee's return must be joined to the caller's binding, and an argument must be joined to the parameter it binds, across a call edge — and the call edge is itself the product the pipeline exists to compute, so the join is a fixpoint, not a pass.

## Work plan

1. Scope it to one hop and one direction first: a parameter whose only argument at every call site the graph already resolved is the same class, and a local bound from a call whose callee has one recorded `return` of a class. Both are readable off facts the registries already hold; neither needs a general dataflow.
2. Decide where the fixpoint lives. The resolver already re-answers callers when a type's member set or subtype closure changes (`ResolutionState.subtype_dispatch_files`, TASK-376.13); a carrier-derived type is the same shape of change and should re-answer through the same phase rather than a second one.
3. Bound the width. A parameter reached from call sites naming two different classes is not one type; record the miss rather than union it, so a wrong edge is never manufactured where a missing edge stood.
4. Measure on django (`957d0cee`), pandas (`7986b425`) and celery (`7c5d9a62`) against TASK-376.18's achieved row. `constructor_target_not_a_class` and `receiver_type_unknown` are the reasons it lands in.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [x] #1 A parameter whose resolved call sites all pass the same class is typed as that class, and a parameter reached from two different classes records a miss rather than a union.
  Evidence: `call_resolution/carried_class.ts` indexes each resolved bare call's class arguments against the callable they reach; `carried_class()` answers only where every site at that position names one class. `value_source.ts`'s producer 5 reads it for a parameter. `carried_class.test.ts` pins the one-class answer, the two-class refusal, per-position separation and the absent cases; `value_source.test.ts` pins both ends through the pipeline ("constructs the class a factory's every call site passes", "leaves a parameter two call sites hand different classes unresolved" — where the call still stops at the parameter binding, exactly as before).
- [x] #2 A local bound from a call whose callee returns a class is typed as that class.
  Evidence: `FunctionDefinition.returned_name_chain` / `MethodDefinition.returned_name_chain` record the one name chain every value-bearing `return` of a body agrees on, extracted at index time by `returned_name_chain.{python,javascript}.ts`. `value_source.ts`'s `call_result` falls back to resolving that chain in the callee's body scope once no declared return type answers. `value_source.test.ts` pins django's accessor shape and the TypeScript equivalent, and pins the refusal where two returns name different attributes.
- [x] #3 The carrier-derived type re-answers its callers through the existing re-resolution phase, and an incremental `update_file` that changes a call site changes the carrier's answer.
  Evidence: `ResolutionRegistry.resolve_calls_for_files` returns the callees whose carried-class evidence the pass changed; `Project.resolve_files` re-runs phase 5 over the files declaring them, looping while a carrier keeps changing. Both drivers compose `resolve_files`, so `update_file` and `resolve_corpus` get the same fixpoint. `value_source.test.ts` "re-answers the factory when an edit changes which class a call site passes" edits the caller and reads the callee's construction.
- [x] #4 Integration tests cover django's `form_class = self.get_form_class(); form_class(**defaults)` and a `def build(cls, **kw): return cls(**kw)` factory.
  Evidence: both are named cases in `value_source.test.ts`'s "classes carried across a call edge" block, plus the TypeScript form of each in the `typescript` block.
- [x] #5 Per-reason recovery is measured on django, pandas and celery against TASK-376.18's achieved row.
  Evidence: `Measured recovery` below. Control and candidate arms ran back to back on one box over the same file sets; every one of the seven fingerprint components is byte-identical between them on all three corpora, so the recovery is **zero** on each. The reasons are named below.
<!-- AC:END -->

## Implementation notes

### What the capability surface gained

A class that reaches a construction site across one call edge is now recognised, in both directions, so the class it constructs — and the members that class declares — stop being reported as reached by nothing.

- **Out of the accessor that fetched it.** `form_class = self.get_form_class(); form_class(**defaults)` constructs the class `get_form_class` returns, where the accessor declares no return type. Read off a new index-time fact, `returned_name_chain`: the one name chain every value-bearing `return` in a body agrees on.
- **Into the factory it was handed to.** `build(MyForm)` types `cls` inside `def build(cls, **kw): return cls(**kw)`, so the construction in the factory names the class. Read off the classes the resolved call sites pass, indexed by the callable whose body reads them.

Both are one hop and neither unions. A body whose returns name different chains records no chain; a parameter two call sites hand different classes answers nothing and the call stops at the binding, exactly where it stopped before. A missing edge is never replaced by a wrong one.

### Where the evidence lives, and why the pass repeats

The two directions differ in who writes the evidence. A callee's returned chain is written where the callee is declared and read by its caller, which the import graph already re-resolves. A parameter's carried class is written by the *callers* and read inside the *callee* — a direction no import edge runs in. `ResolutionState.class_arguments_by_callee` holds those sites, evicted and replaced per file like `subtype_dispatch_files`; `Project.resolve_files` re-runs call resolution over the files declaring any callable whose carried class the pass changed, and loops while that keeps happening. Each round can only add call sites, so the rounds run out on their own; `CARRIER_RESOLUTION_ROUNDS` is a guard against a pathological chain of factories, not the terminating condition.

### Measured recovery: zero on all three corpora

Control (this tree without the change) and candidate (with it) arms, run back to back on one box, forward order, over the same file sets, at `ariadne@bc42c177`:

| Corpus | Files | Call refs | Resolved | Call edges | Raw entry points |
| --- | ---: | ---: | ---: | ---: | ---: |
| django/django | 3012 | 202972 → 202972 | 85961 → 85961 | 67149 → 67149 | 2289 → 2289 |
| pandas-dev/pandas | 1510 | 244360 → 244360 | 117953 → 117953 | 84240 → 84240 | 2085 → 2085 |
| celery/celery | 418 | 35088 → 35088 | 11256 → 11256 | 9467 → 9467 | 728 → 728 |

Every failure reason is unchanged, and all seven fingerprint components match hash for hash, so this is identity rather than a wash. (The deltas a reader will see against TASK-376.18's achieved row at `038b7daa` — django resolved +83, pandas +2, celery +2 — belong to the commits between that tree and this one, not to this change.)

The mechanism is not inert: over celery, 584 callables carry a `returned_name_chain`, 3,616 bare calls carry identifier arguments, 21 call sites hand a class to 8 callables, and 5 parameter positions are answered with a class. None of those answers is consumed by a construction or a receiver, so the graph does not move.

Two reasons, both about what the corpora actually write:

1. **django's own case is behind a base-class attribute.** `FormMixin.get_form_class` returns `self.form_class`, and `FormMixin` declares `form_class = None`. The class is set by each subclass, so reaching it means reading a `self.<attr>` in a base method as the union of its subclasses' values — precisely the union this task refuses, and a subtype-aware attribute lookup rather than a one-hop carrier. `ModelFormMixin.get_form_class` has several returns that disagree, and `FormMixin.get_form`'s `form_class` is a parameter rebound in the body, so neither producer reaches those either.
2. **The class-bearing call sites are method calls.** The argument channel is scoped to bare calls that reach a function (`FunctionCallReference.call_arguments`). A class handed to `self.build(Form)` or `obj.make(Form)` is not indexed, and in this corpus family that is where factory arguments are written.

### Scope held deliberately

- **Bare calls reaching a function only** for the argument direction. Mapping a method call's argument positions onto a callee's parameters has to account for the implicit receiver parameter, and it differs by language and by how the method is bound (`self`, `cls`, an unbound read). Getting that offset wrong manufactures a wrong edge at exactly the sites this task exists to answer, so it is a design of its own.
- **Python, JavaScript and TypeScript** for `returned_name_chain`. Rust returns a tail expression as often as a `return`, and its factory idiom is `T::new()` resolved through the associated-constructor path, so it needs its own leaf.
- `returned_name_chain.{python,javascript}.ts` sit beside `initializer_sources.{python,javascript}.ts` with no marshaller, as those do: `capture_handlers.{language}.ts` is already below the language switch, and a marshaller nothing calls would be surplus.

### Follow-on

Two follow-ons, both justified by the measurement above rather than by expectation: indexing call arguments on method calls with a sound receiver-parameter offset, and reading a `self.<attr>` in a base method against the subtypes that set it. Either would give this channel purchase on django; neither is reachable inside this task's one-hop bound.
