---
id: TASK-344
title: >-
  Ship @ariadnejs/core with prebuilt tree-sitter native binaries
  (cross-Node-version install with no source compile)
status: To Do
assignee: []
created_date: "2026-05-25"
labels:
  - dependencies
  - tree-sitter
  - infrastructure
  - blocked-upstream
dependencies: []
references:
  - packages/core/package.json
  - https://github.com/tree-sitter/node-tree-sitter/issues/276
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Consumers of `@ariadnejs/core` currently must compile `tree-sitter` from source on install. The native build also fails outright on Node 24+ (V8 headers require C++20, but tree-sitter's `binding.gyp` still targets C++17). This breaks `npm install @ariadnejs/core` for users on Node 24+ with a standard toolchain, and forces every Node 18–22 user to pay a multi-minute install-time compile.

**Goal:** restore the property that `@ariadnejs/core` installs cleanly across all currently-supported Node versions (18, 20, 22, 24+) on darwin/linux/win × x64/arm64 without requiring a C++ toolchain on the consumer's machine.

### Why this regressed

Two-step regression:

1. **Custom prebuild distribution removed** during the monorepo restructure (commits `f37cf4b3`, `4eaa9929`). The previous solution from TASK-15.1 (`scripts/postinstall.js` downloading prebuilts from Ariadne's own GitHub Releases + `.github/workflows/prebuild.yml`) was deleted and not replaced.
2. **Upstream `tree-sitter@0.25.0` ships no prebuilds** (TASK-197 bumped from 0.21.x → 0.25.0). The package's `package.json` declares `"prebuilds/*"` in `files`, but the published tarball is missing the directory entirely. NAPI-based prebuilds (ABI-stable across Node versions) would otherwise make a single binary work for Node 18–24+.

### Upstream root cause (verified)

`maxbrunsfeld` published `tree-sitter@0.25.0` manually from a local checkout that hadn't run `prebuildify`, beating CI which would have aggregated platform prebuilds from `actions/upload-artifact`. `npm pack` silently drops `files` globs that match zero files, so the tarball shipped without prebuilds. CI's subsequent publish then failed with `E403 You cannot publish over the previously published versions: 0.25.0`. The broken tarball is now permanently frozen on npm.

A `v0.25.1` git tag exists (commit `75a0eccf`, 2026-01-10) but cannot be published: the repo migrated to OIDC Trusted Publishing in PR `f8805e7`, and no npm package admin has configured the corresponding Trusted Publisher entry on npmjs.com. Three publish attempts have failed; last admin activity on the tracking issue was April 2026.

### Why we are not downgrading `tree-sitter`

Downgrading to `0.22.4` (last version with working prebuilds) would require code changes in `packages/core` to accommodate API differences in the 0.22 → 0.25 range. The Final Summary of TASK-197 documents the breaking changes that were absorbed during the upgrade; reverting them is out of scope for this task. Stay on `tree-sitter@0.25.0` and fix distribution instead.

### Blocked by

[tree-sitter/node-tree-sitter#276 — Publish of 0.25.1 to npm failed](https://github.com/tree-sitter/node-tree-sitter/issues/276)

When `tree-sitter@0.25.1` (or later) is published to npm with prebuilds intact, this task unblocks immediately — bump the version, verify the tarball contains `prebuilds/`, ship.

### Workstreams while blocked

1. **Watch** issue #276 for upstream resolution.
2. **Validation harness** (not blocked): add a release-time check that fails if any native dep in the install tree is missing prebuilds for the platforms we claim to support. Catches future regressions in any native dep, not just tree-sitter.
3. **Decision: contingency path** if upstream stays stuck — consider resurrecting a TASK-15.1-style custom prebuild distribution (postinstall script downloading from Ariadne's GH Releases) so we control the binary supply for tree-sitter specifically. Higher maintenance cost; worth it only if upstream silence continues.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `npm install @ariadnejs/core` on Node 18, 20, 22, and 24 (darwin-x64, darwin-arm64, linux-x64) completes without invoking node-gyp / a C++ compiler
- [ ] #2 The installed `node_modules/tree-sitter/prebuilds/<plat>-<arch>/` directory contains a `.node` binary for the host platform
- [ ] #3 Release-time CI check fails if any native dep in `@ariadnejs/core`'s install tree is missing prebuilds for our supported platforms
- [ ] #4 README / install docs no longer recommend `node-gyp` as a dev dependency
<!-- AC:END -->

## References

- TASK-197 (completed): the upgrade that introduced the regression
- TASK-15.1 (archived): the original prebuild distribution implementation that was removed during monorepo restructure
- Commits `f37cf4b3`, `4eaa9929`: monorepo restructure that deleted `scripts/postinstall.js`, `.github/workflows/prebuild.yml`, `docs/prebuild-binaries.md`
- Upstream incident chain: [#248](https://github.com/tree-sitter/node-tree-sitter/issues/248), [#256](https://github.com/tree-sitter/node-tree-sitter/issues/256), [#268](https://github.com/tree-sitter/node-tree-sitter/issues/268), [#276](https://github.com/tree-sitter/node-tree-sitter/issues/276)
