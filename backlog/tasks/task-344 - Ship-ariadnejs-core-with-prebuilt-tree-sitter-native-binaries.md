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
dependencies: []
references:
  - packages/core/package.json
  - package.json
  - .github/workflows/test.yml
  - .claude/hooks/verify_toolchain.mjs
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`@ariadnejs/core` pins `tree-sitter@0.25.0`, which ships no prebuilt binaries. Every install compiles the native parser from source, so consumers need a C++ toolchain and pay a multi-minute build. On Node 23 and above that build fails outright: `binding.gyp` at that version hardcodes `-std=c++17` while Node 23+ headers use C++20 `requires` clauses. Ariadne therefore cannot be installed on the current LTS Node at all.

**Goal:** `@ariadnejs/core` installs on every supported Node version and platform without a C++ toolchain on the consumer's machine.

`tree-sitter@0.25.1` resolves both halves and is available on npm. It carries `prebuildify --napi` binaries and derives the C++ standard from the target Node version rather than hardcoding it. The binaries are N-API, so one file serves every Node version.

### Upstream state

Verified against the registry and by installing into a scratch tree:

- `dist-tags.latest` is `0.25.1`, published 2026-07-28. Nothing newer exists; no version is deprecated or unpublished.
- The tarball contains `prebuilds/<plat>-<arch>/tree-sitter.node` for all six targets: `darwin-x64`, `darwin-arm64`, `linux-x64`, `linux-arm64`, `win32-x64`, `win32-arm64`.
- The same prebuilt binary loads under Node 22.23.2 (ABI 127) and Node 24.19.0 (ABI 137).
- The pinned grammars — `tree-sitter-javascript@0.25.0`, `tree-sitter-python@0.25.0`, `tree-sitter-rust@0.24.0`, `tree-sitter-typescript@0.23.2` — all parse against `0.25.1` on Node 24 with nothing compiled anywhere in the install tree. The grammar pins need no change.

### What the bump unlocks

The `tree-sitter` version is the single constraint holding the repo to the Node 22 line. Bumping it makes the following changes available, and they belong to this task:

1. **Node 24 as a supported runtime.** `engines.node` declares `>=22.13.0 <23.0.0`. The upper bound exists only because `0.25.0` cannot compile against Node 23+ headers; with `0.25.1` it comes off, leaving the lower bound that `pnpm@11.9.0` requires. `.nvmrc` moves to the newest line the repo builds on.
2. **Node 24 in CI.** `.github/workflows/test.yml` runs `node-version: [22.x]`. Restoring a matrix of `[22.x, 24.x]` covers both supported lines, and the prebuilds make the added leg cost nothing in build time.
3. **No C++ toolchain anywhere.** Consumers, CI runners, and contributors stop needing Xcode Command Line Tools or build-essential to install the workspace.
4. **A different shape for the toolchain check.** `.claude/hooks/verify_toolchain.mjs` reports that a Node change segfaults the parser bindings on `dlopen`, because bindings compiled by one Node build crash under another. N-API prebuilds remove that failure mode entirely. The check keeps its value for version drift and missing installs, but its Node range and the `why` text on the tree-sitter check both need rewriting.
5. **Install time.** The multi-minute native build disappears from every fresh install and every CI run.

### Constraints to respect

- **Peer ranges warn but do not block.** `tree-sitter-rust@0.24.0` declares peer `tree-sitter: ^0.22.1` and `tree-sitter-typescript@0.23.2` declares `^0.21.0`. Both are marked optional, and `0.25.0` produces the same warnings today, so this is not a regression introduced by the bump. pnpm's non-strict peer default warns only.
- **The Linux prebuild needs libstdc++ from GCC 12 or newer** (`GLIBCXX_3.4.31`); it is built on `ubuntu-24.04`. Runtime images older than that fall back to compiling from source, which now succeeds because the C++ standard is no longer hardcoded. Check deployment base images before assuming the prebuild loads.
- **No musl/Alpine prebuild ships.** Alpine compiles from source, which also now succeeds.
- **`tree-sitter` declares no `engines` field**, so npm gives no warning when a consumer's Node is unsupported. Ariadne's own `engines.node` is the only signal.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `packages/core` depends on `tree-sitter@0.25.1`, and the full test suite passes with grammar behaviour unchanged
- [ ] #2 Installing the workspace on Node 22 and Node 24 (darwin-x64, darwin-arm64, linux-x64) completes without invoking node-gyp or a C++ compiler
- [ ] #3 The installed `node_modules/tree-sitter/prebuilds/<plat>-<arch>/` directory contains a `.node` binary for the host platform
- [ ] #4 `engines.node` drops the `<23.0.0` bound, and `.nvmrc` names the newest supported line
- [ ] #5 `.github/workflows/test.yml` runs a `[22.x, 24.x]` matrix and passes on both legs
- [ ] #6 `.claude/hooks/verify_toolchain.mjs` states the widened Node range, and its tree-sitter check no longer describes an ABI segfault as the failure mode
- [ ] #7 Release-time CI check fails if any native dep in `@ariadnejs/core`'s install tree is missing prebuilds for our supported platforms
- [ ] #8 README / install docs no longer recommend `node-gyp` as a dev dependency
<!-- AC:END -->

## References

- TASK-197 (completed): the upgrade to the `0.25` line
- TASK-15.1 (archived): the custom prebuild distribution removed during the monorepo restructure
- Upstream incident chain, resolved: [#248](https://github.com/tree-sitter/node-tree-sitter/issues/248), [#256](https://github.com/tree-sitter/node-tree-sitter/issues/256), [#268](https://github.com/tree-sitter/node-tree-sitter/issues/268), [#276](https://github.com/tree-sitter/node-tree-sitter/issues/276)
