---
id: TASK-376.27
title: Measure whether a Python loop or match clause needs a block scope at all
status: To Do
assignee: []
created_date: '2026-09-19 13:40'
labels:
  - scope_construction
dependencies:
  - TASK-376.12
parent_task_id: TASK-376
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

`queries/python.scm:73-83` opens a `@scope.block` for eleven Python constructs: `if_statement`, `elif_clause`, `else_clause`, `try_statement`, `except_clause`, `finally_clause`, `with_statement`, `for_statement`, `while_statement`, `match_statement` and `case_clause`. Python has no block scoping, so every one of those scopes is a scope the language does not have.

TASK-376.12 established that the branch clauses earn their place anyway: an `if`/`else` pair holds two same-named locals apart, a guarded `def`'s body is confined by it, and `except … as e` binds an alias Python genuinely deletes at the end of the clause. Import bindings are hoisted out of them rather than the scopes being removed.

`for_statement`, `while_statement`, `match_statement` and `case_clause` were never given that justification. A `for` target and a `while` body bind into the enclosing function in Python, and a `match` subject does too; `case_clause` capture patterns are the only candidate for a real confinement, and they leak to the enclosing function as well. If these four confine nothing, each one is a scope boundary a name lookup has to cross for no reason — the same shape of defect the guarded-import fix cleared, in a construct that is far more common than a guarded import.

The measurement, not the change, is the deliverable: whether removing the four costs any correct resolution, and what it recovers.

## Work plan

1. Enumerate what each of the four scopes actually holds on the Python corpora (django `957d0cee`, pandas `7986b425`, celery `7c5d9a62`): how many bindings, of what kind, and how many of them are read from outside the scope that holds them.
2. Remove the four captures on a candidate tree and measure per-reason recovery against TASK-376.18's achieved row, with the literal set difference over call edges and raw entry points. `name_not_in_scope` is the reason a needless boundary lands in.
3. Decide from the measurement: remove the four, or record in `python.scm`'s header what each confines, so the next reader does not re-open the question.
4. If any of the four is removed, `scopes.test.ts` and `index_single_file.python.test.ts` adjust at the fixture tier, not the assertion tier.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] #1 What each of the four scopes holds is enumerated on django, pandas and celery, with the count read from outside it.
- [ ] #2 A candidate tree without the four captures is measured against TASK-376.18's achieved row, per failure reason and by literal set difference over call edges and raw entry points.
- [ ] #3 The decision is recorded: the four are removed, or `python.scm`'s header states what each confines.
<!-- AC:END -->
