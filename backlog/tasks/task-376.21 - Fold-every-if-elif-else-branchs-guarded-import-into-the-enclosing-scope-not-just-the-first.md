---
id: TASK-376.21
title: >-
  Fold every if/elif/else branch's guarded import into the enclosing scope, not
  just the first
status: To Do
assignee: []
created_date: '2026-09-17 20:29'
labels:
  - plan-export
  - method_lookup
dependencies:
  - TASK-376.12
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Root cause

`collect_hoisted_imports` (`name_resolution.ts`) layers a descendant block scope's import bindings into the enclosing module or function scope (TASK-376.12). When the same name is bound under more than one sibling branch of one `if`/`elif`/`else` chain, it keeps only the first branch's binding for that name in the enclosing scope, so a call made after the chain resolves to that branch's target alone.

pandas's `to_stata` (`pandas/io/stata.py`) binds `statawriter` under `if version == 114: from pandas.io.stata import StataWriter`, `elif version == 117: … StataWriter117` and `else: … StataWriterUTF8`, then calls `statawriter(...)` after the chain. The call resolves to `StataWriter.__init__` only; `StataWriter117.__init__` and `StataWriterUTF8.__init__` never receive that call edge. Neither loses its entry-point status only because other, unrelated callers reach them directly — the actual call site is still missed.

Measured on TASK-376.12's candidate tree (`fc26d312`) against the epic's starting tree (`279221d4`) and control (`f0f3d7f9`): the call is `name_not_in_scope` on both trees before this fix and resolves to `StataWriter.__init__` alone after, on all three.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A call reached only through a name bound under more than one sibling branch of an if/elif/else (or try/except/finally) chain resolves to every branch's binding, not just the first, when the branches disagree on the imported symbol.
- [ ] #2 pandas's to_stata dispatch (StataWriter / StataWriter117 / StataWriterUTF8 chosen by version) is added as a fixture, and the statawriter(...) call after the chain carries a call edge to all three constructors.
- [ ] #3 collect_hoisted_imports's existing precedence rules (a scope's own import beats a hoisted one, a nested branch's import does not answer a call in a sibling branch) are preserved for the single-branch case.
<!-- AC:END -->
