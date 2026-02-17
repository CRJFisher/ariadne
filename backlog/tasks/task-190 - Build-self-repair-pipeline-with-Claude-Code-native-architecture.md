---
id: task-190
title: Build self-repair pipeline with Claude Code native architecture
status: To Do
assignee: []
created_date: '2026-02-17 16:56'
updated_date: '2026-02-17 16:56'
labels:
  - self-repair
  - entrypoint-analysis
  - claude-code-native
dependencies:
  - task-189
priority: high
---

## Description

Replace the entrypoint-analysis triage pipeline's dependency on `@anthropic-ai/claude-agent-sdk` with a fully Claude Code native self-repair system:

- A **single top-level Claude Code session** orchestrates the pipeline
- **Custom sub-agents** do LLM work in separate contexts, keeping the top-level's context clean
- A **stop hook** reads a **state file** and drives a deterministic loop through phases: detect → triage → aggregate → plan fixes → complete
- **MCP tools** (`show_call_graph_neighborhood`) are available to triage sub-agents for interactive investigation
- **Exhaustive triage** (no `--limit` default) with **diagnosis-based routing** and an escape hatch at each branch
- **Fix planning** per issue group: 5 competing plans → synthesis → multi-angle review → backlog task

**Original plan file**: `~/.claude/plans/zazzy-brewing-gem.md`

### Architecture Overview

```
User invokes skill
        │
        ▼
┌─────────────────────────────────────────────────┐
│ Phase 1: Detection (Bash, no LLM)               │
│ npx tsx detect_entrypoints.ts                    │
│ Output: analysis JSON                            │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│ Phase 2: Prepare State (Bash, no LLM)            │
│ npx tsx prepare_triage.ts                        │
│ - Deterministic classification + routing         │
│ - Creates state file + activation marker         │
│ Output: triage_state/{project}_triage.json       │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│ Phase 3: Triage Loop (stop hook driven)          │
│                                                  │
│  Top-level reads state file                      │
│  Launches batch of triage-investigator           │
│    sub-agents (parallel Task calls)              │
│  Each sub-agent:                                 │
│    - investigates ONE entry (own context)         │
│    - uses MCP tools + Read/Grep                  │
│    - returns minimal classification JSON         │
│  Top-level writes results to state file          │
│  Top-level tries to complete                     │
│                                                  │
│  Stop Hook: triage_loop_stop.ts                  │
│    Reads state file                              │
│    Pending entries? → BLOCK                      │
│    All triaged? → transition to aggregation      │
│    Aggregation done? → transition                │
│    Complete? → ALLOW                             │
│                                                  │
│  After all entries: aggregation sub-agent        │
│  After aggregation: meta-review sub-agent        │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│ Phase 4: Fix Planning (stop hook driven)         │
│                                                  │
│  For each issue group:                           │
│  4a. Launch 5 fix-planner sub-agents             │
│  4b. Launch plan-synthesizer sub-agent           │
│  4c. Launch 4 plan-reviewer sub-agents           │
│  4d. Launch task-writer sub-agent                │
│                                                  │
│  Stop hook drives sub-phases per group           │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│ Phase 5: Finalize (Bash, no LLM)                 │
│ npx tsx finalize_triage.ts                       │
│ - Formats output JSON                            │
│ - Updates known-entrypoints registry             │
│ - Removes activation marker                      │
└─────────────────────────────────────────────────┘
```

### Design Decision: Stop Hook Loop vs Agent Teams

Stop hooks are the primary orchestration mechanism. Agent teams are deferred as follow-up work.

**Why stop hook + batched sub-agents (chosen)**:

| Factor | Assessment |
|--------|------------|
| Stability | Stop hooks are a stable, production API. This project already has 5 stop hooks running reliably. |
| Determinism | The state file + stop hook gives a fully deterministic state machine. Phase transitions are code, not natural language coordination. |
| Parallelism | Achieved via multiple Task tool calls in a single message. Controllable. |
| Context management | Sub-agent results are minimal (one JSON block each). The top-level context stays clean across 16+ batches. |
| Resumability | State file persists on disk. If the session is interrupted, re-running picks up where it left off. |
| Debuggability | State file is human-readable JSON. Each phase transition is logged. |

**Why not agent teams (deferred)**:

| Factor | Assessment |
|--------|------------|
| Experimental | Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. API may change. |
| Coordination overhead | Lead coordinates via natural language + mailbox. Phase transitions rely on interpretation, not deterministic code. |
| No nesting | Teammates can't spawn sub-agents. |
| Token cost | Each teammate has a full independent context window running continuously. |

**Evolution path**: The state file is the key abstraction — it works with both approaches. If agent teams stabilize, replace the stop hook loop with a `TeammateIdle` hook. The state machine transitions remain identical. `prepare_triage.ts` and `finalize_triage.ts` are unchanged.

### Skill Directory Structure

```
.claude/skills/self-repair-pipeline/
├── SKILL.md                              # Main orchestration (always in context)
├── scripts/
│   ├── prepare_triage.ts                 # State file initialization (no LLM)
│   ├── finalize_triage.ts                # Output formatting + cleanup (no LLM)
│   └── triage_loop_stop.ts              # Stop hook: state machine driver
├── templates/
│   ├── prompt_callers_not_in_registry.md # Investigation prompt for this diagnosis
│   ├── prompt_resolution_failure.md      # Investigation prompt for this diagnosis
│   ├── prompt_wrong_target.md            # Investigation prompt for this diagnosis
│   ├── prompt_generic.md                 # Escape-hatch investigation prompt
│   └── backlog_task_template.md          # Template for task-writer output
├── reference/
│   ├── state_machine.md                  # State machine phase documentation
│   └── diagnosis_routes.md               # Routing table + escape hatch docs
└── examples/
    └── sample_triage_output.json         # Example final output for reference
```

### File Summary

| Action | File | Purpose |
|--------|------|---------|
| **Create** | `.claude/skills/self-repair-pipeline/SKILL.md` | Main orchestration instructions |
| **Create** | `.claude/skills/self-repair-pipeline/scripts/prepare_triage.ts` | Deterministic setup: classify + route + build state file |
| **Create** | `.claude/skills/self-repair-pipeline/scripts/finalize_triage.ts` | Deterministic output: format results + update registry |
| **Create** | `.claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts` | Stop hook: state machine driving the loop |
| **Create** | `.claude/skills/self-repair-pipeline/templates/prompt_*.md` | Investigation prompt templates (4 files) |
| **Create** | `.claude/skills/self-repair-pipeline/templates/backlog_task_template.md` | Template for task-writer output |
| **Create** | `.claude/skills/self-repair-pipeline/reference/state_machine.md` | State machine documentation |
| **Create** | `.claude/skills/self-repair-pipeline/reference/diagnosis_routes.md` | Routing table + escape hatch docs |
| **Create** | `entrypoint-analysis/src/triage_state_types.ts` | TypeScript interfaces for state file |
| **Create** | `.claude/agents/triage-investigator.md` | Sub-agent: investigates one entry using MCP tools |
| **Create** | `.claude/agents/triage-aggregator.md` | Sub-agent: groups false positives by root cause |
| **Create** | `.claude/agents/triage-rule-reviewer.md` | Sub-agent: identifies new deterministic rules |
| **Create** | `.claude/agents/fix-planner.md` | Sub-agent: proposes fix plan for an issue group |
| **Create** | `.claude/agents/plan-synthesizer.md` | Sub-agent: synthesizes 5 competing plans |
| **Create** | `.claude/agents/plan-reviewer.md` | Sub-agent: reviews plan from specific angle |
| **Create** | `.claude/agents/task-writer.md` | Sub-agent: creates backlog task from reviewed plan |
| **Modify** | `.claude/settings.json` | Add stop hook pointing to skill scripts dir |
| **Modify** | `entrypoint-analysis/src/classify_entrypoints.ts` | Add diagnosis-based routing |
| **Modify** | `entrypoint-analysis/.gitignore` | Add `triage_state/` |
| **Modify** | `.claude/skills/self-entrypoint-analysis/SKILL.md` | Reference self-repair-pipeline for triage step |
| **Modify** | `.claude/skills/external-entrypoint-analysis/SKILL.md` | Reference self-repair-pipeline for triage step |
| **Modify** | `entrypoint-analysis/package.json` | Remove `@anthropic-ai/claude-agent-sdk` dep |
| **Delete** | `entrypoint-analysis/src/agent_queries.ts` | Replaced by sub-agents |

Old triage scripts (`triage_false_positives.ts`, `triage_entry_points.ts`) are kept for comparison, deleted after validation.

### Edge Cases

- **Sub-agent failure**: Entry marked as `status="failed"` with error message. Pipeline continues. Failed entries appear in final output.
- **State file corruption**: Stop hook wraps reads in try/catch. If unparsable → ALLOW (don't block forever).
- **Resume after interruption**: State file persists. Re-running skill picks up from where it left off.
- **Empty triage set**: All entries classified deterministically → stop hook skips straight to aggregation → fast completion with zero LLM cost.
- **stop_hook_active=true**: Always ALLOW to prevent infinite loops. The hook re-fires after Claude's next response with `stop_hook_active=false`.

### Follow-up: Agent Teams for Collaborative Sub-tasks

Three sub-task types would benefit from agent teams (once the experimental API stabilizes):

1. **Entry triage**: Team of 3 haiku investigators instead of 1 sonnet investigator. Teammates share discoveries via mailbox, reducing redundant investigation. Potential ~50% cost reduction.

2. **Fix planning**: Team of 5 planners instead of 5 independent fix-planner sub-agents. Planners share code findings, making the synthesis step lighter.

3. **Plan review**: Team of 4 reviewers instead of 4 independent plan-reviewer sub-agents. Reviewers build on each other's findings for more coherent feedback.

**Status**: Implement the core pipeline with independent sub-agents first. Add team variants once the experimental API stabilizes and the pipeline is proven. The state file abstraction supports both approaches without redesign.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stop-hook-driven state machine replaces SDK-based triage orchestration
- [ ] #2 Custom sub-agents handle all LLM work in isolated contexts
- [ ] #3 Multi-file skill directory contains all scripts, templates, and reference docs
- [ ] #4 Diagnosis-based routing sends entries to specialized investigation prompts
- [ ] #5 Fix planning pipeline produces backlog tasks for each false positive group
- [ ] #6 Pipeline is resumable via persistent state file
- [ ] #7 @anthropic-ai/claude-agent-sdk dependency removed
- [ ] #8 Full pipeline verified on core package (self-analysis) and external project
<!-- AC:END -->
