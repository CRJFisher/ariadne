---
id: TASK-190.15
title: Run self-healing skill over representative multi-language codebases
status: To Do
assignee: []
created_date: '2026-04-15 21:54'
labels:
  - self-healing
  - integration-test
  - multi-language
dependencies: []
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run the self-healing pipeline skill over 20 large, mature, open-source codebases covering all four languages Ariadne supports (JavaScript, TypeScript, Python, Rust). The goal is to exercise the pipeline against a wide variety of real-world language constructs and paradigms, surface any false positives or parse failures, and build confidence that the pipeline generalises beyond the Ariadne self-analysis case.

The 20 repos are grouped into 5 per language as subtasks 190.13.1–190.13.20.

Each subtask runs the pipeline via: `npx tsx scripts/detect_entrypoints.ts --github owner/repo` and records the output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All 20 repos processed without pipeline crash
- [ ] #2 Any false positives or parse failures documented per-repo
- [ ] #3 Summary of findings across all 20 repos written up
<!-- AC:END -->
