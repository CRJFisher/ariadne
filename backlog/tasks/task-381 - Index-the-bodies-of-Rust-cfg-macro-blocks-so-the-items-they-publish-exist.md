---
id: TASK-381
title: "Index the bodies of Rust cfg_* macro blocks so the items they publish exist"
status: To Do
assignee: []
created_date: "2026-08-12 12:40"
labels:
  - syntactic_extraction
  - import_resolution
dependencies:
  - TASK-375
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

A Rust crate that publishes its module tree from inside a declarative-macro body is invisible
to the index. Indexing a `cfg_io_util! { … }` block yields zero definitions and zero imports,
so every item the block declares — and every `pub use` it performs — is absent. The crate's
published surface is whatever survives outside the macro bodies, which for tokio is very
little: `tokio/src/lib.rs:563`, `io/mod.rs:285` and `io/util/mod.rs:32` all publish through
`cfg_*!`.

The consequence is a call graph that reports a crate's public API as unreachable. Callers that
reach a name through the macro-published surface resolve to nothing, and the definitions
themselves surface as entry points nothing calls.

## Why this is its own task

TASK-375 records wildcard module edges and fans the export surface across them, which closes
the `pub use` gap for every shape the parser can see. It cannot close a `pub use` the parser
never reaches. The two tokio `pub use` rows in that task's evidence are blocked here, and
TASK-375 acceptance criterion #11 requires exactly that they be tracked rather than counted
against it.

## Shape of the work

A macro body is a token tree, not parsed items, so the grammar gives no definitions to walk.
Deciding how far to go is the first question this task must answer:

- Whether to expand only the crate-local `macro_rules!` definitions a file can see, or to
  treat a `cfg_*!` body as items and parse it directly.
- Whether the conditional arms are all taken (an over-approximation toward reachability,
  matching how `#[cfg]`-gated `mod` declarations are already handled) or resolved.
- What a caller sees when two arms publish the same name, which is the shape
  `registries/export.ts` already decides for `#[cfg(unix)]`/`#[cfg(windows)]` alternates.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Indexing a file containing a `cfg_*!` macro block yields the definitions and imports its body declares.
- [ ] #2 The two tokio `pub use` rows carried out of TASK-375 resolve, asserted individually as `Project` integration tests.
- [ ] #3 Two arms publishing the same name follow the rule `registries/export.ts` already applies to `#[cfg]`-gated alternates, pinned by a test.
- [ ] #4 The chosen expansion strategy and its over-approximation are recorded on this task.

<!-- AC:END -->
