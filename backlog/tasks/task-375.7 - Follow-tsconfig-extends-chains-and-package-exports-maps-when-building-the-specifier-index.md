---
id: TASK-375.7
title: "Follow tsconfig extends chains and package exports maps when building the specifier index"
status: Done
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

- [x] #1 `ModuleSpecifierIndex` construction follows `tsconfig.json`/`jsconfig.json` `extends` chains to a fixed point, accepting the single-string and TypeScript 5 array forms, with a cycle guard that terminates.
- [x] #2 `paths` and `baseUrl` are resolved relative to the config that declares them, pinned by a test with a base config two directories above the leaf.
- [x] #3 A workspace package's `exports` field is honoured — root and subpath forms — in a documented condition precedence order, with `index.*` probing retained as the no-`exports` fallback.
- [x] #4 An `exports` target that would escape its package directory is rejected.
- [x] #5 A specifier matching no on-disk target still resolves opaquely and fabricates no edge.
- [ ] #6 Changes are confined to `module_specifier_index.ts`; no signature introduced by TASK-375.4 changes.
      <!-- partial: The index construction is confined to `module_specifier_index.ts`, but the consumer's remainder arithmetic in `import_resolution.typescript.ts` was rewritten to accept a file-valued entry — see deviation 3. -->
- [x] #7 The `import_resolution/*.test.ts` suites and `import_graph.test.ts` stay green.

<!-- AC:END -->

## Implementation Notes

### What a user gets

The two TypeScript monorepo layouts that resolved to nothing now resolve, so calls through them
stop making their callees look uncalled.

- **A per-package `tsconfig.json` that declares no `paths` of its own** inherits them through
  `extends`, from a base config any number of directories up. Aliases are rooted at the config that
  *declares* them, so a base two directories above the leaf points at its own `baseUrl`, not the
  leaf's.
- **A workspace package whose entry point is declared in `exports`** resolves — the `"."` form, the
  condition-only sugar form (`{"import": "./src/index.ts"}` with no `.`-prefixed key, which is what
  most modern packages ship), and published subpaths like `@scope/pkg/testing`.

A specifier that matches nothing on disk is still returned opaquely, and an `exports` target that
would escape its package directory is refused.

### The approach

`extends` is followed before a config's own `paths` are read, so the extending config overrides what
it inherits, and each config's `paths`/`baseUrl` resolve against its own directory. Only
path-relative bases are followed: a bare specifier names a published config package, which is not
part of the analysed source.

An `exports` entry is a set of alternatives, so condition selection offers every candidate in a
stated precedence — `source`, `import`, `module`, `require`, `default`, `types` — and takes the
first that is both inside the package directory and present in the tree. `types` ranks last: a
`.d.ts` carries declarations and no bodies, so it yields no call edge on its own, but a package
that publishes nothing else still points somewhere in the project rather than staying opaque. Requiring presence is what
keeps a manifest that only publishes a built artefact from pointing the specifier at a file that is
not there; the package directory stays and `index.*` probing serves, exactly as before.

### How to navigate the result

Everything is in `resolve_references/import_resolution/module_specifier_index.ts`:
`read_config_aliases` owns inheritance, `declared_aliases` owns one config's own entries,
`base_config_files` owns which `extends` entries are followed, and `published_target` owns the
`exports` decision including both guards. `.claude/rules/resolve-references.md` now lists the file in
the module layout with a one-line statement of what it answers. The consumer — longest-prefix
matching plus probing — is `import_resolution.typescript.ts`.

### What review found

- **Sibling `extends` entries shared a cycle guard.** With `extends: ["./a.json", "./b.json"]` where
  both extend one base, `b.json`'s branch returned nothing because the base was already marked
  visited, so the leaf resolved to `a.json`'s alias where TypeScript gives the later entry
  precedence. The guard is now copied per branch and a separate shared cache keeps the common base
  from being parsed twice — the same split `registries/export.ts` already makes for re-export
  chains.
- **Condition selection committed before checking presence.** A manifest naming a `.d.ts` or a build
  it does not ship above a source target it does declare discarded the whole entry. Every candidate
  is now offered to the presence check in precedence order.
- **The condition-only `exports` form was never read**, so the most common modern shape fell back to
  the package directory.
- **Repointing a package name at a file broke deep imports.** `@scope/pkg/util` was joined onto
  `pkg/src/index.ts`, producing `pkg/src/index.ts/util`. A remainder now joins onto the target's
  directory, which is what a `src`-layout package means and is identical to the old behaviour for a
  root-layout one.

### Deviations from the work plan, and why

1. **Wildcard `exports` subpaths are not read.** The work plan and the Tests section name only the
   literal subpath form (`"./testing"`). A single-`*` pattern map is a separate shape and would be a
   separate change.
2. **`published_target` requires the target to be present in the tree.** Not asked for. Without it a
   manifest that publishes only `./dist/index.js` moves the specifier off the package directory onto
   a file the corpus never indexes, losing the `index.*` probe AC #3 explicitly requires be retained.
3. **The consumer's remainder arithmetic was rewritten.** AC #6 asks for the work to be confined to
   `module_specifier_index.ts`, and the extends/exports logic is. But an index entry can now be a
   file rather than a directory, and `import_resolution.typescript.ts` had to learn that: an
   entry-file probe, a dirname-derived join base and a separate no-remainder branch, about a dozen
   net lines. Without it this task's own change loses deep-import edges. No signature changed.
4. **`extended_config_files` is named `base_config_files`**, matching the vocabulary its caller and
   its tests already use.

### Known gaps, owned elsewhere

