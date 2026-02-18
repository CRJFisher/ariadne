---
id: task-190.2
title: Implement stop hook state machine (triage_loop_stop.ts)
status: Done
assignee: []
created_date: '2026-02-17 16:56'
updated_date: '2026-02-18 10:23'
labels: []
dependencies:
  - task-190.1
parent_task_id: task-190
---

## Description

Create the stop hook script that drives the triage loop as a deterministic state machine. The hook discovers the state file via glob (`entrypoint-analysis/triage_state/*_triage.json`), determines the current phase, and either BLOCKs (with instructions for what Claude should do next) or ALLOWs (pipeline complete). Phase transitions: triage → aggregation → meta-review → fix-planning → complete. The hook is scoped to the skill's YAML frontmatter, so it only fires while the `/self-repair-pipeline` skill is active — zero overhead for non-pipeline sessions.

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

### Stop Hook State Machine

**File**: `.claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts`

Activation: scoped to the skill's YAML frontmatter — only fires while `/self-repair-pipeline` is active. Discovers state file via glob `entrypoint-analysis/triage_state/*_triage.json`.

```
Input: { stop_hook_active: boolean, ... }

if stop_hook_active → ALLOW (prevent infinite loops)
if no state file    → ALLOW (nothing to triage)
if state parse error → ALLOW (log error, don't block forever)

Phase transitions:

  phase="triage"
    pending entries exist?
      YES → BLOCK: "N entries need triage. Read state file at {path},
             find the next batch of pending entries, and launch
             triage-investigator sub-agents for each."
      NO  → mutate phase→"aggregation" → BLOCK: "All entries triaged.
             Launch triage-aggregator sub-agent with state file at {path}."

  phase="aggregation"
    aggregation.status?
      null/pending → BLOCK: "Launch triage-aggregator sub-agent."
      "completed"  → has escape-hatch entries?
                       YES → mutate phase→"meta-review"
                             → BLOCK: "Launch triage-rule-reviewer."
                       NO  → mutate phase→"complete" → ALLOW
      "failed"     → mutate phase→"complete" → ALLOW (log warning)

  phase="meta-review"
    meta_review.status?
      null/pending → BLOCK: "Launch triage-rule-reviewer."
      "completed"  → has FP groups with >1 entry?
                       YES → mutate phase→"fix-planning", init groups
                             → BLOCK: "Begin fix planning for group X."
                       NO  → mutate phase→"complete" → ALLOW
      "failed"     → mutate phase→"complete" → ALLOW

  phase="fix-planning"
    find first group where sub_phase != "complete":
      sub_phase="planning"
        plans_written < 5?
          → BLOCK: "Launch fix-planner sub-agents for group {id}.
                    {5 - plans_written} plans still needed.
                    Write plans to {fix_plans_dir}/{group_id}/plan_{n}.md"
        plans_written == 5?
          → mutate sub_phase→"synthesis"
          → BLOCK: "Launch plan-synthesizer for group {id}.
                    Read all 5 plans in {fix_plans_dir}/{group_id}/"

      sub_phase="synthesis"
        synthesis_written?
          → mutate sub_phase→"review"
          → BLOCK: "Launch 4 plan-reviewer sub-agents for group {id}."
        else → BLOCK: "Launch plan-synthesizer for group {id}."

      sub_phase="review"
        reviews_written < 4?
          → BLOCK: "Launch plan-reviewer sub-agents for group {id}.
                    {4 - reviews_written} reviews still needed."
        reviews_written == 4?
          → mutate sub_phase→"task-writing"
          → BLOCK: "Launch task-writer for group {id}.
                    Read synthesis + reviews, create backlog task."

      sub_phase="task-writing"
        task_file set?
          → mutate sub_phase→"complete" → continue to next group
        else → BLOCK: "Launch task-writer for group {id}."

    all groups complete?
      → mutate phase→"complete" → ALLOW

  phase="complete" → ALLOW
```

The BLOCK reason message tells Claude exactly what to do next, ensuring deterministic progression.

**No-nesting constraint**: Sub-agents cannot spawn other sub-agents. The top-level agent directly launches all sub-agents. Sub-agents write their output to files on disk, and subsequent sub-agents read from those files.

### Hook Registration

The hook is registered in the skill's YAML frontmatter (`.claude/skills/self-repair-pipeline/SKILL.md`), scoping it to only fire while the skill is active:

```yaml
---
hooks:
  Stop:
    - hooks:
        - type: command
          command: "pnpm exec tsx \"$CLAUDE_PROJECT_DIR/.claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts\""
          timeout: 30
---
```

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hook discovers state file via glob `entrypoint-analysis/triage_state/*_triage.json`
- [x] #2 Phase=triage: BLOCKs with batch instructions when pending entries exist, transitions to aggregation when all done
- [x] #3 Phase=aggregation: BLOCKs until aggregator completes, transitions to meta-review or complete
- [x] #4 Phase=meta-review: BLOCKs until rule-reviewer completes, transitions to fix-planning or complete
- [x] #5 Phase=fix-planning: drives per-group sub-phases (planning → synthesis → review → task-writing → complete)
- [x] #6 stop_hook_active=true always ALLOWs (prevents infinite loops)
- [x] #7 State parse errors ALLOW with logged warning (never blocks forever)
- [x] #8 No state file found → ALLOW immediately
- [x] #9 BLOCK reason messages contain specific instructions for what Claude should do next
- [x] #10 Hook registered in skill YAML frontmatter (not global settings.json)
<!-- AC:END -->


## Implementation Plan

1. Create .claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts
2. Implement stdin JSON parsing for stop hook input (reads stop_hook_active flag)
3. Implement state file discovery via glob (`entrypoint-analysis/triage_state/*_triage.json`)
4. Implement phase-specific logic matching the State Machine section in the plan
5. Implement fix-planning sub-phase tracking (planning/synthesis/review/task-writing/complete per group)
6. Test with mock state files at each phase transition


## Implementation Notes

- Created `.claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts` with phase handler architecture: `handle_triage`, `handle_aggregation`, `handle_meta_review`, `handle_fix_planning`
- Each handler returns a `PhaseResult` (`{ decision, reason, mutated }`) — the main loop writes state only when `mutated` is true
- 29 tests in `triage_loop_stop.test.ts` covering: state file discovery, FP entry filtering, multi-entry grouping, all phase transitions, fix-planning sub-phases, multi-group progression
- Named constants `REQUIRED_PLANS` (5) and `REQUIRED_REVIEWS` (4) for magic numbers
- BLOCK reason messages name the specific sub-agent to launch (e.g., `**triage-investigator**`, `**fix-planner**`) and file path conventions
