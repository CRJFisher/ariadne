---
id: TASK-376.27
title: Measure whether a Python loop or match clause needs a block scope at all
status: Done
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
- [x] #1 What each of the four scopes holds is enumerated on django, pandas and celery, with the count read from outside it.
  Evidence: the table under "What the four scopes hold" below, over every `.py` file of the three corpora (django 2,912, pandas 1,510, celery 418) at the commits the harness pins. `for` and `while` hold 7,028 + 184 (django), 5,693 + 116 (pandas) and 863 + 87 (celery) bindings, of which 1,354 + 84, 1,787 + 65 and 213 + 31 are read from outside the scope that holds them; `match` and `case` hold 6 bindings in all three corpora, 4 of them read from outside.
- [x] #2 A candidate tree without the four captures is measured against TASK-376.18's achieved row, per failure reason and by literal set difference over call edges and raw entry points.
  Evidence: `--interleave` (control, candidate, control, candidate) on django, pandas and celery, run dir `~/.ariadne/benchmark-runs/task-376.27/`; per-reason and set-difference figures under "Measured" below. Control is this tree (`ariadne@0dceea99`), candidate is this tree with the four `@scope.block` captures deleted; each arm's two runs agree.
- [x] #3 The decision is recorded: the four are removed, or `python.scm`'s header states what each confines.
  Evidence: the four stay. `queries/python.scm`'s header above the block-scope captures states what every group confines, with the measured cost of removing `for`/`while` and the caveat that `match`/`case` were measured only jointly with them.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Decision

The four scopes stay. Python has no block scoping, but name lookup keeps one binding per name per scope and the last one wins, so a loop's target or body assignment that shares a name with an earlier binding, or with another loop's target in the same function, replaces it if no scope separates them. Removing the four captures resolves 5 and 8 fewer calls on django and pandas, moves call edges on all three corpora, and recovers no resolved call anywhere: `name_not_in_scope` falls by 6 (django) and 8 (pandas) while `receiver_type_unknown` rises by 12 and 16, so those references still fail, on the receiver instead. No test changes: nothing was removed, so there is no fixture to adjust (step 4).

## What the four scopes hold

Counted from each file's semantic index: a binding is a variable, constant, class or import whose `defining_scope_id` is the scope; it is "read outside" when some call, variable read, callable value or method/property receiver of that name lies inside the nearest enclosing function or module but outside the scope, and no nested function between the two defines the name. Name matching makes the read count an upper bound.

| Corpus | Scope | Scopes | Empty | Bindings | Bindings read outside | Outside reads |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| django | `for` | 3,913 | 7 | 7,028 | 1,354 | 10,372 |
| | `while` | 120 | 24 | 184 | 84 | 563 |
| | `match` | 5 | 5 | 0 | 0 | 0 |
| | `case` | 22 | 17 | 6 | 4 | 44 |
| pandas | `for` | 2,545 | 2 | 5,693 | 1,787 | 15,904 |
| | `while` | 72 | 18 | 116 | 65 | 437 |
| | `match` | 1 | 1 | 0 | 0 | 0 |
| | `case` | 3 | 3 | 0 | 0 | 0 |
| celery | `for` | 571 | 0 | 863 | 213 | 1,511 |
| | `while` | 97 | 45 | 87 | 31 | 257 |
| | `match`, `case` | 0 | | | | |

Origin of the bindings: `for` holds the loop target (5,360 / 3,427 / 694) and assignments in the body (1,667 / 2,266 / 168); `while` holds body assignments (plus 4 walrus targets in django). Capture patterns in a `case` are not recorded as bindings at all: 4 in django, none in pandas or celery. The enumeration confirms the Description: the loop target and body bindings are real bindings of the enclosing function, read from outside the scope that holds them for 19-31% of the `for` bindings and 36-56% of the `while` bindings; the block scope is what keeps them from colliding, not what makes them visible.

## Measured

Control: this tree. Candidate: this tree with `(for_statement)`, `(while_statement)`, `(match_statement)` and `(case_clause)` deleted from `@scope.block`. Both arms per corpus ran control, candidate, control, candidate in one session on one box; the control's `ariadne@0dceea99` is later than TASK-376.18's achieved row (`ariadne@038b7daa`), so the control is the comparand and the achieved row is quoted for the distance between them.

| Corpus | Resolved (control → candidate) | `name_not_in_scope` | `receiver_type_unknown` | `method_not_on_type` | Call edges | Raw entry points |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| django | 86,126 → 86,121 (-5) | 30,428 → 30,422 (-6) | 20,730 → 20,742 (+12) | 62,679 → 62,678 (-1) | 67,057 → 67,046, 22 only in control, 11 only in candidate | 2,279 → 2,281, 2 only in candidate |
| pandas | 117,915 → 117,907 (-8) | 60,553 → 60,545 (-8) | 25,463 → 25,479 (+16) | unchanged | 84,168 → 84,161, 9 only in control, 2 only in candidate | unchanged |
| celery | 11,357, unchanged | unchanged | unchanged | unchanged | 9,549 → 9,547, 3 only in control, 1 only in candidate | unchanged |

Every other reason is unchanged on all three corpora. Against TASK-376.18's achieved row the control sits within the tree's later changes (django `name_not_in_scope` 30,477 achieved, 30,428 control; pandas 61,121, 60,553; celery 11,049, 11,046), so the candidate's deltas are the comparison and not the distance to that row.

The literal set difference names the cost. Deleting the captures moves bindings, it does not recover calls:

- celery `t/unit/contrib/test_migrate.py:116` `test_start`: three `callback` calls at `:137`, `:142`, `:156` each had an edge to their own `for callback in ...` binding; without the scopes the three edges become one, to the `:156` binding (3 edges lost, 1 gained).
- django `django/utils/choices.py:72` `normalize_choices -> Medal` and `django/utils/decorators.py:39` `_wrapper -> bound_method` swap to a different binding of the same name; `django/db/models/fields/tuple_lookups.py:188-262` `get_fallback_sql -> lookup` re-points three `lookup` calls.
- django raw entry points gain `django/db/models/sql/query.py:1932:final_transformer` and `makemessages.py:102:preprocess`, each reached on the control and unreached on the candidate. `final_transformer` also leaves `indirect_reachability`, its function reference at `query.py:2006` no longer being recorded as evidence.
- pandas `pandas/io/pytables.py:5118` `process_axes` loses `_get_axis_number`, `_get_axis` and `loc` edges; `pandas/core/internals/blocks.py:816` `replace_list -> b` gains an edge to a loop variable the call does not read.

`name_not_in_scope` falls by less than `receiver_type_unknown` rises (-6 against +12, -8 against +16): the references that stop failing on the name fail on the receiver instead. No reason recovers net resolved calls, and the removal costs 5, 8 and 0 resolved calls while moving 33, 11 and 4 call edges. `match` and `case` were measured only jointly with `for` and `while`; they hold 6 bindings across the three corpora, so any isolated effect is bounded by that.
<!-- SECTION:NOTES:END -->

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Final Summary

Measurement task, decision recorded: the four Python scopes (`for`, `while`, `match`, `case`) stay, because removing them recovers no resolved call and moves call edges on all three corpora; `queries/python.scm`'s header states what each confines. Landed in `e2d5167e` and `ef3f13e4`; merged by `5acc366a`.

<!-- SECTION:FINAL_SUMMARY:END -->
