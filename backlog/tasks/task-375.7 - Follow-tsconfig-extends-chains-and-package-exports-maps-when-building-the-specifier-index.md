---
id: TASK-375.7
title: "Follow tsconfig extends chains and package exports maps when building the specifier index"
status: To Do
assignee: []
created_date: "2026-07-30 14:10"
labels:
  - import_resolution
  - typescript
  - comparative-analysis
dependencies:
  - TASK-375.4
parent_task_id: TASK-375
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

TASK-375.4 lands bare-specifier resolution for projects that declare their aliases directly. Two shapes it explicitly leaves unhandled account for most real TypeScript monorepos, and in both the user sees the same failure: every call through the aliased or workspace-internal import stays unresolved, so callees look uncalled and can be reported as entry points.

1. **A `tsconfig.json` that declares no `paths` of its own** and inherits them through `extends` from a base config — the standard layout for a repo with one shared base and per-package configs. `package_roots` comes back empty for that package and every alias resolves opaquely.
2. **A workspace package whose entry point is declared in `exports`** rather than at `index.ts`. The 375.4 probe lands a directory's `index.ts` and nothing else, so a package pointing at `./src/index.ts`, or exposing subpaths like `@scope/pkg/testing`, resolves to nothing.

## Why this is a follow-on and not part of 375.4

375.4 is the seam change — it introduces `ModuleSpecifierIndex`, threads `ModuleResolutionContext` through 33 signatures, and proves the mechanism on direct `paths` declarations and Rust crate roots. This task adds two source-shapes to the _index construction_ only, behind that finished seam. Nothing outside `module_specifier_index.ts` changes. Landing them together would mix a wide signature refactor with manifest-format work and make the seam change harder to review.

## Work plan

1. **Resolve `extends` before reading `compilerOptions.paths`.** Follow the chain to a fixed point with a cycle guard, accepting both the single-string form and the TypeScript 5 array form (later entries win). `paths` and `baseUrl` are resolved relative to the config that _declares_ them, not the leaf — getting that wrong silently mis-roots every alias, so it needs a direct test.
2. **Read `exports` when a workspace package resolves to a directory.** Honour the condition map in a stated precedence order and the subpath form (`"./testing"`), keeping 375.4's `index.*` probe as the fallback when no `exports` field exists. Guard path containment so an `exports` target cannot escape its package directory.
3. **Keep the parse tolerant.** 375.4 already requires JSONC tolerance for trailing commas; the same reader serves the base configs reached through `extends`.
4. **Leave genuinely external packages opaque.** A specifier that resolves to nothing on disk must still fabricate no edge — the invariant 375.4 pins at its AC #6 holds unchanged.

`graphify/extractors/resolution.py:89-168` (extends chains, JSONC, TS-5 array form, exact-then-longest-prefix specificity) and `:378-503` (workspace `exports` condition maps with a path-containment guard against `../../../etc/passwd`) are a working reference for both shapes, including the edge cases this task would otherwise rediscover one bug report at a time.

## Tests

- A per-package `tsconfig.json` with no `paths` of its own, inheriting from a base one and two directories up: an aliased import resolves, and the alias target is rooted at the declaring config.
- The TS-5 array `extends` form, where a later entry overrides an earlier one's alias.
- An `extends` cycle terminates rather than hanging.
- A workspace package whose `exports` points at `./src/index.ts` resolves; a subpath export (`@scope/pkg/testing`) resolves; a package with no `exports` still resolves through 375.4's `index.*` probe.
- An `exports` target attempting to escape the package directory is rejected.
- A genuinely external specifier still returns opaquely and fabricates no edge.

## Provenance

Identified by comparing Ariadne against Graphify (`~/workspace/tools/graphify`), which implements both shapes. Scoped as a follow-on to the gap 375.4 states explicitly.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `ModuleSpecifierIndex` construction follows `tsconfig.json`/`jsconfig.json` `extends` chains to a fixed point, accepting the single-string and TypeScript 5 array forms, with a cycle guard that terminates.
- [ ] #2 `paths` and `baseUrl` are resolved relative to the config that declares them, pinned by a test with a base config two directories above the leaf.
- [ ] #3 A workspace package's `exports` field is honoured — root and subpath forms — in a documented condition precedence order, with `index.*` probing retained as the no-`exports` fallback.
- [ ] #4 An `exports` target that would escape its package directory is rejected.
- [ ] #5 A specifier matching no on-disk target still resolves opaquely and fabricates no edge.
- [ ] #6 Changes are confined to `module_specifier_index.ts`; no signature introduced by TASK-375.4 changes.
- [ ] #7 The `import_resolution/*.test.ts` suites and `import_graph.test.ts` stay green.

<!-- AC:END -->
