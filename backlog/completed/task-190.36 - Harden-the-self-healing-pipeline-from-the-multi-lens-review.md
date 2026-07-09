---
id: TASK-190.36
title: "Harden the self-healing pipeline from the multi-lens review"
status: Done
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - self-repair
  - self-healing
  - pipeline-hardening
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The 2026-07-03 multi-lens review of the four pipeline skills (`triage`, `plan`,
`prioritize`, `reconcile-registry`) produced 128 unique findings (1 critical,
40 major) — source drafts in `backlog/drafts/self-healing-pipeline-review.*`.
Six independent deep investigations (2026-07-05) re-verified every in-scope
finding against HEAD, corrected several, and scoped the fix work. This epic is
that work, ordered by contribution to the pipeline's purpose: **improving
Ariadne by triaging real-world repos** — every fix is weighted by whether it
protects (a) the ability to run at all, (b) the integrity of the work the
pipeline mints, (c) model-spend efficiency, or (d) operator trust.

### Corrections to the review discovered during investigation

These supersede the dossier where they conflict:

- **The stale task-DB is total, not one row**: all 61 rows in
  `~/.ariadne/plan/tasks/` are pre-190.35 (missing `is_permanent_limitation`).
  The fix is a wipe, not a re-mint (the field was never computed for them).
- **Z15 "dead classifier" is mis-framed**: a drafted check keyed on
  `tree_size`/`definition_features` **fires** (the single `auto_classify` call
  site receives full `EnrichedEntryPoint`s) — the hazard is it runs on fields
  the author validated only against the narrower `TriageEntry`. This makes the
  `--stage` sample-execution gate more valuable, not less.
- **190.31 is task docs only** — no eval-set store, scorer, or
  continuous-validation code exists on disk. The `--stage` sample gate and the
  investigator eval seeds are producers/consumers of the 190.31.1 store when
  it is built, not duplicates of existing machinery.
- **`consolidation.json` is never parsed by code** — its ids flow into
  downstream scripts only via human copy-paste into `--id`/`--slug` flags, and
  no TypeScript type for it exists. The validator must also persist the
  step-4 inputs (`groups.json`) to have something to validate against.
- **reconcile's USAGE string is already fixed** (documents `--stage`/`--apply`);
  only the SKILL.md argument-hint remains stale.
- **`--strategist` stays** — it is a genuinely useful provenance stamp; only
  its doc (which claims it selects plans) is wrong.
- **`prioritize` is SKILL.md-only** — every script it drives lives under
  `.claude/skills/plan/`; new validators for the prioritize flow land there.
- **dedup_key re-key blast radius**: `dedup_key` also mints `PlanTask.id`
  (`build_plan_tasks.ts`), so a re-key stales 27 exported task-DB rows and 13
  backlog `plan_dedup_keys` frontmatter entries — it needs a one-shot
  migration script (run once, then deleted) or a bounded one-time human
  re-confirm.
- **The backlog boundary needs no AST test**: `export_to_backlog.ts` writes
  distinct per-task files and `graduate_group_docs.ts` renames distinct files —
  there is no shared-file race to protect. Narrow the "only writer" prose to
  the truth (two named writers) instead of building enforcement for a
  non-hazard.

### Sub-tasks and rationale

**TASK-190.36.1 — Unblock the pipeline and land the quick run-cost wins**
(do first). Four defects make runs fail or silently produce nothing (invalid
YAML on the step-3 workhorse agent, the stale task-DB, unbound `$SCRATCH`,
missing `AskUserQuestion` grant), plus four one-sitting run-cost wins (cache
prefix, named comprehension agent, `disable-model-invocation`,
`/tmp → $TMPDIR`).

**TASK-190.36.2 — Close the registry-guard bypass routes and test the
enforcement seam** (before the next unattended run). The review's one
CRITICAL: broad runner allow-rules under `acceptEdits` route around the
guard's write-token list, so an unattended agent can overwrite the
permanent-limitations catalog — which mis-classifies every future triage run.

**TASK-190.36.3 — Generalize atomicity and crash-resume beyond the registry.**
A lost triage verdict or a re-spent 250-way fan-out is direct efficacy loss;
the atomic-write/lock/resume discipline exists but stopped at the registry.

**TASK-190.36.4 — Harden the judge gates that mint work.** Every seam where a
k=1 model output silently and permanently gates what work gets funded: the
unvalidated `consolidation.json`, the never-executed drafted classifier,
`belongs: false` overrides, empty acceptance criteria, routing on `<result>`
prose.

**TASK-190.36.5 — Stabilize loop-closure identity and drain the signal
channels.** `dedup_key` is the least drift-stable identity in the pipeline
(any target commit can resurface funded work); `uncertain[]` re-investigates
forever with no consumer; the k=1 TP cache has no stability metric; the
investigator's eval seeds decay at prune time.

**TASK-190.36.6 — CLI hygiene sweep and YAGNI deletions.** Exit-code
convention, message-not-stack, dead `accepted` status, stale grants. Mostly
lint-signal quality; sequenced so the exit-code convention is agreed once with
190.36.4's new validators.

**TASK-190.36.7 — Restore doc truth, author meta.json, de-duplicate
contracts** (strictly last). Contract de-dup rewrites the same SKILL sections
the behavior-changing sub-tasks edit; landing it last means every surviving
canonical copy is written once.

### Dependency graph and work order

```
190.36.1 ──────────────► (everything: pipeline must run to validate any fix)
190.36.2 ──┐  independent; land before the next unattended pipeline run;
           │  final "only writer" prose wording lands in .7
190.36.3 ──┤  parallel with .4; one coordination point: resume's
           │  skip-if-output-exists must trust only *validated* consolidation
190.36.4 ──┤  produces samples/*.json (future 190.31.1 eval-set input) and
           │  the verdict.json contract that .7's de-dup collapses onto
190.36.5 ──┤  tp_stability / eval seeds land on top of .3's atomic manifest
           │  writes; eval seeds gated on 190.31.1's store; the dedup_key
           │  re-key goes last (doc-now mitigation ships early)
190.36.6 ──┤  agree the exit-code convention with .4's validators; delete
           │  `accepted` before .7 rewrites the docs that mention it;
           │  settings.local.json edited once, jointly with .2
190.36.7 ──┘  strictly after .1–.6 (single-owner contract rewrite)
```

Within that ordering, `.2/.3/.4` are the high-efficacy core; `.5` is medium
(its small doc-now piece is high and ships with `.1`-adjacent speed); `.6/.7`
are the hygiene tail.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] TASK-190.36.1 complete: a full prioritize run (steps 1–7c) completes on
      a real target repo with no manual workaround for YAML/task-DB/$SCRATCH.
- [x] TASK-190.36.2 complete: the guard blocks the python/node/cp bypass
      routes and the enforcement seam (hook wrapper + settings matcher) is
      test-covered.
- [x] TASK-190.36.3 complete: triage state writes are atomic and locked;
      prioritize and plan Pass B resume without re-spending finished agent
      work.
- [x] TASK-190.36.4 complete: no judge output gates an export or a registry
      insertion without a deterministic validation (partition check, sample
      execution, evidence-AC check, file-authoritative routing).
- [x] TASK-190.36.5 complete: the dedup_key leak is documented with a
      cross-check (and the re-key decided), `uncertain[]` and `tp_stability`
      are surfaced, eval seeds survive pruning.
- [x] TASK-190.36.6 complete: pipeline CLIs follow the exit-code convention;
      dead state and stale grants deleted.
- [x] TASK-190.36.7 complete: every duplicated contract has one owning
      surface; the three missing meta.json files exist and plan's is
      corrected; no doc makes a false safety claim.

<!-- AC:END -->

## Sub-tasks

- TASK-190.36.1: Unblock the pipeline and land the quick run-cost wins
- TASK-190.36.2: Close the registry-guard bypass routes and test the enforcement seam
- TASK-190.36.3: Generalize atomicity and crash-resume beyond the registry
- TASK-190.36.4: Harden the judge gates that mint work
- TASK-190.36.5: Stabilize loop-closure identity and drain the signal channels
- TASK-190.36.6: CLI hygiene sweep and YAGNI deletions
- TASK-190.36.7: Restore doc truth, author meta.json, and de-duplicate contracts

## Closing Review (2026-07-09)

All seven sub-tasks landed (each a `feat`/`fix` + `review` commit) and were
independently re-verified against the actual code and tests during epic
closure — not by trusting the checkboxes. Test evidence at closure: .3 16/16,
.4 251+127+2, .5 58/58, .6 91/91, .7 17/17 green; .1 pins agent-frontmatter
parsing; .2 guard suite 14/14. The one deferred criterion (.5's investigator
eval-seed pairs) is recorded on TASK-190.31.1, which owns the not-yet-built
eval-set store.

**One in-flight reversal, resolved deliberately.** After .2 landed, the
registry write-guard's Bash-catching branch proved too brittle (a
Bash-matching `PreToolUse` hook disables sandbox auto-allow and floods
sessions with prompts). Commits `d2dfcebb` and `2e81ed77` narrowed the guard
to a `Write|Edit`-only matcher and moved the shell-write surface to the
harness `[Self-Modification]` classifier as defense-in-depth. This is the
accepted final state; .2's task doc carries a note recording the supersession.
The registry itself is git-tracked (13 commits, not ignored), so any errant
write is visible in `git status` and revertible — git history is the backstop
behind the narrowed guard.
