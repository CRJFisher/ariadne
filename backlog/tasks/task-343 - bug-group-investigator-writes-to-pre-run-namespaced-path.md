---
id: TASK-343
title: >-
  [bug] group-investigator writes to pre-run-namespaced path
status: Done
assignee: []
created_date: "2026-05-07 00:00"
labels:
  - self-repair-pipeline
  - sub-agent-bug
  - paths
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

**Root cause:** `.claude/agents/group-investigator.md` documents the legacy unversioned state layout. After the run-namespacing migration the skill scripts and the other two sub-agents (`triage-investigator`, `rough-aggregator`) write through helpers that resolve the active run via `LATEST`, but `group-investigator` builds its Write paths by string-templating the prompt. Lines 26, 29, 44 of the agent doc all reference `~/.ariadne/self-repair-pipeline/triage_state/{project}/...` — none of them include `runs/<run-id>/`.

**Observed during sqlx run** (`6956cef-2026-05-06T20-13-03.463Z`): 5 of 26 group-investigator agents (`closure-callback-not-tracked`, `fn-pointer-indirect-call`, `qualified-path-receiver-resolution`, `rust-macro-invocation-call`, `rust-test-attribute`) wrote `*_investigation.json` to `triage_state/sqlx/aggregation/pass3/` instead of `triage_state/sqlx/runs/<run-id>/aggregation/pass3/`. The other 21 agents inferred the correct run-namespaced path — likely from the existing `pass3/input.json` they Read first or from glob-listing the directory. Behaviour is non-deterministic and silent: `finalize_aggregation.ts` only sees the run-scoped files, so misplaced groups would be dropped from the final output if not relocated by hand.

**Fix:** Update `.claude/agents/group-investigator.md` to either:

1. Reference run-namespaced paths explicitly (`triage_state/{project}/runs/<run-id>/...`) and pass `run_id` in the prompt; or
2. Add a small helper script (e.g. `get_group_paths.ts --project <name>`) that prints the resolved triage-state path, results dir, and pass3 output dir, and instruct the agent to call it before any Read/Write — analogous to how `get_entry_context.ts` works for `triage-investigator`.

Option 2 is preferred: it removes path templating from prompts entirely and matches the pattern already used for the other two sub-agents.

**Other potential drift sources** to audit while fixing:

- The skill README and any docs under `.claude/skills/self-repair-pipeline/reference/` for stale unversioned paths.
- The dead-code guardrail and TP-cache code paths — both already use `require_run` so should be fine.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

Took option 2 (helper script). Changes:

- New `.claude/skills/self-repair-pipeline/scripts/get_group_paths.ts` — resolves the active run via `require_run` and prints `{ run_id, state_path, results_dir, pass3_dir }` (JSON to stdout). Mirrors the pattern of `get_entry_context.ts`.
- New `.claude/skills/self-repair-pipeline/scripts/get_group_paths.test.ts` — colocated test on the pure `build_group_paths(run: ResolvedRun)` builder.
- `.claude/agents/group-investigator.md` — replaces hardcoded `~/.ariadne/self-repair-pipeline/triage_state/{project}/...` paths (lines 26, 29, 44 of the original) with `{state_path}`, `{results_dir}/{entry_index}.json`, `{pass3_dir}/{group_id}_investigation.json`. Adds the helper to the agent's `Bash(...)` tool allowlist and tightens `Write` to `Write(~/.ariadne/self-repair-pipeline/**)` for parity with `triage-investigator`.

Audit of stale unversioned paths in `.claude/agents/` and `.claude/skills/self-repair-pipeline/` (README, SKILL.md, reference/) found none beyond the intentional legacy migration references in `migrate_legacy_state.ts` and the `## Migrating from a Pre-Run-Namespaced Pipeline` section.

Verified end-to-end against the existing `sqlx` run: the script outputs run-namespaced absolute paths. Full skill test suite (24 files / 218 tests) passes; `pnpm typecheck` clean.
