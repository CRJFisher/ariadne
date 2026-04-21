---
id: TASK-190.16.10
title: >-
  Update triage-investigator for residual-only workflow with feedback + drift
  monitoring
status: To Do
assignee: []
created_date: "2026-04-17 14:38"
labels:
  - self-repair
  - auto-classifier
  - agent
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - .claude/agents/triage-investigator.md
  - .claude/skills/self-repair-pipeline/scripts/finalize_aggregation.ts
  - .claude/skills/self-repair-pipeline/templates/prompt.md
parent_task_id: TASK-190.16
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase D (D1 + D2 + D3).

**D1 — Triage agent updates.** `.claude/agents/triage-investigator.md`: replace "investigate every entry" with residual-only guidance:

1. Auto-classifier already ran; treat `{{classifier_hints}}` as the strongest prior.
2. Check decorators first.
3. Consult `packages/core/src/index_single_file/query_code_tree/queries/unsupported_features.{lang}.md` when captures are missing.
4. When emitting a `group_id` not in the registry, prefix with `novel:` so the feedback loop picks it up.

**D2 — Feedback loop.** `scripts/update_registry_from_triage.ts`: run during or after `finalize_aggregation`. Scan triage results for `group_id` values prefixed `novel:` or absent from the registry. When ≥5 entries share a novel group_id, auto-insert a `KnownIssue` with `status: "wip"` and `classifier: { kind: "none" }`. Human promotes to a classifier in a follow-up PR.

**D3 — Drift monitoring.** `scripts/audit_classifier_precision.ts`: for each classifier, compare auto-classifications against any residual entries the agent later reclassified differently. Classifiers whose agreement rate drops below their registered `min_confidence` get tagged `drift_detected: true` on the registry entry (non-blocking, visible in PRs).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `.claude/agents/triage-investigator.md` updated with the 4-step residual-only strategy and `novel:` prefix convention
- [ ] #2 `scripts/update_registry_from_triage.ts` exists and is invoked from `finalize_aggregation.ts` (or runs standalone)
- [ ] #3 Dry-run test: running on fresh project with a novel group_id emitted ≥5 times results in a new registry entry with `status: "wip"` and `classifier.kind: "none"`
- [ ] #4 `scripts/audit_classifier_precision.ts` exists; produces a non-blocking markdown report listing classifiers with measured precision + drift flag (cron-friendly)
- [ ] #5 Drift report test: classifier fixtures engineered to drop below `min_confidence` produce `drift_detected: true` in the report
- [ ] #6 Agent prompt explicitly instructs reading `packages/core/src/index_single_file/query_code_tree/queries/unsupported_features.{lang}.md` when captures are missing
- [ ] #7 Feedback loop never auto-writes a non-`kind: "none"` `ClassifierSpec`; promotion from `wip` to an active classifier is always a human-reviewed PR
<!-- AC:END -->
