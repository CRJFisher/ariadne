---
id: TASK-376.19
title: "Walk an initialiser's callee chain once, in the value source"
status: Done
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
- [x] #1 One walker answers what calling an initialiser's callee yields; STEP 1.5 and resolve_initializer_callee are deleted
- [x] #2 Every former consumer of STEP 1.5's record reads the value source, including declared return type arguments
- [x] #3 value_source.test.ts load-order snapshot stays equal across listed, reversed and bulk loads
- [x] #4 Harness run on celery and angular shows no lost call edge and no gained entry point
<!-- AC:END -->

## Implementation notes

The value source is the one walker. `TypeRegistry` STEP 1.5, `resolve_initializer_callee`,
`resolve_member`, `bind_generic_return`, the `call_initializers` extraction and the
`CallInitializer` shape are gone; with them went `SelfTypeResolver` and the
`resolve_self_type` the project handed in, so `TypeResolutionContext` added nothing over
`AnnotationLookupContext` and was deleted too.

What the value source gained, so it answers everything STEP 1.5 did:

- **A generic return bound at the call.** `call_result` falls through
  `get_callable_return_type` to `infer_generic_return`, which now takes a
  `FunctionDefinition | MethodDefinition` — the chained-member hop and an initialiser's
  callee are the same question, asked with and without a receiver. The initialiser's
  `initialized_from_call_arguments` and defining scope travel as one `CallSite`.

Consumers rerouted onto it:

- `resolve_identifier_base` already fell through to the value source on a `get_symbol_type`
  miss, so deleting the record was enough.
- `container_element.ts`'s `literal_element_type` types a literal's element from what the
  element binding holds when no declaration types it. `resolve_element_type` takes the
  `HeldValueType` callback and the visited set, threaded through `walk_property_chain`,
  keeping the one-way value import between the value source and receiver resolution.
- The Python `__call__` protocol reads the instance the caller's own value-source walk
  already found: `resolve_function_call` keeps that `ValueSource` and hands it to
  `resolve_callable_instance`, so the walk runs once per call rather than twice.

**A return's type arguments are not recorded.** A declared return carries its arguments
whether or not its head names a project type — `make(): Map<G, F>` yields `[G, F]` while
`Map` resolves to nothing — so they cannot ride on an `instance_of`, which needs a resolved
head. Recording them against the callable instead was tried and removed: nothing in the
pipeline reads them, and an unread fact is surplus. A call-initialised binding's own
`get_symbol_type_arguments` stays empty, which matches that getter's documented contract:
the arguments of the symbol's *own* declared annotation.

## Measurement

Harness: `run_load_benchmark.ts --baseline`, `repository-root`, control = this tree at
`16859a76`, candidate = the same tree carrying the change, same box.

| corpus | nodes | call edges | raw entry points | unresolved |
| --- | --- | --- | --- | --- |
| celery/celery | 7943 = | 9465 -> **9467** | 730 -> **728** | 23834 -> 23832 |
| angular/angular | 71428 = | 158057 -> **158061** | 3096 = | 218696 = |

No call edge is lost and no entry point is gained on either corpus. Six edges are gained and
two entry points fall away, at two sites:

- **celery**, `backends/database/__init__.py:86,89` — `self.task_cls.configure(...)` over the
  class attribute `task_cls = Task`. A chain hop through a member the `TypeRegistry` records
  no type for now falls through to what the member holds, as a base receiver already did, so
  both `Task.configure` and `TaskSet.configure` stop being entry points.
- **angular**, `core/test/acceptance/animation_spec.ts:2405-2414` — `const compRef =
  createComponentFn(AnimatedChild, {...})` reaching
  `createComponent<C>(component: Type<C>, ...): ComponentRef<C>` through a carrier declared
  in another file. STEP 1.5 stopped at the carrier, reading a value's type only where the
  updating file declared it; the value source follows it cross-file and binds `C` to
  `AnimatedChild` from the call's first argument, resolving `.instance`, `.hostView`,
  `.changeDetectorRef` and the chained `.detectChanges()`.

`indirect_reachability_keys` is unchanged on both (celery 2608, angular 12345). One angular
evidence citation for `changeDetectorRef` moves to that newly-resolving site.

**Cost is flat.** Resolve pass: celery 4.8 s -> 4.8 s CPU, angular 31.2 s -> 30.7 s. Whole
load, wall: celery 9.8 s -> 8.2 s, angular 57.9 s -> 56.8 s. Peak RSS is not a signal at this
resolution — two arms of *identical* code read 3126 MB and 3794 MB on angular, a wider spread
than any control/candidate gap.
