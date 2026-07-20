---
id: TASK-363
title: 'Native tree-sitter singleton: survive jest module-registry resets'
status: Done
assignee: []
created_date: '2026-07-10 14:11'
updated_date: '2026-07-20 23:11'
labels:
  - native
  - tree-sitter
  - test-infra
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Any jest consumer that runs two Ariadne-backed test files in the same worker process gets a silently broken second run: jest gives each test file a fresh module registry, so tree-sitter/index.js is re-evaluated while the native addon stays process-global and initialized against the first evaluation's class identities. Marshalling then throws `TypeError: Cannot read properties of undefined (reading 'tree')` at marshalNode inside Query.captures for every parse. Reproduced deterministically in code-charter (`npx jest ariadne_adapter hydrate --runInBand` in packages/drift — the second suite's Project indexes nothing); the tree-sitter wrapper itself carries a "Jest worker pool race condition" comment with `configurable: true` patches as a band-aid, so upstream acknowledges but does not fix it.

Fix at the loader: route every RUNTIME import of `tree-sitter` and the grammar packages through one process-global cache so a re-evaluated registry reuses the first evaluation's JS objects instead of re-running the wrapper:

```ts
// packages/core/src/native.ts
const cache = ((globalThis as any).__ariadne_native ??= {});
export const TreeSitter = (cache.tree_sitter ??= require("tree-sitter"));
export const TypeScriptParser =
  (cache.ts ??= require("tree-sitter-typescript"));
// … javascript, python, rust likewise
```

Because `??=` never re-runs the require in a second registry, tree-sitter/index.js is evaluated exactly once per process and all Tree/Query/marshal-buffer identities stay consistent with the native binding. Only the ~5 files with runtime imports switch to the loader — packages/core/src/project/project.ts (Parser + 4 grammars), src/index_single_file/query_code_tree/query_loader.ts (Query + 4 grammars; also cache its compiled Query objects in the same place, they hold native language references), src/index_single_file/query_code_tree/query_code_tree.ts (Query), and the typescript/rust scope-boundary extractors. The ~25 `import type { SyntaxNode … }` sites are erased at compile time and stay as they are. Fixes every consumer's jest runs (and Ariadne's own suite if affected) with zero consumer-side config.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A process-global loader module owns every runtime require of tree-sitter and the grammar packages; no other module requires them directly (grep-enforceable)
- [x] #2 Compiled Query objects in query_loader are cached in the same process-global store
- [ ] #3 A regression test proves two jest module registries in one process both parse successfully (e.g. jest.resetModules / isolateModules re-import of Project indexing a fixture file twice)
- [ ] #4 code-charter's packages/drift suite passes with parallel workers: npx jest ariadne_adapter hydrate reconcile_membership reconcile_delta --runInBand goes green against the released version
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

Any jest consumer that runs two Ariadne-backed test files in one worker process gets a silently broken second run. Jest gives each test file a fresh module registry, so `tree-sitter/index.js` is re-evaluated while the native addon stays process-global and initialized against the first evaluation's class identities. Marshalling then throws `TypeError: Cannot read properties of undefined (reading 'tree')` inside `Query.captures` for every parse — the second suite indexes nothing.

The fix lives at the loader. `packages/core/src/native.ts` owns every runtime require of `tree-sitter` and the four grammar packages, caching each on `globalThis` behind `??=`. Because `??=` never re-runs the require in a second registry, the wrapper is evaluated exactly once per process and every Tree/Query/marshal-buffer identity stays consistent with the binding. Consumers need zero configuration; the fix is entirely internal to `@ariadnejs/core`.

At altitude: the five runtime import sites (`parsers.ts` grammars, `project/parse_file.ts` Parser, `query_code_tree.ts` and `query_loader.ts` Query, and the `symbol_factories/test_utils.ts` helper) now import their values from the loader; three sites that used a value import purely for a type switched to `import type`. The compiled-`Query` cache moved out of `query_code_tree.ts` into the same process-global store, since compiled queries hold native language references tied to that one evaluation. An eslint `no-restricted-imports` rule (with `allowTypeImports`) enforces the funnel across `packages/core/{src,scripts}`, exempting the loader and test files.

To navigate: start at `native.ts` — it carries the rationale and re-exports the packages under their own class names (`Parser`, `Query`, grammars). Runtime values come from the loader; types come straight from `tree-sitter` via `import type`. The enforcement is the eslint block in `eslint.config.js`; `native.test.ts` locks the identity-ownership invariant.

Acceptance criteria: AC#1 (loader owns every runtime require, grep-enforceable) and AC#2 (compiled queries in the process-global store) are satisfied and verified — `native.ts` is the sole `require("tree-sitter*")` in non-test source and scripts. AC#3 asks for a two-registry regression test; a faithful jest-style reset is not reachable in Ariadne's own vitest (`vi.resetModules()` does not clear Node's CJS require cache that backs the addon, and dynamic `import()` is eslint-banned), so `native.test.ts` locks the enabling invariant instead — it fails the moment the global cache is removed — and asserts the exact captures across two parses through the marshalling path. AC#4 is the real cross-registry proof: code-charter's `packages/drift` jest suite against the released package. It is a post-release verification gate and stays open until a release carries this loader.
<!-- SECTION:NOTES:END -->
