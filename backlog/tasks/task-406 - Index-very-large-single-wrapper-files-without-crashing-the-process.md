---
id: TASK-406
title: "Index very large single-wrapper files without crashing the process"
status: To Do
assignee: []
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

- [ ] `query_tree` no longer calls `query.captures()`; every language's captures come from `matches()` in a deterministic document order.
- [ ] A regression test indexes a synthetic JS file that is one wrapper IIFE holding about 150k captures, and completes without a signal.
- [ ] The javascript, typescript, python and rust `index_single_file` tests and the full core suite pass.
- [ ] Indexing lodash's `test/test.js` through `build_index_single_file` completes and yields its call edges.
- [ ] The `test/test.js` exclusion in the lodash triage project config is removed, and a lodash triage run indexes the file.
- [ ] Separate follow-up, not part of this task: report a crashed arm explicitly instead of leaving a silent hole in the run.
