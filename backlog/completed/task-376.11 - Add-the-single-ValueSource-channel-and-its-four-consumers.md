---
id: TASK-376.11
title: "Add the single ValueSource channel and its four consumers"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - receiver_type_inference
dependencies:
  - TASK-376.9
  - TASK-376.10
  - TASK-376.17
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

§7 step 12. Wave 5, beside TASK-376.13. Requires TASK-376.17 (`callable_return_types`), TASK-376.9 (`member_source`, the initialiser call chain, the Python extractor) and TASK-376.10 (the element channel and `index_access`).

## Root cause

There is a type channel (`TypeRegistry.symbol_types`) and a call-target channel (each `resolve_*`'s `SymbolId[]`), and no answer to "what value does this binding hold?". `resolve_identifier_base` therefore returns `receiver_type_unknown` (`call_resolution/receiver_resolution.ts`, `resolve_identifier_base`'s final exit) and `resolve_constructor_call` returns `constructor_target_not_a_class` (`call_resolution/constructor.ts`, `resolve_constructor_call`) for the same shapes: `mapper_cls = Mapper; mapper_cls()`, `cls = Parser; p = cls()`, `orig = BaseTask.__call__`, `parser = _parser_dispatch(flav)`, `var s = suites[0]`.

## Work plan

1. Add `resolve_references/call_resolution/value_source.ts` with the union `ValueSource = { kind: "instance_of", type_id } | { kind: "class_object", class_id } | { kind: "callable", symbol_id }` and `resolve_value_source(symbol_id, context): ValueSource | undefined`, with producers in priority order:
   1. **Container element** — `VariableDefinition.collection_source`, or a receiver whose `index_access` carries a literal key; element type from `symbol_type_arguments` or the container's element expressions (one element type, never a union).
   2. **Callee return** — `callable_return_types`, with a `type[X]` / `typeof X` / `Type[X]` head yielding `class_object` and a bare head `instance_of`.
   3. **Qualified member read** — `member_source` where the holder resolves to a namespace import or a class; yields `callable`.
   4. **Local class/function carriers** — a variable with a single class/function assignment, a class attribute with such an initialiser, and a parameter default; yields `class_object` or `callable`. Respect assignment order so a later rebinding does not shadow an earlier call. **Exclude** cross-function carriers (a class passed as an argument, Django's `form_class(**defaults)`): they need interprocedural dataflow.
2. Consume it at four sites: `receiver_resolution.ts` `resolve_identifier_base` (before returning `receiver_type_unknown`, after the destructured-binding rung; both `instance_of` and `class_object` yield a type, and an `index_access` reference with a literal key takes the **element** value source of the base); `constructor.ts` `resolve_constructor_call` (follow a `class_object` before returning `constructor_target_not_a_class`, then continue into `find_constructor_in_class_hierarchy` unchanged); `function_call.ts` `resolve_function_call` step 2 (the `def.collection_source` branch extends to a `callable` value source); and `indirect_reachability.ts` `detect_indirect_reachability`, which marks a callable reachable from a `property_access` **read** whose value source is `callable`, writing through `record_indirect_reachability` — the single position-ordered writer TASK-381.11 introduced, so the new evidence stays order-independent.
3. Keep `callable_instance.python.ts` untouched — a `class_object` value source is distinct from `instance_of` precisely so `x()` on an instance keeps routing to `__call__`.
4. Claim **no** call edge for a framework-invoked receiver: `c.loop(...)` in celery is a framework-invocation boundary (`Evloop` is registered as the string `'celery.worker.consumer.consumer:Evloop'`, `consumer.py:184`), not a resolver gap.
5. Add integration tests at the `Project` + `update_file` tier (fixtures under `tests/fixtures/{python,typescript,javascript}/code/integration/`) covering every evidence case for this step: `mapper_cls = Mapper; mapper_cls()` reaching `Mapper.__init__`, with a later rebinding **not** shadowing an earlier call; `cls = Parser; p = cls()` in Python _and_ TypeScript; `def make() -> type[Parser]` then `p = make()(…)`; `p: Parser = make()` (the clobber regression from TASK-376.2); Python `self.session = Store()` and class-object-valued class attributes; celery `orig = BaseTask.__call__` + `orig(self, *args)` producing a real edge to `celery/app/task.py:495` instead of the self-edge `orig -> [orig]`; celery `loops.synloop` reachable via a property-access read with **no** call edge claimed for `c.loop()`; and a cross-function carrier (Django's `form_class(**defaults)`) asserted to stay unresolved by design.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 One `ValueSource` union and `resolve_value_source` exist in `call_resolution/value_source.ts`, with all four producers in the stated priority order.
- [x] #2 All four consumers route through it: `receiver_resolution.ts`'s `receiver_type_unknown` exit, `constructor.ts`'s `constructor_target_not_a_class` exit, `function_call.ts`'s `collection_source` branch, and `detect_indirect_reachability` via `record_indirect_reachability`.
- [x] #3 Class-alias, factory-return, qualified-member-read and element shapes resolve; cross-function carriers remain excluded and unresolved.
- [x] #4 `x()` on an instance still routes to `__call__` (`callable_instance.python.test.ts` green), and no call edge is claimed for celery's `c.loop()`.
- [x] #5 Integration tests cover all of this step's evidence cases: `mapper_cls = Mapper`, `cls = Parser` in Python and TypeScript, `def make() -> type[Parser]`, `p: Parser = make()`, `self.session = Store()`, class-object attributes, `orig = BaseTask.__call__`, `loops.synloop`, and the excluded `form_class(**defaults)`.
- [x] #6 `indirect_reachability.test.ts` (including its order-independence cases) and `constructor.test.ts` stay green.

<!-- AC:END -->

## Implementation notes

- **Recording side.** Five facts the channel reads, each recorded once, at index time:
  - `name_source` and `member_source` record what a variable's or class attribute's initialiser, or a parameter's default, reads as a whole — one name (`mapper_cls = Mapper`, `Info=TraceInfo`) or one member of one name (`orig = BaseTask.__call__`, `feed_type = feedgenerator.DefaultFeed`) — from the syntax tree, by `extract_read_source` in `initializer_sources.{python,javascript}.ts`. The value source never re-reads `initial_value` or `default_value` text.
  - `type_preprocessing/class_object_shape.ts` names the annotations that denote a class object: Python `type[X]` / `Type[X]` and TypeScript/JSDoc `typeof X`, which the TypeScript grammar now parses as head `typeof` with argument `X`. `TypeRegistry` STEP 1.2 records a callable returning one as `get_callable_return_class`, apart from `get_callable_return_type`.
  - `DefinitionRegistry.get_scope_rebindings` lists every variable, constant and parameter binding of one name in one scope, in source order, where the scope binds the name more than once. Name resolution keeps one symbol per name per scope, chosen by definition order rather than position (a parameter beats a same-named local), so it could not tell which binding reaches a read.
  - JavaScript/TypeScript `initialized_from_call` reads a `new` expression's constructor chain (`const p = new cls()` → `["cls"]`); Python `initialized_from_call_result` carries the inner callee of `p = make()(io)`, a shape whose outer call emits no reference.
  - `namespace_member.ts` descends a named import of a submodule file (`from celery.worker import loops`) as it does a namespace import, so `loops.synloop` names the function.
- **The channel.** `call_resolution/value_source.ts` holds the `ValueSource` union, `resolve_value_source(binding, read_at, context)` and `resolve_read_value(chain, scope, read_at, context)`, the value a name-chain read denotes, which producers 3 and 4 and the member-read consumer share. The container-element producer is `element_value`, moved out of `receiver_resolution.ts` rather than duplicated; `resolve_container_binding` became the exported `resolve_chain_binding`, and a lone name is now looked up lexically even when it spells a self receiver, so `cls = Parser` binds `cls`.
- **One import direction.** Resolving a name chain and typing a receiver through a binding's value recurse into each other. `value_source.ts` imports `receiver_resolution.ts`; the receiver consumer reaches the value source through the `HeldValueType` callback `resolve_receiver_type` and `resolve_chain_binding` take, which `method_call.ts` and `value_source.ts` supply as `resolve_held_type`.
- **Assignment order.** A read at a known position takes the one binding of its name that precedes it. Where several do, the read holds nothing: Python rebinds under conditions, and the resolver is not flow-sensitive. That is what leaves Django's `form_class(**defaults)` (a parameter plus three conditional rebindings) at its binding, and the second `mapper_cls()` after `mapper_cls = ClassicMapper` too. The receiver consumer has no read position, so it takes the binding name resolution chose.
- **Deviations from the work plan, both needed by the evidence.**
  - `function_call.ts` follows a `class_object` as well as a `callable`: Python never rewrites `mapper_cls(...)`, `cls(...)` or `Info(...)` into a constructor call, so the bare-call site is the only place those constructions resolve. The class stands in for the call and `include_constructors_for_class_symbols` adds its constructor.
  - The qualified member read resolves any holder receiver resolution types, not only a namespace import or a class. Restricting it would take extra code, and the same call covers celery's `on_unknown_task = self.on_unknown_task` and `task_accepted` rows from `pt-76b9c3ac55bc7527`.
- **Unchanged.** `callable_instance.python.ts`: an `instance_of` value is left to it, so `processor(data)` still reaches `__call__`. No edge is claimed for celery's `c.loop()`; `loops.synloop` is reachable only through the member read.
- **Method calls through a class-object attribute** (`self.feed_type()`) still resolve to the attribute: `method_lookup.ts` is TASK-376.13's. What the call yields is typed, so django's `feed = self.feed_type(); feed.add_item()` resolves to `SyndicationFeed.add_item`.
- **Graph changes the suites record.** A JavaScript/TypeScript method read as a value (`const m = b.plain`) is now indirectly reachable, with still no call edge (`project.{javascript,typescript}.integration.test.ts`, `resolve_references.typescript.test.ts`). The Python fixture corpus resolves the pandas `_parse` and `make()(io)` receivers (`call_resolver.test.ts` tallies). The new fixtures add one pinned pre-existing grammar duplicate (`p: Parser = make()`, TASK-374.5).
- **Scratch measurement, not the TASK-376.16 harness** (its IPC pipe is blocked by the session sandbox): bulk load, control and candidate interleaved twice. celery `celery/` (161 files): resolved calls 4,112 → 4,158, entry points 482 → 458, every removal a real indirect caller (the `BaseTask.__call__`, `synloop`/`asynloop`, `on_unknown_*`, `task_accepted`, `handle_error_state` evidence plus bound-method aliases and handlers passed by value), resolve pass 285 → 324 ms. angular `packages/compiler/src` (225 files): resolved 7,999 → 8,019, entry points 200 → 198 (`ir.createConditionalCreateOp` read as a value), resolve pass 402 → 453 ms, of which member reads are about 42 ms.
- **Follow-up, recorded.** `TypeRegistry` STEP 1.5 walks an initialiser's callee chain a second time, eagerly; folding it into the value source is TASK-376.19.
- **Out of scope, recorded.** A JavaScript reassignment without a declaration (`x = B`) is not a binding, so it does not count as a rebinding; `make()()` in JavaScript/TypeScript; a value annotated `type[X]` (only returns are recorded); what calling an instance's `__call__` returns.
