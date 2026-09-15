---
id: TASK-376.19
title: "Walk an initialiser's callee chain once, in the value source"
status: To Do
assignee: []
created_date: "2026-09-15 06:37"
labels:
  - receiver_type_inference
dependencies:
  - TASK-376.11
parent_task_id: TASK-376
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A binding a call initialises holds what calling its callee yields, and two walkers answer that today.

- `TypeRegistry` STEP 1.5 (`registries/type.ts`, `resolve_initializer_callee` / `resolve_member`) resolves the callee chain eagerly at file update, reads a value's type only where the updating file declares the value (so the answer does not depend on file order), and records the declared return type as the binding's `get_symbol_type`.
- `call_resolution/value_source.ts` producer 2 (`callee_return_value` → `resolve_read_value` → `resolve_chain_binding`) resolves the same chain lazily at call resolution, across files, and also answers class-object returns and Python `make()(io)`.

`resolve_identifier_base` reads STEP 1.5's record first and falls through to the value source on a miss, but `constructor.ts` (`find_held_class_definition`) and `function_call.ts` (step 2) call `resolve_value_source` directly, so a binding STEP 1.5 already typed is walked a second time by the other algorithm. Two builders of one fact drift: a chain shape one walker learns the other silently misses.

## Work plan

1. Establish every consumer of STEP 1.5's `symbol_types` entries for call-initialised bindings (receiver hops, `resolve_member`'s file-local value hop, anything reading `get_symbol_type` / `get_symbol_type_arguments` for such a binding).
2. Make the value source the one walker: delete STEP 1.5 and `resolve_initializer_callee`, and route those consumers through `resolve_value_source` — keeping type arguments a declared return carries, which the value source does not yet return.
3. Keep resolution independent of load order: the value-source walk runs at call resolution after every file is registered, and `value_source.test.ts`'s listed/reversed/bulk snapshot must stay equal.
4. Measure with the TASK-376.16 harness on celery and angular: resolved calls and entry points must not regress, and report the resolve-pass time change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One walker answers what calling an initialiser's callee yields; STEP 1.5 and resolve_initializer_callee are deleted
- [ ] #2 Every former consumer of STEP 1.5's record reads the value source, including declared return type arguments
- [ ] #3 value_source.test.ts load-order snapshot stays equal across listed, reversed and bulk loads
- [ ] #4 Harness run on celery and angular shows no lost call edge and no gained entry point
<!-- AC:END -->
