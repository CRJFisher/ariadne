---
id: DRAFT-3
title: Extract deterministic classification rules from triage history
status: Draft
assignee: []
created_date: "2026-04-15 16:03"
labels:
  - self-repair-pipeline
  - classification
dependencies: []
parent_task_id: TASK-190
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

After running the self-repair pipeline on one or more projects, the triage history accumulates a set of confirmed false-positive groups with known root causes. Many of these root causes are structural patterns (barrel re-exports, cross-package calls, dynamic dispatch, etc.) that can be detected deterministically without LLM involvement.

This task extracts classification rules from historical triage output and integrates them into the `classify_entrypoints.ts` deterministic classifier, reducing the volume of entries that need LLM triage on future runs.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A script or tool exists that reads historical triage output and proposes candidate deterministic rules
- [ ] #2 Rules are expressed in a format compatible with the existing classify_entrypoints.ts rule structure
- [ ] #3 At least one rule extracted from real triage history is implemented and tested
- [ ] #4 pnpm test passes
<!-- AC:END -->
