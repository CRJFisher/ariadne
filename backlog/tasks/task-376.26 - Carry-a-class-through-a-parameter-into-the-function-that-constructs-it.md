---
id: TASK-376.26
title: Carry a class through a parameter into the function that constructs it
status: To Do
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
- [ ] #1 A parameter whose resolved call sites all pass the same class is typed as that class, and a parameter reached from two different classes records a miss rather than a union.
- [ ] #2 A local bound from a call whose callee returns a class is typed as that class.
- [ ] #3 The carrier-derived type re-answers its callers through the existing re-resolution phase, and an incremental `update_file` that changes a call site changes the carrier's answer.
- [ ] #4 Integration tests cover django's `form_class = self.get_form_class(); form_class(**defaults)` and a `def build(cls, **kw): return cls(**kw)` factory.
- [ ] #5 Per-reason recovery is measured on django, pandas and celery against TASK-376.18's achieved row.
<!-- AC:END -->
