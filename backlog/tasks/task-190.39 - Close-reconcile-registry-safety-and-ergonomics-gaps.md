---
id: TASK-190.39
title: "Close reconcile-registry safety and ergonomics gaps"
status: To Do
assignee: []
labels:
  - self-repair
  - classifier-lifecycle
  - reconcile-registry
  - dx
parent_task_id: TASK-190
priority: medium
created_date: "2026-07-16 00:00"
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

A single drift-remediation session — recording drift on 7 classifiers, fixing
their predicates, then authoring and staging 5 new ones — exercised the
`reconcile-registry` surface end to end and hit repeated friction. This task
collects the safety and ergonomics gaps in the skill's **existing** commands:
deterministic script changes, each independently landable, each valuable now.

Scope boundary: `TASK-190.36` builds a *new* capability on this skill (opus
fixer agents that auto-repair drifted classifiers). This task hardens the
primitives that already exist and is orthogonal to it — none of the items below
depend on the fixer-agent automation, and all of them are worth doing whether or
not it is ever built. The specific detector bug this session exposed is
`TASK-190.37`; the drift-evidence schema gap is recorded in `TASK-190.36`.

Each gap is stated symptom → cause → direction.

### 1. reconcile can write a registry its own loader rejects

**Symptom.** `reconcile --drift` applied `drift_detected` to permanent rules and
committed the write, producing a registry `load_registry()` throws on. Nothing in
the reconcile run noticed; it surfaced two steps later when
`known_issues_registry.test.ts` loaded the on-disk registry in the pre-commit
suite.

**Cause.** `reconcile_registry.ts` trusts its own proposals — it folds them and
`atomic_update_registry`-writes without re-running `validate_registry` (the full
per-entry gate) against the folded result.

**Direction.** Validate the folded registry inside the `atomic_update_registry`
mutator and throw before returning the write, aborting the transaction and
releasing the lock. `TASK-190.37` fixes the one detector that emitted an invalid
proposal; this makes reconcile structurally unable to persist an invalid registry
no matter which detector regresses next.

### 2. No inverse operation: reconcile can set drift but never clear it

**Symptom.** Once the drift flags were recognized as invalid, no reconcile
command could remove them. Removal fell back to
`git checkout <ref> -- registry.json`, run by the human through the
`[Self-Modification]` gate — a raw git write bypassing reconcile's locked,
validated write path.

**Cause.** The drift signal is append-only and one-directional by design; there
is no `--clear-drift` counterpart.

**Direction.** Add a sanctioned clear path (e.g. `--id <group_id> --clear-drift`)
removing `drift_detected`/`drift_evidence` through `atomic_update_registry`, so
even undoing a mistake stays inside the locked, validated, human-gated writer.

### 3. `--stage`'s sample gate is unsatisfiable when the corpora are gone

**Symptom.** `--stage` requires `samples/*.json` (real `EnrichedEntryPoint`s from
`get_entry_context.ts --enriched`) beside the draft and refuses `--apply` on any
miss. The `~/.ariadne/triage-entrypoints/repos/` checkouts were absent, and
because `drift_evidence` dedups by `entry_index` alone — dropping
`{project, run_id}` (see `TASK-190.36`) — the flagged entries could not be
resolved back to their runs. Staging the 5 classifiers required hand-built
synthetic samples, which weakens the gate to a formality.

**Cause.** The gate assumes the classifier-author persisted samples from a live
corpus at authoring time, with no fallback when the corpus is unavailable or the
evidence cannot address it.

**Direction.** Persist the `EnrichedEntryPoint` sample at drift-record time
alongside the evidence, and/or let `--stage` accept the drafted check's test
fixtures as samples, and/or downgrade a miss to an explicit `--allow-synthetic`
path that records the provenance so promotion review can see the gate was
softened.

### 4. Drafting output shape does not match `--stage` input shape

**Symptom.** The 5 new classifiers were drafted as `check_*.ts` +
`check_*.test.ts` + `proposal.md`. `--stage` consumes `draft_entry.json` +
`samples/*.json`. Every classifier needed a manual translation from proposal
prose into the `KnownIssue` draft plus synthetic samples.

**Cause.** Two producers exist — the `classifier-author` agent (emits the
`--stage` shape) and ordinary code-first drafting (emits code + tests) — and only
one matches the consumer.

**Direction.** Either make every drafting path emit `--stage`-ready artifacts
beside the check, or teach `--stage` to assemble the `KnownIssue` from a check
plus a small proposal manifest, making the code-first path first-class.

### 5. Integration is N repetitive, human-gated passes with no batch path

**Symptom.** Landing 5 classifiers meant, per classifier: move two files into
`builtins/`, hand-edit the `index.ts` barrel (import + `BUILTIN_CHECKS` entry),
rebuild core, build a `draft_entry.json`, run `--stage --apply` — each apply its
own `[Self-Modification]` approval. Five near-identical passes, five approvals.

**Cause.** `--stage` takes one draft per invocation, the barrel edit is manual,
and there is no multi-draft transaction.

**Direction.** Stage multiple drafts in one validated `atomic_update_registry`
transaction (one approval), and generate the barrel entry from each draft's
`function_name` so code-side placement is not a hand edit.

### 6. (Latent, non-goal) the permanent slice renders whole rule objects

`render_permanent_slice_module` serializes each permanent rule verbatim, so
triage bookkeeping (`drift_evidence`, `observed_*`) would bundle into core's
`permanent_data.ts` if it ever reached a permanent row. Currently moot — the
validator plus `TASK-190.37` keep drift off permanent rows — but the renderer
being a verbatim projection rather than a classification-only one is a latent
sharp edge. Recorded, not actioned, unless another bookkeeping field starts
leaking into the bundle.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] reconcile re-validates the folded registry inside the write transaction and
      cannot persist a state `validate_registry` rejects.
- [ ] A sanctioned `--clear-drift` (or equivalent) removes drift through
      `atomic_update_registry`, so undoing a drift write needs no raw git write.
- [ ] `--stage` can be satisfied without a live corpus, and a softened
      sample gate records its provenance for promotion review.
- [ ] The drafting flow and `--stage` agree on one artifact shape.
- [ ] Multiple drafts stage in one validated transaction, and the barrel entry is
      generated rather than hand-edited.

<!-- AC:END -->

## Cross-references

- The new capability built on this skill (orthogonal): `TASK-190.36`
- The wip-only drift guard this session's defect became: `TASK-190.37`
- The skill and its script: `.claude/skills/reconcile-registry/SKILL.md`, `.claude/skills/triage/scripts/reconcile_registry.ts`
- Lifecycle contract (human-owned writes, the `[Self-Modification]` gate): `.claude/rules/classifier-lifecycle.md`
- The permanent-slice renderer: `packages/types/src/known_issues.ts` (`render_permanent_slice_module`)
