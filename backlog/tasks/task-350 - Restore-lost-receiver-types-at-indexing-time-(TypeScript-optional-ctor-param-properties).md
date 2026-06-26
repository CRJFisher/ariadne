---
id: TASK-350
title: "Restore lost receiver types at indexing time (TypeScript optional ctor param-properties)"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
priority: high
plan_dedup_key: dc80bdf53c0f162e1cd0b07335bdaa7b2ac23b0c3b29803f7cf28762fc8fcdeb
plan_source_task: pt-4bab06ce92cb530a
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
