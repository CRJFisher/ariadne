---
id: TASK-190.37
title: "reconcile --drift detector must skip non-wip rules"
status: To Do
assignee: []
created_date: "2026-07-15 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - reconcile-registry
  - bug
  - drift
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`reconcile_registry.ts` `detect_drift_proposals` proposes `drift_detected: true`
on any rule a published `classifier_regressions[].rule_id` names, matched by
`group_id` alone with no status guard. But `drift_detected` is a **wip-only**
signal: the registry validator (`known_issues_registry.ts` `validate_entry`)
rejects `status === "permanent" && drift_detected === true` outright, and
`active_rules_for_classification` only acts on drift for wip rows (a wip rule
with `drift_detected` is deactivated pending re-investigation; a permanent rule
is bundled and always active, so the flag is inert). Setting drift on a
permanent rule therefore writes a value the loader refuses — it desyncs the
registry from its own schema, and `load_registry()` throws thereafter.

This is a real defect: a `--drift` run over published regressions that name
permanent rules writes an **invalid registry**. The sibling `wip → fixed`
detector guards correctly (`if (rule.status !== "wip" || ...) continue`), and
the drift detector must do the same.

The fix is not merely to drop permanent-rule regressions on the floor — a
regressed permanent classifier is real signal (its bundled predicate is
under-matching). The detector should skip proposing a drift flag on non-wip
rules, and surface those regressions separately (a reported-only slice, as it
already does for `drift_unknown_rule_ids`) so the human can decide whether to
fix the permanent classifier's predicate directly or demote it. The regression
must never be silently discarded.

### Reproduction

Run `reconcile_registry.ts --drift` when a finalized run's
`classifier_regressions[]` names a `permanent` rule. The proposal is applied,
`registry.json` gains `drift_detected: true` on a permanent row, and
`known_issues_registry.test.ts` (which loads the on-disk registry) fails with
`a permanent entry must not carry drift_detected=true`.

### Scope

- `detect_drift_proposals` (`.claude/skills/triage/scripts/reconcile_registry.ts`):
  skip non-wip rules when building drift proposals; collect permanent/fixed
  rules named by a regression into a new reported-only summary slice
  (e.g. `drift_on_non_wip_rules`) alongside `drift_unknown_rule_ids`.
- Add a `reconcile_registry.test.ts` case: a regression naming a permanent rule
  yields no `drift_detected` proposal and appears in the reported slice.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `detect_drift_proposals` proposes `drift_detected` only for `wip` rules.
- [ ] A regression naming a `permanent` or `fixed` rule is reported in a
      dedicated summary slice, never written as a flag and never silently dropped.
- [ ] `reconcile_registry.test.ts` covers the permanent-rule-regression case.
- [ ] After the fix, `reconcile --drift` over a corpus containing
      permanent-rule regressions leaves `load_registry()` passing.

<!-- AC:END -->

## Cross-references

- The validator invariant this honors: `.claude/skills/triage/src/known_issues_registry.ts` (`validate_entry`, `active_rules_for_classification`)
- The correctly-guarded sibling detector: `detect_drift_proposals` vs the `wip_to_fixed` loop in the same file
- Lifecycle contract: `.claude/rules/classifier-lifecycle.md`
- The reconcile skill: `.claude/skills/reconcile-registry/SKILL.md`
