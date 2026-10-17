---
id: TASK-406
title: "Index very large single-wrapper files without crashing the process"
status: Done
assignee: []
updated_date: "2026-10-17 22:10"
created_date: "2026-10-17 12:00"
labels:
  - indexing
  - tree-sitter
  - crash
  - triage
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A user who loads a project containing one very large file written as a single wrapper — lodash's `test/test.js` (814 KB), a UMD bundle, a classic `;(function(){ ... }.call(this))` module — loses the whole run. Indexing that file kills the Node process with SIGSEGV (exit 139) inside `query.captures()`. The failure is deterministic and cannot be caught by the `try/catch` in `load_project`, so every other file in the project, every call edge and the entry-point list are lost with it, and the user gets no message saying which file did it.

After this task the file indexes like any other: its definitions, references and call edges are in the graph, `list_entrypoints` and `show_call_graph_neighborhood` include them, and a triage run over lodash no longer needs `test/test.js` excluded (the untracked `project_configs/lodash--lodash.json` exclusion, which drops that file's call edges, is removed).

## Why it surfaced now

The bug is latent since the first release and not a regression. Commit `f9dfecff` (2026-08-09, task 373, "put every caller file back in the indexed corpus") made triage runs index test files; before it, `detect_entrypoints.ts` passed a `file_filter` to `load_project` that dropped them at discovery. The June and July lodash runs analysed 19 files and listed `test/test.js` only under `grep_call_sites_unindexed_tests`; the October run analysed 47. `test/test.js` is the first file large enough to trigger the crash. The lodash checkout (`a666ba5`) is clean and byte-identical to a fresh clone, tree-sitter versions match the `packages/core/package.json` pins, and the same crash reproduces on an Ariadne worktree from 25 July.

## Root cause

`packages/core/src/index_single_file/query_code_tree/query_code_tree.ts` (`query_tree`) returns `query.captures(tree.rootNode)`. `captures()` must return captures in document order, so tree-sitter buffers every completed match behind any earlier-starting match that is still in progress. In a single-wrapper file the wrapper `call_expression` (the `@reference.call` pattern) and the nested function-body matches stay open for the whole file, so well over 65,535 matches are buffered at once. tree-sitter 0.25.0's `query.c` stores capture-list ids as `uint16_t` (`capture_list_pool_acquire`, `get`, `release`, `reset`) while the pool limit is `UINT32_MAX` and the node binding's default `matchLimit` is `0xFFFFFFFF`. Past 65,535 lists the ids truncate to 16 bits and `ts_query_cursor__first_in_progress_capture` dereferences a bad list (EXC_BAD_ACCESS at 0x0).

Minimal reproduction with no Ariadne code: parse `test.js` (parses fine, `hasError` false), then `new Query(JavaScript, javascript.scm).captures(root)` exits 139. Patterns 0–75 together do not crash and 75–101 together do; 75–90 and 90–101 pass separately. The crash does not depend on stack size (`ulimit -s 64M` and `--stack-size=50000` still crash). `query.matches()` on the same input succeeds: 129,147 captures in 0.6 s, because it emits each match as it completes and never buffers.

<!-- SECTION:DESCRIPTION:END -->

## Approach

Replace `query.captures(tree.rootNode)` in `query_tree` with a flatten of `query.matches(tree.rootNode)`: for each match take its `captures`, order them by node `startIndex`, then match `pattern`, then match emission sequence, and return the same `QueryCapture` shape the callers consume today.

Do **not** use `matchLimit` as the fix. At 1024 and 20,000 tree-sitter silently drops matches (3 and 4 captures missing against the `matches()` reference, `didExceedMatchLimit()` true); at 65,535 the run took 149 s because of a quadratic scan in `first_in_progress_capture`, and at 20,000 it took 7.5 s against 0.6 s for `matches()`.

## Open questions to settle first

- **Capture order.** On lodash.js the flattened order was identical to `captures()`. On underscore.js the multiset was identical but 43 of 8,529 positions differed on ties. Establish whether anything downstream (the per-language handlers, `process_references`) is order-sensitive on ties; if exact order is required, the alternative is to chunk with `startIndex`/`endIndex` ranges and dedupe.
- **Other languages.** The Python, TypeScript and Rust queries were not tested against very large single-wrapper files and may overflow the same way. The fix sits in the language-agnostic `query_tree`, so it covers them; add a fixture per language where a wrapper shape exists.
- **Upstream.** Whether a newer tree-sitter release widens the 16-bit ids was not checked. An upgrade would be an alternative to the `matches()` change; decide between them with that check done, and do not carry both.

## Acceptance criteria

- [x] `query_tree` no longer calls `query.captures()`; every language's captures come from `matches()` in a deterministic document order.
- [x] A regression test indexes a synthetic JS file that is one wrapper IIFE holding about 150k captures, and completes without a signal.
- [x] The javascript, typescript, python and rust `index_single_file` tests and the full core suite pass.
- [x] Indexing lodash's `test/test.js` through `build_index_single_file` completes and yields its call edges.
- [x] The `test/test.js` exclusion in the lodash triage project config is removed, and a lodash triage run indexes the file.
- [x] Separate follow-up, not part of this task: report a crashed arm explicitly instead of leaving a silent hole in the run. Filed as TASK-407.

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Open questions, settled

**Capture order.** Nothing downstream depends on the order of captures that start at the same byte, once Rust's overlapping definition patterns are folded into one capture per item. Shuffling every same-start run over a seeded 1,521-file sample of the triage repos left the JavaScript, TypeScript and Python indexes identical and changed the content of 15 Rust indexes. The cause was `rust.scm` pairing each item with "generic" and modifier variants (`.generic`, `.async`, `.const`, `.unsafe`, `.method.async`, `.constructor`, a second impl-method pattern): tree-sitter matches every pattern, not the first, and the definition builder replaces an entry keyed by symbol id, so whichever handler ran last won. `index_single_file.test.ts` now reverses every same-start run across all fixtures and requires an identical index (the `references` list excepted, whose order follows the captures'); on the original Rust code it fails on 10 fixtures. CAPTURE-SCHEMA.md states the invariant as "one registration per definition".

**Other languages.** Only the JavaScript and TypeScript wrapper IIFE (`;(function(){ ... }.call(this))`) holds a match open across the file. Python (class body, `if __name__`, lambda call, outer function) and Rust (`mod`, `fn`, `impl`, macro body, closure IIFE) shapes of 150k-450k captures all complete under `captures()`, because their wrapper constructs end the pattern on the large child. Regression fixtures exist for JavaScript and TypeScript; `query_tree` is language-agnostic, so Python and Rust read through the same path.

**Upstream.** tree-sitter core `master` widens capture-list ids to `uint32_t`, but the newest node binding, 0.25.1 (2026-07-28), still vendors the `uint16_t` pool; no release fixes the overflow, so `matches()` is the fix. The binding was upgraded to 0.25.1 anyway for its prebuilt binaries (darwin, linux and win32 on x64 and arm64; 0.25.0 compiled from source) and its core fixes; indexing the 1,843-file corpus gives byte-identical results on both versions.

## What changed

- **`query_tree`** reads `query.matches()` and restores document order with a stable sort on (start byte, pattern index), the keys `captures()` orders by. It returns the same captures as `captures()` on every fixture (corpus test in `query_code_tree.test.ts`), except that it keeps the root scope capture of an empty file, which `captures()`'s range filter drops and `process_scopes` folds into the root scope.
- **Scope lookup** (`create_processing_context`) binary-searches each level's children sorted by start. A single-wrapper file gives one scope thousands of children, and the linear child scan made indexing quadratic: the 150k-capture wrapper fixture went from 22 s to 3.4 s. Checked equal to the linear scan on 1,143,375 lookups across 1,842 files.
- **Rust: one definition capture per item.** Generic traits and enums keep their type parameters; generic `async`/`const`/`unsafe` functions keep type parameters and doc comments; `const unsafe fn` and trait-impl methods keep doc comments; `async` methods, inherent and trait, are recorded as `async`. Rust emits no `@definition.constructor`: `new` is a method whose `static` flag is read off the item. Duplicate `let mut`, closure and typed-closure-parameter patterns are gone, and Rust joins the fixture-corpus duplicate audit with no known duplicates.
- **tree-sitter 0.25.1**, lockfile changed in the tree-sitter entries only; the benchmark guard's grammar pin moves with it.

## Effect on the call graph

Built from real old and new worker builds (`dist`), with worker width fixed at 4:

- express, mocha, jquery, celery, fastapi, rxjs, nest and serde: identical nodes, edges and entry points.
- axum: `execute` stops being a false entry point. `handle_connection<L, M, S, B, E>` is a generic `async fn`, whose `E: Executor` bound was overwritten before, so `executor.execute(...)` could not resolve.
- sqlx: `with_socket` and `complete_io` stop being false entry points; 5 calls resolve.
- actix-web: 3 calls to `size` resolve.

## Measurements

- Indexing `lodash.js` takes 1.8 s (10.9 s before); the 1,521-file sample takes 43.2 s (107.7 s before).
- `test/test.js` indexes in 4.8 s, contributing 3,055 nodes and 14,129 call references. A lodash triage detection indexes 48 files (47 before), with the same 24 entry points; `throttled`'s 10 grep call sites in `test/test.js` are now inside the corpus, moving its diagnosis from `callers-outside-indexed-corpus` to `callers-in-registry-wrong-target`.
- Indexing runs on worker threads loaded from `packages/core/dist`, so a checkout runs the fix only once it is rebuilt.

## Follow-ups filed

- TASK-407: report a crashed indexing arm, naming the in-flight file.
- TASK-408: a named function expression passed as a callback is indexed twice (named, plus a spurious `<anonymous>` with no body scope that carries the callback context).
- TASK-409: receiver value sources are re-derived per call site; lodash with `test/test.js` spends 12.8 s of its 20.4 s load in call resolution.

<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

A project containing a very large single-wrapper file (lodash's `test/test.js`, UMD bundles, IIFE modules) now indexes instead of killing the process with SIGSEGV, and indexes fast: `query_tree` reads `matches()` in document order, and scope lookup no longer scans a wide scope's children linearly. Settling the capture-order question exposed Rust items that registered twice and lost data depending on handler order; Rust now emits one definition capture per item, so generic traits, enums and functions keep their type parameters, Rust doc comments and `async` methods survive, and three false-positive entry points disappear on axum and sqlx. tree-sitter is at 0.25.1 (prebuilt binaries, corpus-identical output). The lodash triage config indexes `test/test.js`; follow-ups are TASK-407, TASK-408 and TASK-409.

<!-- SECTION:FINAL_SUMMARY:END -->
