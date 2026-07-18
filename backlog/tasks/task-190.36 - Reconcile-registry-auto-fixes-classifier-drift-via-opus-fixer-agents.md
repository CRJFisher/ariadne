---
id: TASK-190.36
title: "Reconcile-registry auto-fixes classifier drift via opus fixer agents"
status: To Do
assignee: []
created_date: "2026-07-14 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - self-healing
  - reconcile-registry
  - drift
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`reconcile-registry` detects classifier drift and records it, but stops there.
When a permanent rule's `classifier_regressions[]` accumulate across triage
runs, `reconcile_registry.ts --drift` sets `drift_detected: true` and appends
the missing cases as `drift_evidence[]` rows. Those rows are a to-do list a
human must later act on by hand-editing the rule's `check_<group_id>.ts`
predicate. The drift signal is mechanical; closing it is not.

This task closes the loop inside the skill. After the drift-flag write lands,
`reconcile-registry` dispatches one **opus fixer agent per drifted rule** to
repair that rule's `BuiltinCheckFn` so it captures the evidence it was missing.
Each agent owns exactly one `check_<group_id>.ts`, works from that rule's
`drift_evidence[]` plus the current predicate, and runs to one of two
termination states:

1. **Captured** — the predicate is broadened/corrected so every evidence case
   now matches, guarded by tests (the evidence cases as positive fixtures, plus
   a negative guard so the broadening does not start matching a known
   true-positive), and core rebuilds green.
2. **Mis-classified** — one or more evidence cases are a *different*
   permanent-limitation pattern, not this rule's. The agent must not stretch the
   predicate to cover them (that would suppress real true-positives). It records
   which cases belong elsewhere and **notifies the user** that a new classifier
   is needed — handing off to the `classifier-author` flow rather than
   corrupting this rule.

The precision/recall tension is the crux: a drifted classifier fires on too few
cases (low recall), but the fix must not swing to firing on real unreachable
functions (low precision) — those are exactly the true-positives the pipeline
exists to surface. The termination condition encodes that: capture only what is
genuinely the same limitation; escalate the rest.

### Fixability triage before any classifier work

The registry is the permanent-limitations catalog: a pattern belongs there only
when supporting it in Ariadne's static analysis is impractical. Before any
evidence case is absorbed into a classifier — by broadening this rule's
predicate or by escalating toward a new classifier — the fixer assesses
fixability: could Ariadne resolve this call relationship with a modest fix (a
bug fix or contained feature, not a large overhaul)? A fixable case terminates
in a third state, **fixable-in-Ariadne**: the agent records the case with its
fixability rationale and surfaces it to the user as a backlog-task proposal.
It is never captured (broadening a predicate over a fixable bug would
permanently suppress it from triage) and never handed to `classifier-author`
(the hand-off is reserved for patterns that are genuinely impractical to
support). Capture and mis-classified escalation both apply only to cases the
fixability check has ruled permanent.

### Constraint surfaced during the first manual run

`drift_evidence[]` rows are deduped by `entry_index` alone and carry only
`{ entry_index, evidence_excerpt }` — the row does **not** record which
`{ project, run_id }` the `entry_index` came from. A fixer agent therefore
cannot reliably resolve an `entry_index` back to its full `EnrichedEntryPoint`
via `get_entry_context.ts`, and must reason from the `evidence_excerpt` (the
grep call-site line, sometimes the investigator's full diagnosis) alone. The
predicate operates on the entry's `diagnostics.grep_call_sites`, so working
from a single excerpt line is lossy. This task should extend the drift-evidence
schema (and the reconcile detector that writes it) to carry `{ project,
run_id }` per row so the fixer agent can pull the real entry context, and
dedupe by `(project, entry_index)` rather than `entry_index` alone.

### Relationship to sibling tasks

This is the concrete, `reconcile-registry`-owned instance of the "automatic
refinement of regressed `BuiltinCheckFn`s" that TASK-190.31.2 gestures at from
the eval-set direction. TASK-190.31.1 builds growable eval-sets as the ground
truth; this task refines a classifier from the drift evidence a run already
published, without waiting on the eval-set store. The two converge: once
eval-sets exist, the fixer agent should validate its broadened predicate
against the rule's eval-set (precision + recall) before the change is accepted,
so a fix that raises recall at the cost of precision is caught mechanically.

The fixer edits `check_<group_id>.ts` only — an ordinary source edit, not a
registry write, so the write-guard (TASK-190.33) is not involved. For a
`permanent` rule the edit does not touch the bundled `permanent_data.ts` slice
(that references the check by `function_name`, it does not inline the body), but
core must be rebuilt for the compiled predicate to update.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] After a `--drift` apply, `reconcile-registry` dispatches one opus fixer
      agent per rule with an applied drift proposal (a flag flip or fresh
      evidence this run), each scoped to a single `check_<group_id>.ts` and
      handed the rule's full accumulated `drift_evidence[]`.
- [ ] Each agent terminates in exactly one recorded state per evidence case:
      captured (predicate now matches, test added), fixable-in-Ariadne
      (surfaced to the user as a backlog-task proposal with the fixability
      rationale), or mis-classified (escalated to the user with the cases that
      need a separate classifier).
- [ ] No evidence case reaches capture or a `classifier-author` hand-off
      without the fixability check ruling it a permanent limitation: a case
      Ariadne could support with a modest fix routes to a backlog-task
      proposal, never into a classifier.
- [ ] Every "captured" fix ships a test that asserts the evidence cases now
      match AND a negative guard asserting a known true-positive still does not
      match; core rebuilds and the classifier test suite is green.
- [ ] The skill never over-broadens silently: a case the agent cannot capture
      without risking true-positive suppression is escalated, never absorbed.
- [ ] `drift_evidence[]` rows carry `{ project, run_id }` and dedupe by
      `(project, entry_index)`, so a fixer agent can resolve a case back to its
      full `EnrichedEntryPoint` via `get_entry_context.ts`.
- [ ] The mis-classified escalation hands off to the `classifier-author` flow
      (a novel permanent-limitation group), consistent with the
      classifier-lifecycle contract.

<!-- AC:END -->

## Cross-references

- Drift detector and evidence writer: `.claude/skills/triage/scripts/reconcile_registry.ts`
- The skill this upgrades: `.claude/skills/reconcile-registry/SKILL.md`
- Classifier builtins the fixer edits: `packages/core/src/classify_entry_points/builtins/check_<group_id>.ts`
- Eval-set ground truth this converges with: TASK-190.31.1, TASK-190.31.2
- Human-owns-registry enforcement the fixer stays clear of: TASK-190.33
- Novel-group hand-off for mis-classified cases: `.claude/agents/classifier-author.md`
- Lifecycle contract: `.claude/rules/classifier-lifecycle.md`
