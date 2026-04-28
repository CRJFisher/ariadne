---
id: TASK-190.17.2
title: 'Naming hygiene: rename `IntrospectionGap` → `SignalLibraryGap`'
status: To Do
assignee: []
created_date: '2026-04-28 19:12'
updated_date: '2026-04-28 19:37'
labels:
  - naming-hygiene
  - triage-curator
dependencies: []
parent_task_id: TASK-190.17
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The triage-curator's `IntrospectionGap` shape encodes "the signal-library / classifier-DSL is missing an op needed to express this rule" — it asks for new `SignalCheck.op` values, *not* facts-API additions. Once `classify_entry_points/` lands inside `packages/core/` alongside the existing `packages/core/src/introspection/` (the facts API: `explain_call_site`, `list_name_collisions`), the name collision between "introspection" (facts) and "introspection gap" (signal-library deficit) becomes a real source of confusion.

Rename the curator concept ahead of the structural moves so the boundary is clean.

## Sites to rename

- `.claude/skills/triage-curator/src/types.ts:188-198` — `IntrospectionGap` interface declaration (doc comment + interface body), `IntrospectionGapTaskToCreate` type (later in same file)
- `.claude/skills/triage-curator/src/apply_proposals.ts:301-311` — `IntrospectionGapTaskToCreate[]` field + flow
- `.claude/skills/triage-curator/src/validate_investigate_responses.ts:135,257-263,321,347`
- `.claude/agents/triage-curator-investigator.md` — investigator prompt prose (~14 hits of `introspection_gap` / "introspection gap" prose; identifier `IntrospectionGap` not present)
- `.claude/skills/triage-curator/SKILL.md` (~7 hits at lines 3, 143, 201, 209, 211, 330, 477; identifier `IntrospectionGap` not present in this file)
- Any test files asserting on these identifiers

## Constraint

This is purely an identifier rename + prompt prose update — no behavior change. The 3-way curator output split (classifier / ariadne_bug / signal_library_gap) remains; only the third branch is renamed.

## Verification

- `pnpm test` passes in `.claude/skills/triage-curator/`.
- `grep -rn 'IntrospectionGap' .claude/skills .claude/agents` returns no hits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IntrospectionGap interface renamed to SignalLibraryGap in triage-curator types.ts
- [ ] #2 IntrospectionGapTaskToCreate renamed to SignalLibraryGapTaskToCreate
- [ ] #3 All references in apply_proposals.ts, validate_investigate_responses.ts updated
- [ ] #4 triage-curator-investigator.md prompt prose updated (~20 hits)
- [ ] #5 SKILL.md updated (~12 hits)
- [ ] #6 Tests pass in .claude/skills/triage-curator/
- [ ] #7 grep for IntrospectionGap returns zero hits across .claude/
<!-- AC:END -->
