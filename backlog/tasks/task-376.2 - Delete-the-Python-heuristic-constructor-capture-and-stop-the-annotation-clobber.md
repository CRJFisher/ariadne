---
id: TASK-376.2
title: "Delete the Python heuristic constructor capture and stop the annotation clobber"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 2000
plan_dedup_keys:
  - 8cc3142ff2d835f7edcfe613ce5d67ae9fadb4a5f00295d8a586cfe6412543c2
plan_source_tasks:
  - pt-c86aedb46bb9c742
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 2.

## Root cause

`queries/python.scm:731-736` captures **every** call with an argument list as `@reference.constructor`. `preprocess_references.python.ts:36-54` is the precise builder — it checks the callee actually resolves to a class — so the heuristic triples constructor edges when the callee is a class and is the entire source of `constructor_lookup / constructor_target_not_a_class` in Python. Separately, `TypeRegistry` STEP 1 (`resolve_references/registries/type.ts:153-166`) accepts any binding whose annotation resolves, including a speculative constructor binding that resolves to a _function_, and `extract_type_data` (`:99-135`) orders inferred bindings after declared ones, so Python `p: Parser = make()` types `p` as the function `make`.

## Work plan

1. Confirm `potential_construct_target` still reaches `preprocess_references.python.ts:50` from the plain `@reference.call` capture, then delete the heuristic capture at `queries/python.scm:731-736`.
2. In `registries/type.ts` STEP 1, skip a binding whose resolved `type_id` is not a `class` / `interface` / `enum` definition — a speculative constructor binding that resolves to a function is not a type.
3. In `extract_type_data` (`:99-135`), order annotation bindings last (`new Map([...ctor_bindings.direct, ...type_bindings_from_defs])`) so a declared type beats an inferred one.
4. Add integration tests at the `Project` + `update_file` tier covering every evidence case behind these rows: a Python module-level and method-level plain call that must **not** produce a constructor edge; a genuine `C()` construction that still resolves through `preprocess_references.python.ts`; celery/django call sites currently reporting `constructor_target_not_a_class` from the heuristic; the `p: Parser = make()` clobber regression (declared `Parser` wins over inferred `make`); and the pandas `parser = _parser_dispatch(flav)` shape asserting no spurious constructor edge. Add or update the Python fixtures under `tests/fixtures/python/code/integration/`.
5. Keep `preprocess_references.python.test.ts` green — it is the surviving builder's insulation.

Landing this early makes every later Python measurement in the epic honest.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The heuristic `@reference.constructor` capture is gone from `queries/python.scm` and constructor edges in Python come solely from `preprocess_references.python.ts`.
- [ ] #2 The phantom `constructor_target_not_a_class` population in Python clears; real `C()` constructions still resolve.
- [ ] #3 STEP 1 rejects a binding whose resolved type is not a class/interface/enum, and a declared annotation beats an inferred constructor binding.
- [ ] #4 Integration tests with Python fixtures cover all evidence cases for this step: the tripled-constructor call sites, a genuine construction, `p: Parser = make()`, and the pandas `_parser_dispatch` shape.
- [ ] #5 `preprocess_references.python.test.ts` and `type_preprocessing/{bindings,constructor_bindings}.test.ts` stay green.

<!-- AC:END -->
