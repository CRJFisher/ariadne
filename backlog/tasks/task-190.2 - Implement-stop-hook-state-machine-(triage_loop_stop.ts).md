---
id: task-190.2
title: Implement stop hook state machine (triage_loop_stop.ts)
status: To Do
assignee: []
created_date: '2026-02-17 16:56'
labels: []
dependencies:
  - task-190.1
parent_task_id: task-190
---

## Description

Create the stop hook script that drives the triage loop as a deterministic state machine. The hook reads the state file, determines the current phase, and either BLOCKs (with instructions for what Claude should do next) or ALLOWs (pipeline complete). Phase transitions: triage → aggregation → meta-review → fix-planning → complete. The hook only activates when .claude/triage_active marker exists, ensuring zero overhead for non-pipeline sessions.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hook reads state file path from .claude/triage_active marker
- [ ] #2 Phase=triage: BLOCKs with batch instructions when pending entries exist, transitions to aggregation when all done
- [ ] #3 Phase=aggregation: BLOCKs until aggregator completes, transitions to meta-review or complete
- [ ] #4 Phase=meta-review: BLOCKs until rule-reviewer completes, transitions to fix-planning or complete
- [ ] #5 Phase=fix-planning: drives per-group sub-phases (planning → synthesis → review → task-writing → complete)
- [ ] #6 stop_hook_active=true always ALLOWs (prevents infinite loops)
- [ ] #7 State parse errors ALLOW with logged warning (never blocks forever)
- [ ] #8 No marker file → ALLOW immediately (zero overhead)
- [ ] #9 BLOCK reason messages contain specific instructions for what Claude should do next
- [ ] #10 .claude/settings.json updated to register the stop hook
<!-- AC:END -->

## Implementation Plan

1. Create .claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts
2. Implement stdin JSON parsing for stop hook input (reads stop_hook_active flag)
3. Implement marker file check (.claude/triage_active)
4. Implement phase-specific logic matching the State Machine section in the plan
5. Implement fix-planning sub-phase tracking (planning/synthesis/review/task-writing/complete per group)
6. Add stop hook registration to .claude/settings.json
7. Test with mock state files at each phase transition
