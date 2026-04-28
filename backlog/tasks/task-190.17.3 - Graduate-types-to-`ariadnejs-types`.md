---
id: TASK-190.17.3
title: Graduate types to `@ariadnejs/types`
status: To Do
assignee: []
created_date: "2026-04-28 19:13"
labels:
  - self-repair
  - core-refactor
dependencies:
  - TASK-190.17.1
parent_task_id: TASK-190.17
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Scope

Move type definitions from the self-repair-pipeline skill into `@ariadnejs/types` so both core (post-Phase-3) and skill consumers import the canonical shapes from one place. No behavior changes; this is an additive type relocation with skill re-exports preserved temporarily.

## Moves

| Source (skill)                                                                                                              | Destination                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `.claude/skills/self-repair-pipeline/src/entry_point_types.ts`                                                              | `packages/types/src/classified_entry_point.ts`              |
| `.claude/skills/self-repair-pipeline/src/known_issues_types.ts`                                                             | `packages/types/src/known_issues.ts`                        |
| `.claude/skills/self-repair-pipeline/src/auto_classify/predicate_evaluator.ts` (types only — keep impl in skill until `.5`) | extract type defs into `packages/types/src/known_issues.ts` |

## Skill re-exports (temporary)

Until subsequent sub-sub-tasks consume the new paths directly, the skill keeps thin re-export modules at the old paths so existing imports still work. Drop the re-exports as the skill moves to `@ariadnejs/types` directly in `.13`.

## Constraint — no circular deps

`@ariadnejs/types` must not import from `@ariadnejs/core`. Keep the predicate evaluator implementation (the runtime, file-I/O-touching part) in the skill or core; only types graduate.

## Verification

- `pnpm build` passes in `packages/types`, `packages/core`, `packages/mcp`, and both skills.
- `pnpm test` passes everywhere.
- `tsc --noEmit` shows no errors at any package boundary.
- `grep -rn "from .*self-repair-pipeline.*entry_point_types\|from .*self-repair-pipeline.*known_issues_types" packages/` returns no hits (packages no longer reach into skill internals for types).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 entry_point_types.ts moved to packages/types/src/classified_entry_point.ts
- [ ] #2 known_issues_types.ts moved to packages/types/src/known_issues.ts
- [ ] #3 Predicate DSL types (PredicateExpr, PredicateOperator, ClassifierSpec, etc.) live in @ariadnejs/types
- [ ] #4 Skill re-export modules preserve old import paths during transition
- [ ] #5 No circular dep introduced between @ariadnejs/types and @ariadnejs/core
- [ ] #6 pnpm build + pnpm test pass in all packages and both skills
- [ ] #7 Predicate evaluator runtime impl remains in the skill (will move to core in 190.17.5)
<!-- AC:END -->
