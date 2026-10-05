---
id: TASK-387
title: "Keep the one repo-wide file the scope-tree invariant still drops and rolls back"
status: To Do
assignee: []
created_date: "2026-08-27 22:30"
labels:
  - bug
  - call-graph
dependencies:
  - TASK-381.8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

One file of microsoft/vscode is read, parsed, indexed and then discarded, so
its call edges are absent from the reported graph while the file exists on
disk. Every function it calls reads as uncalled.

Pointed at the repository root — which is what `load_project({project_path})`
discovers with no folder filter — the stack indexes 12,653 of the 12,654 files
`find_source_files` selects. The residual is
`extensions/vscode-colorize-tests/test/colorize-fixtures/test6916.js`, and the
gate that drops it is not the export registry:

```
Malformed scope tree: multiple scopes at depth 1 contain location ...
```

TASK-381.8 removed the export gate, which took the drop count over vscode's
`src/` tree to zero and the repo-wide count to one. "`dropped_files` is empty"
is therefore a property of the `src/` corpus rather than of the loader, and
this is the file that says so.

The loader's try/catch and `Project.evict_ingested_file` rollback stay in place
as the general per-file indexing-failure boundary — this task is about the
invariant the scope builder is asserting, not about the boundary that catches
it.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 The scope-tree invariant is stated: what "multiple scopes at depth 1 contain location" is protecting against, and whether the construct in `test6916.js` violates it or the builder mis-derives containment for that construct.
- [ ] #2 `load_project({project_path})` over microsoft/vscode at `f3fa55c3` indexes 12,654 of 12,654 with an empty `dropped_files` set, asserted by `project.get_file_contents().size` rather than inferred.
- [ ] #3 The construct is reduced to an inline test case in the scope-builder's own test file, failing before the fix and passing after.
- [ ] #4 The seven-number fingerprint over the `src/` corpus is byte-identical before and after: this file is outside `src/`, so a move there would mean the repair changed something else.

<!-- AC:END -->
