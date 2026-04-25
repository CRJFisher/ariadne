---
id: TASK-190.16.15
title: >-
  Add accessor-definition flag to FalsePositiveEntry for JS/TS getter/setter
  detection
status: Done
assignee: []
created_date: '2026-04-22 14:01'
labels:
  - self-repair-pipeline
  - signal-gap
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `property-accessor-not-tracked` group in the webpack corpus covers JavaScript/TypeScript class getters (`get depth()` in lib/Module.js:459) and setters defined with the `get`/`set` keyword, invoked via property access (`m.depth`, `chunk.modulesIterable`). Tree-sitter's `.scm` queries emit `@reference.call` only on call expressions, so these accessors appear unreachable even when real call sites exist (confirmed at test/configCases/deprecations/chunk-and-module/webpack.config.js:24,58-60). This is the JS/TS analog of the existing `py-property-decorator-access` permanent entry (which is detectable via `decorator_matches` on `@property`). The JS form has no decorator — the `get`/`set` keyword is inline with the definition token and is not currently recorded on the entry or reachable via any SignalCheck op. To classify this pattern, extend `FalsePositiveEntry` (and the extractor that populates it) with an `accessor_kind` field — one of `null | "getter" | "setter"` — captured from the tree-sitter getter/setter definition node, and add a corresponding `accessor_kind_eq` SignalCheck op (and/or a predicate-DSL equivalent). Once available, the curator can register a permanent classifier mirroring `py-property-decorator-access` for JS/TS, scoring every getter/setter definition as a framework-level true-positive. Until then this group cannot be auto-classified: the definition line is the only discriminating evidence and no existing signal reads it.

## Implementation notes

- `accessor_kind: "getter" | "setter" | null` lives on `DefinitionFeatures` (not `SyntacticFeatures`). Derivation reads the definition source line via a small regex (`classify_accessor_line`) — a heuristic adopted because core does not expose getter/setter on `MethodDefinition`. Limits: computed-key, string-key, and decorated accessors on the same line are not recognised.
- New `accessor_kind_eq` op carries a `"getter" | "setter" | "none"` enum. The `"none"` sentinel maps to `accessor_kind === null` consistently in the renderer and the evaluator.

## Reviewer follow-ups (applied)

- `classify_accessor_line` is now exported and directly tested (getter, setter, modifier permutations, false-positives on identifier prefix, plain functions, object-literal property assignments).
- `derive_definition_features` direct tests cover the getter/setter accessor-capture path.
<!-- SECTION:DESCRIPTION:END -->
