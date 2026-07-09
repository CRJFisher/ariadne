---
id: TASK-190.36.6
title: "CLI hygiene sweep and YAGNI deletions"
status: Done
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

- [x] Every pipeline CLI exits 2 + USAGE on a usage error and 1 on a genuine
      failure; `finalize_triage`'s domain refusal exits 1; result-signal
      exits are unchanged; `cli_args.test.ts` pins the new codes.
- [x] A flag typo on `reconcile_registry.ts` prints a one-line message plus
      USAGE, no stack.
- [x] `--stage --dry-run` produces the stage preview, pinned by a test.
- [x] The reconcile argument-hint names `--stage`/`--apply`.
- [x] `grep -r '"accepted"' ` over plan/prioritize sources, docs, and tests
      returns nothing.
- [x] `plan/SKILL.md` describes `--strategist` as a provenance stamp.
- [x] Triage's allowed-tools carries no unused grants.

<!-- AC:END -->

## Implementation Notes

### High-level summary

The pipeline CLIs now speak one exit-code and error-output convention: a usage
error (argv parse, unknown argument, missing or bad-valued required flag) exits
`2` and prints its message plus the script's `USAGE`; a genuine or domain
failure exits `1`; result-signal exits (a validator's `!ok`, an export write
refusal) are untouched. `reconcile_registry --stage --dry-run` is a first-class
no-op preview, the `accepted` plan-task status — which no writer ever set — is
gone end-to-end, and three stale doc/config surfaces are corrected. Nothing
changes run behavior beyond the exit codes and the newly-accepted `--stage
--dry-run` idiom.

### What changed

- **Exit-code convention (item 1).** The shared `cli_args.parse_project_arg`
  now exits `2` with USAGE on a missing `--project`. Throwing CLIs
  (`validate_plan`, `reconcile_plan`, `get_bucket_context`, `group_runs`,
  `export_to_backlog`, `graduate_group_docs`, `generate_permanent_data`,
  `reconcile_registry`) route argv/validation errors through a module-local
  `class UsageError extends Error {}`; their bottom `catch` prints
  `message + USAGE` and exits `2` for a `UsageError`, and keeps the existing
  `err.stack ?? err.message` (exit `1`) for genuine failures. Inline-exit CLIs
  (`diff_runs`, `list_runs`, `prune_runs`, `preview_folders`, `prepare_triage`,
  `get_next_triage_entry`, `get_entry_context`, `detect_entrypoints`,
  `cross_check_exported_overlap`) print USAGE and exit `2` at each usage site.
  `finalize_triage`'s already-finalized refusal is a domain failure and moved
  `2 → 1`. The convention matches the `validate_consolidation` /
  `apply_investigation_verdicts` exemplars from TASK-190.36.4.
- **Message-not-stack (item 2).** A flag typo now prints one line plus USAGE and
  no stack, via the `UsageError` branch. The stack is retained only on the
  genuine-failure path (see the deviation note below).
- **`--stage --dry-run` (item 3).** `parse_argv` no longer throws on the flag;
  `run_stage` previews when `!args.apply || args.dry_run`, so `--dry-run` forces
  the preview and wins over `--apply` — mirroring the export adapter's
  `will_write = write && !dry_run` idiom. Pinned by two tests (parse accepts the
  combo; `--dry-run` wins over `--apply` writing nothing).
- **`accepted` status deletion (item 5).** Removed from the `PlanTaskStatus`
  union, from `EXPORTABLE_STATUSES` (now `{proposed}`), and from both `is_live`
  read filters (`reconcile_plan`, `exported_overlap`). Every USAGE/doc surface
  and test fixture was updated; fixtures were adapted to preserve their original
  intent (e.g. the id-mode "filters ignored" test switched its demonstration
  from a now-impossible second live status to a `fault_area` mismatch, the one
  filter dimension not re-checked in id mode).
- **Doc/config fixes (items 4, 6, 7).** `reconcile-registry`'s `argument-hint`
  names `--stage`/`--apply` as a `|`-disjoint transaction; `plan/SKILL.md`
  describes `--strategist` as the provenance stamp it is (verified against
  `build_plan_tasks` + `load_staged_plans`, which loads every staged plan
  regardless of the flag); `triage`'s allowed-tools drops the unused
  `Bash(ls:*)` grant.
- **Item 8** was already satisfied by TASK-190.36.2's coordinated settings edit
  (the `self-repair-pipeline` rules and malformed `Write(//…)` entry are gone) —
  a verified no-op.
- **Review follow-ups.** The multi-agent review found the canonical HTML
  comprehension docs under `docs/self-healing-pipeline/` still named `accepted`
  (`actuate-and-backlog.html`, `wire-contracts.html`, `plan-classify.html`) —
  corrected to match. An unused `export` on `reconcile_registry`'s `UsageError`
  was dropped to match the sibling CLIs (YAGNI).

### AC-to-test mapping

- AC1 (exit 2 + USAGE / exit 1 / result-signals unchanged / `cli_args.test.ts`
  pins the codes): `cli_args.test.ts` ("exits via process.exit(2) with USAGE");
  `reconcile_registry.test.ts` parse_argv throw cases; 13 CLIs live-exercised.
- AC2 (flag typo → message + USAGE, no stack): `reconcile_registry --frobnicate`
  live-exercised (exit 2, no stack).
- AC3 (`--stage --dry-run` preview, pinned): `reconcile_registry.test.ts`
  "accepts --stage --dry-run as a no-op preview" + "--dry-run wins over --apply".
- AC4/AC6/AC7: `reconcile-registry/SKILL.md`, `plan/SKILL.md`, `triage/SKILL.md`.
- AC5 (`grep '"accepted"'` returns nothing over sources, docs, tests):
  confirmed clean across `.claude/skills` and `docs/`.

### Deviation from the letter of the spec

Item 2 also says "reserve the stack for `--debug`". No `--debug` flag was added:
the genuine-failure catch keeps `err.stack`, and only the `UsageError` path drops
it. AC2 ("a flag typo prints a one-line message plus USAGE, no stack") is fully
met; adding a `--debug` flag across ~12 CLIs to gate a stack that is already
useful on a real crash would be surplus (YAGNI), and no `--debug` flag exists
anywhere to recover. Recorded as a deliberate interpretation, not an omission.
