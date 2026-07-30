---
id: TASK-376.11
title: "Add the single ValueSource channel and its four consumers"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
parent_task_id: TASK-376
priority: high
ordinal: 11000
plan_dedup_keys:
  - 070691d4289c39c6fdd330e66bd866a2eb1322cb1a9d827df222722dce7b6abb
plan_source_tasks:
  - pt-1a93a22f3632558f
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 12.

## Root cause

There is a type channel (`TypeRegistry.symbol_types`) and a call-target channel (each `resolve_*`'s `SymbolId[]`), and no answer to "what value does this binding hold?". `resolve_identifier_base` therefore returns `receiver_type_unknown` (`call_resolution/receiver_resolution.ts:282-288`) and `resolve_constructor_call` returns `constructor_target_not_a_class` (`call_resolution/constructor.ts:87-95`) for the same shapes: `mapper_cls = Mapper; mapper_cls()`, `cls = Parser; p = cls()`, `orig = BaseTask.__call__`, `parser = _parser_dispatch(flav)`, `var s = suites[0]`.

## Work plan

1. Add `resolve_references/call_resolution/value_source.ts` with the union `ValueSource = { kind: "instance_of", type_id } | { kind: "class_object", class_id } | { kind: "callable", symbol_id }` and `resolve_value_source(symbol_id, context): ValueSource | undefined`, with producers in priority order:
   1. **Container element** — `VariableDefinition.collection_source`, or a receiver whose `index_access` carries a literal key; element type from `symbol_type_arguments` or the container's element expressions (one element type, never a union).
   2. **Callee return** — `callable_return_types`, with a `type[X]` / `typeof X` / `Type[X]` head yielding `class_object` and a bare head `instance_of`.
   3. **Qualified member read** — `member_source` where the holder resolves to a namespace import or a class; yields `callable`.
   4. **Local class/function carriers** — a variable with a single class/function assignment, a class attribute with such an initialiser, and a parameter default; yields `class_object` or `callable`. Respect assignment order so a later rebinding does not shadow an earlier call. **Exclude** cross-function carriers (a class passed as an argument, Django's `form_class(**defaults)`): they need interprocedural dataflow.
2. Consume it at four sites: `receiver_resolution.ts:282-288` (before returning `receiver_type_unknown`; both `instance_of` and `class_object` yield a type, and an `index_access` reference with a literal key takes the **element** value source of the base); `constructor.ts:87-95` (follow a `class_object` before returning `constructor_target_not_a_class`, then continue into `find_constructor_in_class_hierarchy` unchanged); `function_call.ts:148` (the `def.collection_source` branch extends to a `callable` value source); and `indirect_reachability.ts:41-88` (`detect_indirect_reachability` marks a callable reachable from a `property_access` **read** whose value source is `callable`).
3. Keep `callable_instance.python.ts` untouched — a `class_object` value source is distinct from `instance_of` precisely so `x()` on an instance keeps routing to `__call__`.
4. Claim **no** call edge for a framework-invoked receiver: `c.loop(...)` in celery is a framework-invocation boundary (`Evloop` is registered as the string `'celery.worker.consumer.consumer:Evloop'`, `consumer.py:184`), not a resolver gap.
5. Add integration tests at the `Project` + `update_file` tier (fixtures under `tests/fixtures/{python,typescript,javascript}/code/integration/`) covering every evidence case for this step: `mapper_cls = Mapper; mapper_cls()` reaching `Mapper.__init__`, with a later rebinding **not** shadowing an earlier call; `cls = Parser; p = cls()` in Python _and_ TypeScript; `def make() -> type[Parser]` then `p = make()(…)`; `p: Parser = make()` (the clobber regression from §7 step 2); Python `self.session = Store()` and class-object-valued class attributes; celery `loops.synloop` reachable via a property-access read with **no** call edge claimed for `c.loop()`; and a cross-function carrier (Django's `form_class(**defaults)`) asserted to stay unresolved by design.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 One `ValueSource` union and `resolve_value_source` exist in `call_resolution/value_source.ts`, with all four producers in the stated priority order.
- [ ] #2 All four consumers route through it: `receiver_resolution.ts:282-288`, `constructor.ts:87-95`, `function_call.ts:148`, `indirect_reachability.ts:41-88`.
- [ ] #3 Class-alias, factory-return, qualified-member-read and element shapes resolve; cross-function carriers remain excluded and unresolved.
- [ ] #4 `x()` on an instance still routes to `__call__` (`callable_instance.python.test.ts` green), and no call edge is claimed for celery's `c.loop()`.
- [ ] #5 Integration tests cover all of this step's evidence cases: `mapper_cls = Mapper`, `cls = Parser` in Python and TypeScript, `def make() -> type[Parser]`, `p: Parser = make()`, `self.session = Store()`, class-object attributes, `loops.synloop`, and the excluded `form_class(**defaults)`.
- [ ] #6 `indirect_reachability.test.ts` and `constructor.test.ts` stay green.

<!-- AC:END -->
