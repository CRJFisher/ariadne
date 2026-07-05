---
id: TASK-190.36.6
title: "CLI hygiene sweep and YAGNI deletions"
status: To Do
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - self-repair
  - self-healing
  - pipeline-hardening
parent_task_id: TASK-190.36
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Hygiene: exit-code convention, human-facing error output, and surplus-code
deletions per the constitution. Nothing here changes run behavior except
where noted. The CLI inventory is 19 scripts — 6 under `plan/scripts/`, 13
under `triage/scripts/` (including `reconcile_registry.ts`;
`reconcile-registry/` is SKILL.md-only) — plus the shared
`triage/src/cli_args.ts`.

### Work

1. **Exit-code convention sweep.** Usage errors (argv parse, `Unknown
argument`, missing `--project`) move to exit 2 + USAGE across all 19 CLIs
   and `cli_args.ts:21`; `finalize_triage.ts:63`'s already-finalized refusal
   is a domain failure and moves 2 → 1. Do NOT touch legitimate
   result-signal exits: `validate_plan.ts:89`'s `!ok` and
   `export_to_backlog.ts`'s write refusals are real failures and stay
   exit 1. Update `cli_args.test.ts:20-30` (pins `__exit__:1`) in the same
   commit. Agree the convention once with TASK-190.36.4's new validators
   (validate_consolidation, check scripts) so all validators speak
   pass=0 / fail=1 / abstain=2.
2. **Message-not-stack.** `reconcile_registry.ts:1042-1043` prints
   `err.stack` on a flag typo; print `err.message` + USAGE, reserve the stack
   for `--debug`. The same `err.stack ?? err.message` pattern exists in all
   12 CLI catch blocks — propagate the message-first treatment where cheap.
3. **`--stage --dry-run` becomes a no-op preview.** `reconcile_registry.ts:
533-537` currently throws on the natural preview idiom; stage is dry-run
   by default, so accept the flag. Add a test.
4. **Reconcile argument-hint.** `reconcile-registry/SKILL.md:4` still omits
   `--stage <draft-path> [--apply]` (the USAGE string in the script is
   already fixed — do not re-edit it). Use `|` to signal the disjoint
   transaction.
5. **Delete the `accepted` status end-to-end.** No writer exists anywhere.
   Remove from `PlanTaskStatus` (`plan_task.ts:52,66`), the read filters
   (`reconcile_plan.ts:91`, `select_exportable_tasks.ts:41`), USAGE/doc
   surfaces (`export_to_backlog.ts:55,83`, `plan/SKILL.md:174`,
   `prioritize/SKILL.md:4,76,438,444`), and any test fixtures. Land before
   TASK-190.36.7 rewrites the docs that mention it.
6. **Fix the `--strategist` doc; keep the flag.** It is a provenance stamp on
   minted tasks (`build_plan_tasks.ts:34,148`), not a plan selector as
   `plan/SKILL.md:113` claims. One-line doc correction.
7. **Drop triage's unused `Bash(ls:*)`** from `triage/SKILL.md:6`.
8. **settings.local.json debris** (machine-local, human-run): delete the
   stale `self-repair-pipeline` rules and the malformed `Write(//…)` entry —
   executed as part of TASK-190.36.2's single coordinated settings edit, not
   a second pass.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] Every pipeline CLI exits 2 + USAGE on a usage error and 1 on a genuine
      failure; `finalize_triage`'s domain refusal exits 1; result-signal
      exits are unchanged; `cli_args.test.ts` pins the new codes.
- [ ] A flag typo on `reconcile_registry.ts` prints a one-line message plus
      USAGE, no stack.
- [ ] `--stage --dry-run` produces the stage preview, pinned by a test.
- [ ] The reconcile argument-hint names `--stage`/`--apply`.
- [ ] `grep -r '"accepted"' ` over plan/prioritize sources, docs, and tests
      returns nothing.
- [ ] `plan/SKILL.md` describes `--strategist` as a provenance stamp.
- [ ] Triage's allowed-tools carries no unused grants.

<!-- AC:END -->
