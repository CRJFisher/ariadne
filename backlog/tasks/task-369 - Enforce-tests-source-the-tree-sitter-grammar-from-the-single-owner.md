---
id: TASK-369
title: Enforce that tests source the tree-sitter grammar from its single owner
status: To Do
assignee: []
created_date: "2026-07-21 00:00"
labels:
  - test-infra
  - enforcement
  - indexer
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/parsers.ts
  - .claude/hooks/file_naming_validator.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Grammar selection for a language has one owner: `parsers.ts`
(`LANGUAGE_TO_TREESITTER_LANG`), the map the parse pipeline reads to pick a
tree-sitter grammar and to compile the matching `.scm` query. A parsed tree and
the query run over it must come from the same grammar, because a tree-sitter
query compiled against one grammar yields zero captures on a tree parsed by
another — the node-type ids differ.

Test files that build their own parser and hardcode a grammar
(`parser.setLanguage(TypeScript.typescript)`) duplicate the grammar-selection
decision. When the owner changes which grammar a language maps to, those tests
keep parsing with the stale grammar while the query is compiled against the new
one, so every capture silently returns nothing and the tests fail with
misleading "definition not found" errors far from the real cause.

A guard blocks this at write time: a test that names a tree-sitter grammar
directly (`TypeScript.typescript`, `TypeScript.tsx`, or a bare
`tree-sitter-<lang>` grammar object passed to `setLanguage` / a query
constructor) is rejected with a message pointing at the single-owner accessor to
use instead. The accessor is the source of truth for how a file maps to a
grammar — a language-keyed lookup, or the extension-aware selector if one exists
(see TASK-358, which splits `.ts` and `.tsx` onto different grammars).

### Origin

Surfaced by TASK-358: changing `LANGUAGE_TO_TREESITTER_LANG`'s TypeScript entry
broke ~15 test files (152 tests) that hardcoded `TypeScript.typescript`; the fix
repointed them at the map. The instance is fixed; this task prevents recurrence.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A write-time check (hook or lint rule) flags a test file that passes a
      tree-sitter grammar object directly to `setLanguage` or a `Query`
      constructor instead of sourcing it from the grammar owner in `parsers.ts`.
- [ ] The check names the correct accessor in its message and does not fire on
      `parsers.ts` itself (the owner) or on non-test code.
- [ ] Existing test files pass the check (they already source the grammar from
      the owner after TASK-358).

<!-- AC:END -->
