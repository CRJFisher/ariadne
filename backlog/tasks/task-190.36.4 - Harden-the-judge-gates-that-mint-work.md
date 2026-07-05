---
id: TASK-190.36.4
title: "Harden the judge gates that mint work"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - self-repair
  - self-healing
  - pipeline-hardening
  - classifier-lifecycle
parent_task_id: TASK-190.36
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The pipeline strict-parses most hand-offs, but at exactly the seams where a
wrong model verdict is silent and permanent, validation is shape-deep or
absent. Each gap below converts a k=1 judge output into a deterministic
check or a recorded, reviewable decision. All new validators for the
prioritize flow land under `.claude/skills/plan/` (prioritize is
SKILL.md-only) and mirror the proven `validate_plan` shape: thin CLI + pure
`(raw, ctx) → {ok, issues}` function + colocated test.

### Work

1. **Sample-execution gate in `--stage`** (smallest, highest leverage). A
   drafted classifier is never executed before registry insertion:
   `run_stage` (`reconcile_registry.ts:839-929`) checks schema, duplicate
   `group_id`/`function_name`, and `BUILTIN_CHECKS` membership only, and the
   `classifier-author` agent has no tool to run its own check (the check body
   ships as a placeholder comment). Correction to the review: the hazard is
   not a dead classifier — the single `auto_classify` call site feeds full
   `EnrichedEntryPoint`s, so a check keyed on `tree_size`/
   `definition_features` **fires on fields the author validated only against
   the narrower `TriageEntry`**. Fix: `classifier-author` persists
   `samples/*.json` of full `EnrichedEntryPoint` objects for its group
   (expose them via a `get_entry_context.ts --enriched` emit); `run_stage`
   gains a step between BUILTIN_CHECKS membership and the dry-run return that
   loads the samples, runs the drafted check against every one, prints the
   per-sample result in the dry-run preview, and refuses `--apply` on any
   miss. The rejection is a `StageDraftError` on the read path — it must not
   alter the `--stage`/`--apply` write asymmetry the guard depends on. These
   persisted samples are the natural seed input for 190.31.1's eval-set store.
2. **`validate_consolidation.ts`.** `consolidation.json` is the only
   unvalidated hand-off in the chain — and it is never parsed by code at all:
   its ids reach export only via human copy-paste into `--id` flags, so a row
   dropped from every cluster silently never exports and a double-assigned
   row exports twice. Have step 4 persist its input `groups.json`; add the
   validator as step 4.5 and re-run it as an export precondition. Assertions:
   exact partition of `clusters[].member_row_ids` over investigated row ids
   (`row_dropped` / `row_double_assigned` / `row_unknown`), `plan_path`
   exists on disk, `slug` shape + uniqueness (a slug typo is a silently lost
   comprehension doc via `graduate_group_docs.ts:144`), and no
   permanent-rerouted id in any cluster (the Z24 wedge).
3. **Reject empty `acceptance_criteria` on evidence-bearing tasks.**
   `task_assignment.ts:114-116` accepts `[]` vacuously. Enforce in
   `export_to_backlog.ts`, where authored tasks and source `PlanTask` rows
   (with `evidence`) are both already loaded: any authored task whose
   collapsed `plan_task_ids` carry non-empty evidence must have non-empty
   acceptance criteria. Evidence-free tasks may keep `[]`.
4. **File-authoritative permanent-limitation routing.** Prioritize routes
   groups on the `<result>` prose line `PERMANENT-LIMITATION:` while
   `refactor_plan.md` is authoritative — the anti-pattern triage explicitly
   forbids — and the deterministic export gate
   (`select_exportable_tasks.ts:112`) keys on the plan-engine mint-time flag,
   never updated by the investigation. Fix: `refactor-investigator` writes a
   strict-parsed `verdict.json` beside `refactor_plan.md`
   (`{outcome: "permanent_limitation" | "fixable", boundary, row_ids}`);
   prioritize routes from the file; a disagreement with
   `is_permanent_limitation` writes a reroute record and flips the source
   `PlanTask` flag through the task-DB writer so the export gate and the
   investigation agree. `validate_consolidation` consumes the reroute record
   (item 2).
5. **`belongs: 'unsure'` + standing-override audit.** A k=1 `belongs: false`
   both drops the member from grounding and writes a membership override that
   suppresses it on every future sweep — unconditional, no expiry, no
   surfacing (the store's own docstring at `membership_override.ts:14-18`
   concedes this). Add the third value: `'unsure'` grounds nothing this sweep
   but writes no override, so the member re-enters review next sweep. Add a
   read-side audit (reconcile summary section or a small lister) reporting
   every active override with its sweep stamps and a never-re-confirmed
   flag. No auto-unsuppress — surface for the human, mirroring the
   registry's no-auto-reflip rule.
6. **Z15 backstop: AST field-denylist test.** A `packages/core` test walking
   every `builtins/check_*.ts` and flagging member access on
   `tree_size`/`definition_features` — the fields absent from the author's
   evidence surface. Closed denylist, low false-positive risk.
7. **Per-cluster human read between authoring (7a) and export (7b).** Cards
   are judge prose exported verbatim; the funding decision (step 6) predates
   the authoring it funds. Extend `export_to_backlog.ts` so `--assignments`
   without an explicit write opt-in renders the would-be card bodies
   (title + acceptance criteria) without writing; the coordinator surfaces
   each cluster through `AskUserQuestion` (approve / edit / skip) before the
   writing run — the same DIFF-channel treatment the registry gets from
   `--stage`.

Suggested order: 1 → 2 → 3 → 6 → 4 → 5 → 7. Exit-code convention for the new
validators: agree once with TASK-190.36.6 (usage → exit 2 + USAGE; a genuine
validation `fail` → exit 1).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `--stage --apply` refuses any draft whose check does not return true on
      every persisted sample; the dry-run preview prints per-sample results.
- [ ] `validate_consolidation.ts` fails on a dropped row, a double-assigned
      row, an unknown id, a missing plan_path, a duplicate slug, and a
      rerouted id — each pinned with a `toEqual` literal-issues test.
- [ ] An evidence-bearing authored task with empty acceptance criteria cannot
      export.
- [ ] Prioritize routing reads `verdict.json`, never `<result>` prose; a
      flag/verdict disagreement produces a reroute record and a consistent
      export gate.
- [ ] `belongs: 'unsure'` writes no override; the standing-override audit
      lists never-re-confirmed suppressions.
- [ ] The builtin field-denylist test fails on a check reading `tree_size` or
      `definition_features`.
- [ ] No backlog card body is written without a human having seen its title
      and acceptance criteria post-authoring.

<!-- AC:END -->
