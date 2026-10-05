---
id: TASK-190.20.6
title: Type exhaustiveness sweep — Set runtime lookups → satisfies patterns
status: To Do
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - triage-curator
  - types
  - correctness
dependencies: []
parent_task_id: TASK-190.20
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Several runtime-validated unions in the curator are guarded by
`Set<Union>` literals or `if (LIST.includes(x))` checks. Adding a new
variant to the underlying union type does NOT fail the build at these
sites — the runtime list silently lags. Drift is caught only when an LLM
happens to produce the new variant and the validator rejects it, by
which point the build had been green for a while.

Project rule (CLAUDE.md): "no `as never` / `as unknown` / `as any`
casts; variables should almost always be non-nullable". The Set+`as`
pattern at these sites is precisely that — `obj.status as
InvestigatorSessionStatus` after a `Set.has(...)` check. Replacing the
runtime lists with `satisfies` patterns (or `Record<Union, true>`
literals) makes the union the single source of truth: adding a variant
fails the build at the list site, not at runtime.

## Scope

Locations:

1. **`src/session_log.ts:7,15`** — `STATUSES` and `FAILURE_CATEGORIES`
   are `Set<InvestigatorSessionStatus>` / `Set<InvestigatorFailureCategory>`
   literals. The `obj.status as InvestigatorSessionStatus` casts at L49,
   L52, L62, L64 are the symptoms.

2. **`src/validate_investigate_responses.ts`** — the `switch (obj.op)`
   in `parse_signal_check` ends with a `default` returning a
   `ShapeError`. Adding a new `SignalCheck` op to `types.ts` doesn't
   fail this switch. Also `LANGUAGE_VALUES = new Set([...])` at ~L560
   and the `ARIADNE_ROOT_CAUSE_CATEGORIES.includes(...)` check at
   L462,469.

3. **`src/apply_proposals.ts:500-502`** — `is_known_issue_language`
   hard-codes the four language strings.

For each, refactor to a pattern that fails compilation when a new
variant is added to the underlying union. Two acceptable patterns:

**Pattern A — `satisfies Record<Union, true>`.** Declare a
`const STATUSES = { success: true, failure: true, blocked_missing_signal:
true } satisfies Record<InvestigatorSessionStatus, true>;` and check via
`status in STATUSES`. TypeScript verifies every union member appears as
a key.

**Pattern B — typed guard.** Wrap the runtime list with a user-defined
type guard `function is_status(x: string): x is
InvestigatorSessionStatus`. Eliminates the `as` cast.

Pattern A is cheaper and more idiomatic; prefer it unless the call site
already wants a predicate.

## Acceptance criteria

<!-- AC:BEGIN -->

- [ ] #1 No `Set<Union>` literal is consumed by `Set.has(...)` followed
      by a discriminating `as Union` cast in `src/session_log.ts` or
      `src/validate_investigate_responses.ts`
- [ ] #2 Adding a new variant to `InvestigatorSessionStatus`,
      `InvestigatorFailureCategory`, `SignalCheck`, `KnownIssueLanguage`, or
      `AriadneRootCauseCategory` fails the build at the lookup-list site
      (verified by adding a temporary variant and reverting)
- [ ] #3 `pnpm test` is green
- [ ] #4 `npx tsc --noEmit -p .` is clean from the curator skill root
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

This is mechanical. Each site is ~5 lines of change. Worth doing as one
PR; the unifying theme makes the diff easier to read together than apart.
