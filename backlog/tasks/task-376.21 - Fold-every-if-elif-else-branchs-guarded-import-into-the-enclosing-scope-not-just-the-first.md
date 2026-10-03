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

pandas's `DataFrame.to_stata` (`pandas/core/frame.py`) binds `statawriter` under `if version == 114: from pandas.io.stata import StataWriter as statawriter`, `elif version == 117: … StataWriter117 as statawriter` and `else: … StataWriterUTF8 as statawriter`, then calls `statawriter(...)` after the chain. The call resolves to `StataWriter.__init__` only; `StataWriter117.__init__` and `StataWriterUTF8.__init__` never receive that call edge. Neither loses its entry-point status only because other, unrelated callers reach them directly — the actual call site is still missed.

Measured on TASK-376.12's candidate tree (`fc26d312`) against the epic's starting tree (`279221d4`) and control (`f0f3d7f9`): the call is `name_not_in_scope` on both trees before this fix and resolves to `StataWriter.__init__` alone after, on all three.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A call reached only through a name bound under more than one sibling branch of an if/elif/else (or try/except/finally) chain resolves to every branch's binding, not just the first, when the branches disagree on the imported symbol.
  Evidence: `collect_hoisted_imports` returns every branch's import and `resolve_scope_recursive` binds the first in `own` and records each distinct target in `ScopeResolutions.branch_bindings` (kept only while `own` still holds the first hoisted binding, so a local definition or the scope's own import clears it). `resolve_all` reads them; `resolve_function_call` fans a bare call out to each, and `resolve_constructor_call` constructs each class, `preprocess_python_references` rewriting a call to a constructor call only when every branch binds a class. `resolve_references.python.test.ts` › "reaches every branch's function when if/else imports one name from different modules" and "… try, except and finally import one name …" (three modules) fail on the tree before this step and pass after; "answers a call once when the branches import the one symbol" pins that agreeing branches stay one target. `preprocess_references.python.test.ts` pins the all-classes and mixed-branch cases.
- [x] #2 pandas's to_stata dispatch (StataWriter / StataWriter117 / StataWriterUTF8 chosen by version) is added as a fixture, and the statawriter(...) call after the chain carries a call edge to all three constructors.
  Evidence: fixture `tests/fixtures/python/code/integration/stata_writer_dispatch/pandas/{io/stata.py,core/frame.py}`; `resolve_references.python.test.ts` › "reaches every constructor the branches of pandas's to_stata dispatch import under one name" asserts the call resolves to the three `__init__`s (fails on the tree before this step). The doc's file citation is corrected: `to_stata` lives in `pandas/core/frame.py`, the writers in `pandas/io/stata.py`. Run on the real pandas `frame.py` and `stata.py` (checkout `7986b425`, two files only, not a corpus figure) the call at `frame.py:2635` resolves to `StataWriter.__init__` (`stata.py:2494`), `StataWriter117.__init__` (`:3473`) and `StataWriterUTF8.__init__` (`:3864`). The Python fixture-corpus tally pinned in `call_resolver.test.ts` moves from 92 files / 356 calls / 259 resolved / 97 failed to 97 / 364 / 264 / 100 for the five added fixture files.
- [x] #3 collect_hoisted_imports's existing precedence rules (a scope's own import beats a hoisted one, a nested branch's import does not answer a call in a sibling branch) are preserved for the single-branch case.
  Evidence: the existing `resolve_references.python.test.ts` cases "keeps a scope's own import ahead of one hoisted out of a guard clause", "does not let a nested branch's import answer a call in a sibling branch", "lets a function-local guarded import shadow a same-named module-level import" and "keeps each branch's call on its own import …" pass unchanged; two added cases ("keeps a scope's own import ahead of every branch's hoisted import", "keeps a call in one branch on that branch's import when the other branches bind the name too") pass on the tree before and after. `cd packages/core && npx tsc --noEmit && npx vitest run`: clean typecheck, 5,371 tests passing across 234 files after the pinned fixture tally was updated.
<!-- AC:END -->
