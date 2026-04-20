---
id: TASK-205
title: Trace registry-method calls through Project field access in entry-point detector
status: To Do
assignee: []
created_date: "2026-04-20 12:15"
labels:
  - ariadne-core
  - false-positives
  - call-graph
  - receiver-resolution
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Problem

Ariadne's entry-point detector flags public methods of `Project`-held registries (`project.definitions.X()`, `project.resolutions.X()`, etc.) as unreached entry points when the only callers reach them through a chained receiver like `project.definitions.method(...)`. The resolver fails to connect the edge from the caller function to the registry method even though `Project.definitions` has a declared field type (`public definitions: DefinitionRegistry`) that uniquely identifies the receiver's type.

## Observed false positives (current `main` of `feat/self-healing-pipeline-debug`)

Both whitelisted under `~/.ariadne/self-repair-pipeline/known_entrypoints/core.json` source `ground-truth` as of 2026-04-20:

- `packages/core/src/resolve_references/registries/definition.ts` — `DefinitionRegistry.get_definitions_by_name` — called by `list_name_collisions` at `packages/core/src/introspection/list_name_collisions.ts` via `project.definitions.get_definitions_by_name(name)`.
- `packages/core/src/resolve_references/resolve_references.ts` — `ResolutionRegistry.get_calls_for_file` — called by `explain_call_site` at `packages/core/src/introspection/explain_call_site.ts` via `project.resolutions.get_calls_for_file(file)`.

A third pre-existing example (`DefinitionRegistry.get_class_definitions`) is already whitelisted under `ground-truth`; same receiver-resolution pattern.

## Receiver-resolution shape

All cases follow:

```
<project_instance>.<registry_field>.<method>(args)
                   │                  │
                   │                  └── method call on registry instance
                   └── member access resolving to a public class field
                       with a declared type (DefinitionRegistry,
                       ResolutionRegistry, TypeRegistry, …)
```

The member-access receiver has a statically resolvable type from the class declaration. Today the receiver-resolution pipeline drops the type across the field hop and returns `receiver_type_unknown` (or similar), so no call edge is recorded from the introspection function into the registry method. The registry method then surfaces as an entry point.

## Expected behaviour

When a method call's receiver is a member expression of the form `identifier.field`:

- Resolve `identifier` to its declared type.
- Look up `field` in that type's member list.
- If the field has a declared type that is a class/interface, use that type as the method's receiver type and resolve the method normally.
- Record the call edge from caller → method so the method is not reported as an entry point.

The fix is not specific to `Project`; any `class C { public reg: R = …; }` with callers of the form `c.reg.method()` exhibits the same issue.

## Acceptance criteria

- [ ] Calls of the form `project.definitions.get_definitions_by_name(...)` from `list_name_collisions` are tracked as edges, so `DefinitionRegistry.get_definitions_by_name` is no longer flagged as an entry point.
- [ ] Calls of the form `project.resolutions.get_calls_for_file(...)` from `explain_call_site` are tracked as edges, so `ResolutionRegistry.get_calls_for_file` is no longer flagged as an entry point.
- [ ] The same fix covers the pre-existing `DefinitionRegistry.get_class_definitions` whitelist entry and any other registry methods currently whitelisted under `ground-truth` that follow this shape.
- [ ] Existing entry-point detection still flags genuine unreached exported callables.
- [ ] Once fixed, remove the `get_definitions_by_name`, `get_calls_for_file`, and any newly-redundant entries from `~/.ariadne/self-repair-pipeline/known_entrypoints/core.json` under source `ground-truth`. Verify the Stop hook passes without them.

## Out of scope

- Cross-file re-export chains (F5 — tracked elsewhere).
- Factory-return-type inference (F2 — tracked elsewhere).
- Polymorphic dispatch through interface fields.

## References

- Detection hook: `.claude/hooks/entrypoint_stop.ts`
- Whitelist file: `~/.ariadne/self-repair-pipeline/known_entrypoints/core.json` (source `ground-truth`)
- Related call-resolution code: `packages/core/src/resolve_references/call_resolution/receiver_resolution.*.ts`, `method_lookup.ts`
- Introduced by: TASK-190.16.3 (added the two introspection APIs that exposed this gap)
- Parent-plan context: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` classifies this as an F1-adjacent resolver gap; fixing it shrinks the classifier's auto-whitelist surface.
<!-- SECTION:DESCRIPTION:END -->
