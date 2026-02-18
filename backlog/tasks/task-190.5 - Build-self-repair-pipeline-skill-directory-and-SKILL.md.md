---
id: task-190.5
title: Build self-repair-pipeline skill directory and SKILL.md
status: Done
assignee: []
created_date: '2026-02-17 16:57'
updated_date: '2026-02-18 10:55'
labels: []
dependencies:
  - task-190.1
  - task-190.2
  - task-190.3
  - task-190.4
parent_task_id: task-190
---

## Description

Create the multi-file skill directory that ties all components together. SKILL.md is the main orchestration document (always in context). It includes a pipeline overview, dynamic state injection via shell command, phase-specific instructions for what Claude should do at each step, and reference links. The reference/ directory documents the state machine and diagnosis routing table. The examples/ directory provides sample output.

The pipeline loads the known-entrypoints registry, classifies entries, triages remaining entries with ternary classification (true-positive / dead-code / false-positive), aggregates results, plans fixes, and finalizes. The registry is the single source of prior classification knowledge for all projects.

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

### SKILL.md Specification

```yaml
---
name: self-repair-pipeline
description: Runs the full entry point self-repair pipeline. Detects entry points, triages false positives via sub-agents, plans fixes for each issue group with competing proposals and multi-angle review, and creates backlog tasks.
disable-model-invocation: true
allowed-tools: Bash(npx tsx:*,pnpm exec tsx:*), Read, Write, Task(triage-investigator, triage-aggregator, triage-rule-reviewer, fix-planner, plan-synthesizer, plan-reviewer, task-writer)
hooks:
  Stop:
    - hooks:
        - type: command
          command: "pnpm exec tsx \"$CLAUDE_PROJECT_DIR/.claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts\""
          timeout: 30
---
```

The SKILL.md body contains:

1. **Pipeline overview** — phases and their purpose
2. **Current state injection** (dynamic):

   ```
   ## Current State
   !`cat entrypoint-analysis/triage_state/*_triage.json 2>/dev/null || echo "No active triage"`
   ```

   This injects the current state file contents when the skill is invoked, giving immediate context.
3. **Phase instructions** — what to do at each phase:
   - **Detect**: `pnpm exec tsx entrypoint-analysis/src/self_analysis/detect_entrypoints.ts`
   - **Prepare**: `pnpm exec tsx .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts ...`
   - **Triage loop**: Read state file → find pending entries → read the appropriate prompt template from `templates/` → construct Task prompts → launch sub-agents → write results to state file
   - **Fix planning**: For each group → read templates → launch fix-planner/synthesizer/reviewer/task-writer sub-agents
   - **Finalize**: `pnpm exec tsx .claude/skills/self-repair-pipeline/scripts/finalize_triage.ts ...`
4. **Reference links**: "For state machine details, see [reference/state_machine.md](reference/state_machine.md)"

### Why This Structure

- **Self-contained**: Everything needed for the pipeline is in one directory
- **Context-efficient**: SKILL.md is always loaded (~2% context budget). Templates and reference docs only load when Claude reads them during execution
- **Maintainable**: Prompt templates are separate files that can be iterated independently
- **Discoverable**: The directory structure makes the pipeline's components obvious

The existing `self-entrypoint-analysis` and `external-entrypoint-analysis` skills get updated to reference this pipeline skill for their triage + fix-planning steps.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SKILL.md has name, description, disable-model-invocation, allowed-tools, and hooks frontmatter
- [x] #2 SKILL.md includes dynamic state injection: cat triage_state/*_triage.json
- [x] #3 SKILL.md documents all 5 phases: detect → prepare → triage loop → fix planning → finalize
- [x] #4 SKILL.md references prompt templates for diagnosis-based routing
- [x] #5 reference/state_machine.md documents all phase transitions and BLOCK/ALLOW logic
- [x] #6 reference/diagnosis_routes.md documents the routing table and escape hatch
- [x] #7 examples/sample_triage_output.json provides example final output
- [x] #8 Skill allowed-tools include Bash(npx tsx:*,pnpm exec tsx:*), Read, Write, Task(all 7 sub-agents)
- [x] #9 SKILL.md frontmatter includes Stop hook pointing to triage_loop_stop.ts
- [x] #10 SKILL.md frontmatter includes `disable-model-invocation: true`
<!-- AC:END -->


## Implementation Plan

1. Create .claude/skills/self-repair-pipeline/ directory structure
2. Create SKILL.md with frontmatter and orchestration instructions
3. Add dynamic state injection section
4. Document phase-specific instructions referencing scripts and agents
5. Create reference/state_machine.md from plan's Stop Hook State Machine section
6. Create reference/diagnosis_routes.md from plan's routing table
7. Create examples/sample_triage_output.json


## Implementation Notes

Created/modified 4 files:

1. **SKILL.md** (rewritten) — Full orchestration document with frontmatter (name, description, disable-model-invocation, allowed-tools with all 7 sub-agents, Stop hook), pipeline overview table, dynamic state injection, 5 phase-specific instruction sections, diagnosis-to-template routing table, and sub-agent summary table.

2. **reference/state_machine.md** — Documents all phase transitions from triage_loop_stop.ts: triage, aggregation, meta-review, fix-planning, complete. Covers BLOCK/ALLOW decisions for each phase including fix-planning sub-phases (planning, synthesis, review, task-writing). Documents constants (REQUIRED_PLANS=5, REQUIRED_REVIEWS=4) and edge cases.

3. **reference/diagnosis_routes.md** — Documents entry classification routes (known-tp, llm-triage), all 6 diagnosis values, diagnosis-to-template routing table (4 templates), ternary classification output format, and the multi-entry FP group escape hatch.

4. **examples/sample_triage_output.json** — Valid JSON matching FinalizationOutput interface with 2 true positives, 1 dead code entry, and 2 false-positive groups (one with task_file, one without).
