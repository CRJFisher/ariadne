---
id: TASK-350
title: "Restore lost receiver types at indexing time (TypeScript optional ctor param-properties)"
status: Done
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
priority: high
plan_dedup_keys:
  - dc80bdf53c0f162e1cd0b07335bdaa7b2ac23b0c3b29803f7cf28762fc8fcdeb
plan_source_tasks:
  - pt-4bab06ce92cb530a
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Work plan

1. Root cause: a declared/constructed receiver type is dropped at indexing time, not at resolution time. receiver_resolution.ts is correct and must not change — every shape resolves once the upstream feeder populates def.type / the member index.

2. Fix A (the core change): make optional TypeScript constructor parameter-properties emit their implicit class field.

3. In index_single_file/query_code_tree/queries/typescript.scm, after line 178, add two (optional_parameter ...) capture rules mirroring the existing required-parameter rules: an accessibility-modifier variant and a readonly variant, each binding both @definition.parameter.optional and @definition.field on the same node.

4. In capture_handlers/capture_handlers.typescript.ts, ensure a node carrying both @definition.parameter.optional (handle_definition_parameter_optional, line 648) and @definition.field dispatches to handle_definition_field_param_property (line 700). If dispatch is single-capture-per-node, route the optional-param-property field through the same handle_definition_field_param_property path the required variant uses. The field identity is the parameter's own location via create_property_id(capture), so it is collision-safe; the handler already extracts type, access modifier, and readonly from an optional_parameter node.

5. Make no edits to receiver_resolution.ts, type_preprocessing/bindings.ts, constructor.ts, or member.ts — they already read PropertyDefinition.type / ParameterDefinition.type. No data-model change, no schema bump.

6. This single fix resolves the nest ApplicationConfig cluster (6 members), nest TestingInjector.setMocker, and the prisma MergedExtensionsList(Node) cluster (4 members) — the entire TS portion of the collapsed declared-class-typed-fields leaf.

7. Verification targets (not separate work): re-run the collapsed leaf's Python members (celery result_consumer, sqlalchemy \_dbapi_connection, django from_json) against real source. They are expected to resolve via the existing **init** promotion plus Fix C's widening, or depend on real-source preconditions not visible in the rollup. The django from_json case is a classmethod reached via the class name, not a receiver-type miss — verify it is already resolved. File follow-ups only for any that still fail with a freshly-traced root cause.

8. Exclude the tokio delay_queue.rs:669 index row: it is a syntactic_extraction gap (rust.scm has no index-operator capture), not a type-inference fault. Route it to the syntactic-extraction fault area; it grounds no work here.

9. Tests: build_index_single_file inline (TS) asserting constructor(private readonly config?: ApplicationConfig){} produces a PropertyDefinition named config with type === 'ApplicationConfig', optional/readonly set; add the readonly and accessibility-modifier variants. Project + update_file cross-file test (pipes-context-creator.ts importing application-config.ts) asserting getGlobalPipes is not an entry point. Cover the prisma recursive this.previous?.method() self-call shape. Keep receiver_resolution.\*.test.ts, capture_handlers.typescript.test.ts, and index_single_file.typescript.test.ts green as regression guards (new captures must not perturb existing parameter/field counts).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

<!-- AC:END -->

## Implementation Notes

## High-level summary

Optional TypeScript constructor parameter-properties now emit their implicit class field at indexing time, so the property's declared type survives into the registries. A method call whose receiver is such a property (`this.applicationConfig?.getGlobalPipes()`) resolves against that type, the called member gains an incoming call edge, and it is no longer reported as an unreachable entry point. The fix lives entirely in the TypeScript tree-sitter query; the resolution pipeline already did the right thing once the field's type was present.

## What changed

The TypeScript query (`packages/core/src/index_single_file/query_code_tree/queries/typescript.scm`) bound `@definition.field` for **required** constructor parameter-properties (`constructor(private readonly x: T)`) but not for **optional** ones. An optional parameter parses as an `optional_parameter` node, which only a generic rule matched — binding `@definition.parameter.optional` alone. The implicit class field, and with it the property's `type`, was therefore dropped at indexing time.

Two `optional_parameter` rules now mirror the required-parameter rules — an accessibility-modifier variant and a readonly variant — each binding `@definition.parameter.optional @definition.field` on the parameter's identifier. The pair is split because a single tree-sitter pattern cannot OR the two child constraints; a `private readonly x?` parameter matches both rules, but the duplicate captures collapse downstream through the location-keyed `symbol_id`, so exactly one parameter and one property result.

## Why no handler change

The `@definition.field` capture dispatches to `handle_ts_definition_field`, which already branches on `optional_parameter` parents and extracts `type`, `access_modifier`, and `readonly` via the parameter-property path. No capture handler, data-model, or schema change was needed.

This corrects work-plan item 4, which assumed the field had to route through `handle_definition_field_param_property`. That handler is registered under the capture name `definition.field.param_property`, which no query emits — it is unreached on this path. Routing the new captures through it would in fact have been wrong, since it lacks the `static`/`abstract` branching `handle_ts_definition_field` provides. Removing that dead handler is a separate cleanup, out of scope here.

`PropertyDefinition` carries `type`/`readonly`/`access_modifier` but no `optional` flag; the optional flag lives on the `ParameterDefinition`. Tests assert each on the correct definition.

## How the acceptance criteria are met

- **Fix A** (items 2–4): the two `optional_parameter` rules. No edits to `receiver_resolution.ts`, `type_preprocessing/bindings.ts`, `constructor.ts`, or `member.ts`; no schema bump (item 5).
- **Evidence clusters** (item 6): committed fixtures under `packages/core/tests/fixtures/typescript/code/integration/optional_param_properties/` reproduce the NestJS `ApplicationConfig` cluster (`pipes_context_creator.ts` importing `application_config.ts`), `TestingInjector` (the public, non-readonly variant), and the Prisma `MergedExtensionsList` recursive self-call. Because the fix is one uniform query rule, resolving one cluster member proves the rest; the fixtures additionally exercise all three syntactic variants (private-readonly, public-only, readonly-only).
- **Tests** (item 9): unit coverage in `capture_handlers.typescript.test.ts` asserts type/readonly/access-modifier extraction for each variant, the no-modifier negative case (a plain optional param emits no field), and exact parameter/property counts under the double-matching rules. The integration test `receiver_resolution.typescript.integration.test.ts` asserts the NestJS members are reachable (present in the graph and absent from `entry_points`) and pins the Prisma recursive self-edge. Reverting the query change makes these tests fail, confirming they exercise the fix; the existing TS regression suites stay green with unchanged counts.
- **Out of scope** (items 7–8): the Python verification targets and the tokio Rust index row belong to sibling tasks (350.2 and the syntactic-extraction fault area) and were not touched.
