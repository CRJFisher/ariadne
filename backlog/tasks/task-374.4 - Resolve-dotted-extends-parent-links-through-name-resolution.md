---
id: TASK-374.4
title: "Resolve dotted extends parent links through name resolution"
status: To Do
assignee: []
created_date: "2026-08-11 07:45"
labels:
  - name_resolution
dependencies: []
parent_task_id: TASK-374
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

`resolve_references/registries/type.ts` resolves a class's parent link via
`resolutions.resolve(scope_id, parent_name)` on the flat `extends` name. For a
dotted base — `class PGDDLCompiler(compiler.DDLCompiler)` — `extract_extends`
(`index_single_file/query_code_tree/symbol_factories/symbol_factories.python.ts`)
records the flat string `"compiler.DDLCompiler"`, which no scope map can ever
hold, so the parent link never resolves. The class and its methods index
correctly (the Python class capture is shape-complete over its bases); only the
inheritance edge is missing.

## Consumer

The sqlalchemy `super()` triage rows on `PGDDLCompiler` close only once this
lands: `super().visit_create_sequence(c)` inside a dotted-base subclass needs
the parent link to resolve the base method. The bare-base form of the same
`super()` edge is pinned green by
`resolve_references.python.test.ts` ("puts every method of a class with a
dotted base in the call graph and resolves super() through the bare base");
the dotted-base twin assertion belongs to this task.

## Work plan

1. In the parent-link resolution, split a dotted `extends` name and resolve the
   base identifier through name resolution, then the attribute through the
   imported module's exports (the machinery namespace-qualified constructor
   calls already use).
2. Assert the `class PG(mod.Base)` `super().visit_create_sequence(c)` edge in
   `resolve_references.python.test.ts`, mirroring the bare-base test.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `class PG(mod.Base)` resolves its parent link to the `Base` class exported by `mod`.
- [ ] #2 The dotted-base `super().visit_create_sequence(c)` edge resolves to the base method, asserted in `resolve_references.python.test.ts`.

<!-- AC:END -->
