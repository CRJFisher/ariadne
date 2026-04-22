---
id: TASK-208
title: >-
  Add accessor-definition flag to FalsePositiveEntry for JS/TS getter/setter
  detection
status: To Do
assignee: []
created_date: '2026-04-22 14:01'
labels:
  - self-repair-pipeline
  - signal-gap
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `property-accessor-not-tracked` group in the webpack corpus covers JavaScript/TypeScript class getters (`get depth()` in lib/Module.js:459) and setters defined with the `get`/`set` keyword, invoked via property access (`m.depth`, `chunk.modulesIterable`). Tree-sitter's `.scm` queries emit `@reference.call` only on call expressions, so these accessors appear unreachable even when real call sites exist (confirmed at test/configCases/deprecations/chunk-and-module/webpack.config.js:24,58-60). This is the JS/TS analog of the existing `py-property-decorator-access` permanent entry (which is detectable via `decorator_matches` on `@property`). The JS form has no decorator — the `get`/`set` keyword is inline with the definition token and is not currently recorded on the entry or reachable via any SignalCheck op. To classify this pattern, extend `FalsePositiveEntry` (and the extractor that populates it) with an `accessor_kind` field — one of `null | "getter" | "setter"` — captured from the tree-sitter getter/setter definition node, and add a corresponding `accessor_kind_eq` SignalCheck op (and/or a predicate-DSL equivalent). Once available, the curator can register a permanent classifier mirroring `py-property-decorator-access` for JS/TS, scoring every getter/setter definition as a framework-level true-positive. Until then this group cannot be auto-classified: the definition line is the only discriminating evidence and no existing signal reads it.
<!-- SECTION:DESCRIPTION:END -->
