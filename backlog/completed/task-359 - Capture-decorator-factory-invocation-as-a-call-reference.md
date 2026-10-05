---
id: TASK-359
title: Capture decorator-factory invocation as a call reference
status: Done
assignee: []
created_date: "2026-06-30 00:00"
labels:
  - bug
  - indexer
  - typescript
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/queries/typescript.scm
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A decorator factory call — `@Decorator(args)` — invokes the factory function, but the
decorator query in `typescript.scm` (around lines 197–224) captures the name only as
`@decorator.class`, never as `@reference.call`. So a factory function referenced only
through a decorator has no inbound edge and looks unreachable.

Surfaced by TASK-190.30.1's registry audit, which removed the `ts-decorator-factory-call`
suppressor classifier as a fixable capture gap. Sibling of TASK-351 / TASK-358 — a
distinct reference-capture form in the same `.scm` file.

### Origin (deleted classifier row this tracks)

`ts-decorator-factory-call` (predicate; observed_count 0, but the gap is provable in
`typescript.scm` independent of a triage hit).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] A `@Decorator(args)` decorator-factory call emits a `@reference.call` resolving to
      the factory function.
- [x] A factory invoked only as a decorator is no longer an unreachable entry point.
- [x] Regression test covers a decorator-factory-only invocation.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

The capture the description calls for already exists. A decorator-factory call
`@Decorator(args)` is a `call_expression` whose `function:` child is an `identifier`,
so the general call-reference rule in `typescript.scm` —
`(call_expression function: (identifier) @reference.call)` — already matches the
factory invocation. The `@decorator.class` / `@decorator.method` / `@decorator.property`
rules capture the decorator target additively at the same node; they never replace the
`@reference.call`. The decorated factory therefore resolves as a `function_call` and is
held out of the unreachable entry-point set. No `typescript.scm` or production change is
warranted: adding a decorator-specific `@reference.call` would double-capture the same
identifier node.

The work delivered is the missing regression coverage (AC3), which pins the behaviour the
first two criteria describe so a future query change cannot silently regress it.

### What the pipeline already does

For a local (non-exported) factory used only as a decorator:

- **AC1** — the inner `call_expression` yields one `function_call` reference on the factory
  name that resolves to the factory definition. Verified for class (`@Route('/x')`),
  method (`@Cache()`), and property (`@Column('name')`) decorator factories.
- **AC2** — the factory is absent from `call_graph.entry_points`. Reachability is carried by
  `function_reference` indirect reachability read at the decorator site (the factory is not
  enclosed by any callable, so it forms no `enclosed_calls` edge), plus the resolved
  module/class-scope `CallReference`. Either way the factory is not a false-positive entry
  point.
- The identifier co-fires as both `@reference.call` and the catch-all
  `(identifier) @reference.variable`, exactly as every ordinary call site does — this is
  generic call-site behaviour, not a decorator-specific double count.

Namespaced decorator factories (`@ns.Deco()`) are `member_expression` calls and fall
outside the identifier rule; they are outside these acceptance criteria (identifier form
only).

### Regression coverage

`packages/core/src/project/project.typescript.integration.test.ts` gains a
"Decorator Factory Invocation - Entry Point Detection (Task 359)" block with a class-
decorator-factory case and a method-decorator-factory case. Each asserts:

1. a `function_call` reference on the factory name resolves to the local factory
   definition (AC1); and
2. under `get_call_graph({ include_tests: true })`, the decorated factory is not an entry
   point while a never-called `unused_control` sibling is. The control is required because
   the integration fixture path lives under `tests/`, so every node is `is_test` and the
   default `entry_points` excludes them all — the control proves entry-point detection is
   live, so the factory's absence reflects the decorator reference rather than test
   suppression. Removing the decorator makes the factory surface as an entry point,
   confirming the assertion bites.

### Origin note

The `ts-decorator-factory-call` suppressor classifier removed by TASK-190.30.1's audit is
already absent from the registry, and no decorator-factory false positive occurs without
it — consistent with the capture having been in place. The "provable gap" in the original
description was a misreading of the `.scm`: it overlooked that the general call-reference
rule matches the decorator's inner call independently of the `@decorator.*` rules.

<!-- SECTION:NOTES:END -->
