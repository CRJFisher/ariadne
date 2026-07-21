---
id: TASK-364
title: "Resolve cross-cutting findings from the module-hygiene sweep"
status: Done
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - hygiene
  - refactor
  - dead-code
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A 56-iteration module-hygiene sweep across `packages/core/src` (2026-07-11/12,
landed as a series of `test(...)`/`refactor(...)`/`chore(...)` commits on
`feat/self-healing-pipeline-debug`) reviewed every genuinely-stale module for
test coverage, canonical comments, and dead code. Each per-module pass fixed
and committed what fell inside its own module boundary.

This epic collects the findings that could **not** be fixed by a single-module
pass because they span module or package boundaries — a dead method on a shared
interface implemented by four files, a type duplicated across two packages,
identical logic in sibling files, and two behaviour/coverage gaps a hygiene
pass flags but does not silently "fix" by changing product behaviour. Each is
small and independently landable.

Already fixed in-module during the sweep (recorded here for context, **not**
part of this epic): the Rust glob-import drop (`use crate::*` / `super::*` /
`self::*` produced no symbol), the Python relative-star import drop
(`from .pkg import *`), and the logger env-level leak on re-init.

### Sub-tasks

Dead-code / de-duplication (mechanical, low risk):

- **364.1** — Remove three dead `MetadataExtractors` interface methods across
  all four language implementations.
- **364.2** — Consolidate the duplicate `find_root_scope`.
- **364.3** — Drop two redundant identical overrides in
  `JavaScriptTypeScriptScopeBoundaryExtractor`.
- **364.4** — Unify `IndirectReachabilityEntry` (core) with
  `IndirectReachability` (types).
- **364.5** — De-duplicate the three byte-identical decorator handlers in
  `capture_handlers.typescript.ts`.

Correctness / coverage gaps (behaviour change — needs a decision + regression
tests):

- **364.6** — Fix two Rust import-form gaps (`super::super::` two-level climb;
  `self` as a group member).
- **364.7** — Decide and (if in scope) implement indexing of property-assignment
  CommonJS exports (`exports.foo =` / `module.exports.foo =`).

Investigation:

- **364.8** — Diagnose the `Duplicate export name create_py_class_id` warning
  Ariadne's own indexer emits against `symbol_factories/index.ts`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] All eight sub-tasks resolved (or explicitly deferred with a recorded
      reason for 364.7 if ruled out of scope).
- [ ] No compatibility shims, adapters, aliases, or transitional re-exports left
      behind by any sub-task; callers updated to the surviving pattern.
- [ ] Full `packages/core` test suite green after each sub-task lands.

<!-- AC:END -->
