---
id: TASK-346
title: Type exhaustiveness sweep — triage-entrypoints known_issues_registry Set<Union> patterns
status: To Do
assignee: []
created_date: "2026-05-26 14:00"
labels:
  - triage-entrypoints
  - types
  - correctness
dependencies: []
priority: low
ordinal: 346000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

TASK-190.20.6 made the curator's `Set<Union>`-and-cast lookups exhaustive
via `as const satisfies Record<Union, true>` lookups + typed predicates,
so adding a new variant to one of the affected unions fails the build at
the lookup site. The sibling `triage-entrypoints` skill was out of scope
for that pass — its `src/known_issues_registry.ts:32-43` still has two
hand-listed Sets typed against `KnownIssueStatus` and `KnownIssueLanguage`
from `@ariadnejs/types`:

- `VALID_STATUSES: ReadonlySet<KnownIssueStatus>`
- `VALID_LANGUAGES: ReadonlySet<KnownIssueLanguage>`

The membership checks at the registry-loading boundary use these sets.
Adding a new `KnownIssueStatus` (e.g. a future lifecycle state beyond
`wip | permanent | fixed`) or `KnownIssueLanguage` variant ships green
through `tsc` but is silently filtered out at load time. The
classifier-lifecycle invariant is that registry loading must surface
new variants, not drop them.

## Scope

Refactor both Sets to the same `as const satisfies Record<Union, true>` +
`Object.hasOwn`-based typed-predicate pattern landed in
`.claude/skills/triage-curator/src/types.ts` (see e.g.
`KNOWN_ISSUE_LANGUAGE_LOOKUP` + `is_known_issue_language`).

Locations:

1. `.claude/skills/triage-entrypoints/src/known_issues_registry.ts:32-43`
   — both `VALID_STATUSES` and `VALID_LANGUAGES`.
2. Audit other read-only boundaries in the skill that accept enum-shaped
   strings from disk (`grep -rn "new Set<" .claude/skills/triage-entrypoints/src/`).

## Acceptance criteria

<!-- AC:BEGIN -->

- [ ] #1 No `Set<KnownIssueStatus>` / `Set<KnownIssueLanguage>` literal remains in
      `.claude/skills/triage-entrypoints/src/` paired with membership-check casts
- [ ] #2 Adding a new variant to `KnownIssueStatus` or `KnownIssueLanguage` in
      `@ariadnejs/types` fails the build at the lookup site (verified by a
      throw-away local variant + revert)
- [ ] #3 `pnpm test` and `pnpm exec tsc --noEmit` are green in the
      triage-entrypoints skill
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

Surfaced by the opus reviewer of commit 2e07149f (TASK-190.20.6).
Strictly out-of-scope for that task; this follow-up captures the
remaining hand-listed Sets so the next variant addition cannot silently
drop through.
