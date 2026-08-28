---
id: TASK-386
title: "Stop marking a namespace-local const as exported so two namespaces in one file can each have a byKind"
status: To Do
assignee: []
created_date: "2026-08-27 22:30"
labels:
  - import_resolution
  - bug
dependencies:
  - TASK-381.8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A TypeScript file that declares a private helper inside two different exported
namespaces publishes neither of them, and Ariadne reports both. The reported
export surface of such a file is wrong in a way a reader cannot see: it names a
binding no consumer can import, and the file's real surface is described beside
a phantom one.

At microsoft/vscode `f3fa55c3`, `src/vs/editor/common/languages.ts` is the case
that surfaces it. Line 390 declares `const byKind = new Map<CompletionItemKind,
ThemeIcon>()` inside `export namespace CompletionItemKinds`, and line 1672
declares `const byKind = new Map<SymbolKind, ThemeIcon>()` inside
`export namespace SymbolKinds`. Neither carries `export`. TypeScript publishes
neither: a namespace member is exported only when it says so, and the enclosing
namespace's own `export` keyword publishes the namespace, not its interior. The
indexer marks both `is_exported`, so one file offers `byKind` twice.

This is the TypeScript-namespace analogue of the CommonJS-by-scope problem
TASK-374.1 fixed: export status is being decided from the shape of a
declaration rather than from the scope the declaration sits in, so a binding
that is module-private through its enclosing scope is read as module-public.

## Why it is only visible now

`ExportRegistry` used to throw `Duplicate export name` on the pair and
`load_project` dropped the whole file, so the defect presented as one of 676
coverage losses rather than as a wrong export surface. TASK-381.8 keyed export
metadata on (declaration space, name), which readmits the file and makes the
same-space pair legal declaration merging — the first `byKind` keeps the
metadata slot and the second joins the export set. Two `const` declarations in
one space are NOT legal merging in TypeScript, so this pair is the one member
of that population that should never have reached the merging rule.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A `const`, `let`, `var`, `function` or `class` declared inside a namespace body without its own `export` keyword is `is_exported: false`, whether or not the enclosing namespace is exported.
- [ ] #2 `src/vs/editor/common/languages.ts` at microsoft/vscode `f3fa55c3` offers `byKind` on its export surface ZERO times, against twice today, and the file's other exports are unchanged member for member.
- [ ] #3 A namespace member that DOES carry `export` is still exported, and reaching it through the namespace still resolves — both directions asserted, not just the negative.
- [ ] #4 The same-space "first declaration wins" branch in `ExportRegistry.update_file` no longer fires on any constant+constant pair over vscode's `src/`, which is the count that says this defect is gone rather than relocated.

<!-- AC:END -->
