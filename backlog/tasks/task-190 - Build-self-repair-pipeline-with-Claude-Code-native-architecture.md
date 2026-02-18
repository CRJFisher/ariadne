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
├── package.json                          # Standalone deps (tsx, typescript, clinic)
├── tsconfig.json
├── src/                                  # Library code (pure functions + types)
│   ├── types.ts                          # Core analysis types
│   ├── triage_state_types.ts             # State file interfaces
│   ├── analysis_io.ts                    # I/O helpers for analysis files
│   ├── extract_entry_points.ts           # Entry point extraction from analysis JSON
│   ├── classify_entrypoints.ts           # Deterministic classification + routing
│   ├── known_entrypoints.ts              # Known-entrypoints registry lookup
│   ├── build_triage_entries.ts           # Convert classifications → triage entries
│   ├── build_finalization_output.ts      # Format final output from triage state
│   └── *.test.ts                         # Co-located tests
├── scripts/
│   ├── detect_entrypoints.ts             # Unified detection (--config / --path / --github)
│   ├── prepare_triage.ts                 # State file initialization (no LLM)
│   ├── finalize_triage.ts                # Output formatting + cleanup (no LLM)
│   └── triage_loop_stop.ts              # Stop hook: state machine driver
├── project_configs/                      # Per-project detection configs
│   ├── core.json                         # packages/core self-analysis config
│   ├── mcp.json                          # packages/mcp self-analysis config
│   └── types.json                        # packages/types self-analysis config
├── known_entrypoints/                    # Known-entrypoints registry (per project)
│   ├── core.json
│   ├── mcp.json
│   ├── types.json
│   └── projections.json
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

| Location | File | Purpose |
|----------|------|---------|
| `SKILL.md` | Main orchestration instructions | Always loaded in context when skill is invoked |
| `package.json` | Standalone dependencies | tsx, typescript, clinic (no SDK dependency) |
| `src/types.ts` | Core analysis types | Shared type definitions |
| `src/triage_state_types.ts` | State file interfaces | TriageState, TriageEntry, FixPlanningState |
| `src/analysis_io.ts` | I/O helpers | Reading/writing analysis files |
| `src/extract_entry_points.ts` | Entry point extraction | Parse analysis JSON into entry points |
| `src/classify_entrypoints.ts` | Deterministic classification | Diagnosis-based routing for triage |
| `src/known_entrypoints.ts` | Registry lookup | Match entries against known-entrypoints registry |
| `src/build_triage_entries.ts` | Triage entry builder | Convert classifications → triage entries |
| `src/build_finalization_output.ts` | Output formatter | Format triage state into final output |
| `scripts/detect_entrypoints.ts` | Unified detection script | `--config` / `--path` / `--github` modes |
| `scripts/prepare_triage.ts` | State file setup | Deterministic classify + route + build state file |
| `scripts/finalize_triage.ts` | Output + cleanup | Format results + update known-entrypoints registry |
| `scripts/triage_loop_stop.ts` | Stop hook | State machine driving the triage loop |
| `project_configs/*.json` | Per-project configs | Detection configs for core, mcp, types |
| `known_entrypoints/*.json` | Entrypoint registries | Known-entrypoints per project |
| `templates/prompt_*.md` | Investigation prompts | Diagnosis-specific prompt templates (4 files) |
| `templates/backlog_task_template.md` | Task template | Template for task-writer output |
| `reference/state_machine.md` | State machine docs | Phase documentation |
| `reference/diagnosis_routes.md` | Routing docs | Routing table + escape hatch docs |
| `.claude/agents/triage-investigator.md` | Sub-agent | Investigates one entry using MCP tools |
| `.claude/agents/triage-aggregator.md` | Sub-agent | Groups false positives by root cause |
| `.claude/agents/triage-rule-reviewer.md` | Sub-agent | Identifies new deterministic rules |
| `.claude/agents/fix-planner.md` | Sub-agent | Proposes fix plan for an issue group |
| `.claude/agents/plan-synthesizer.md` | Sub-agent | Synthesizes 5 competing plans |
| `.claude/agents/plan-reviewer.md` | Sub-agent | Reviews plan from specific angle |
| `.claude/agents/task-writer.md` | Sub-agent | Creates backlog task from reviewed plan |

All files are under `.claude/skills/self-repair-pipeline/` unless an absolute path is shown.

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

## Implementation Notes

### Architecture Re-structuring (task-190.7)

The `entrypoint-analysis/` top-level directory has been fully merged into `.claude/skills/self-repair-pipeline/`:

- **Library code** (`entrypoint-analysis/src/`) → `src/` (types, classification, extraction, known-entrypoints, triage entries, finalization output)
- **Detection scripts** → `scripts/detect_entrypoints.ts` (unified from the former `detect_self_entrypoints.ts` + `detect_external_entrypoints.ts`)
- **Project configs** → `project_configs/{core,mcp,types}.json` replace `--package` for self-analysis. Each config specifies the analysis path, known-entrypoints file, and package metadata.
- **Known-entrypoints registry** → `known_entrypoints/{core,mcp,types,projections}.json` (migrated from `entrypoint-analysis/known_entrypoints/`)

### Skill Consolidation

The `self-entrypoint-analysis` and `external-entrypoint-analysis` skills have been deleted. `self-repair-pipeline` is the single skill entry point. Detection is invoked via:

- **Self-analysis**: `npx tsx scripts/detect_entrypoints.ts --config project_configs/core.json`
- **External analysis**: `npx tsx scripts/detect_entrypoints.ts --path /path/to/project`
- **GitHub analysis**: `npx tsx scripts/detect_entrypoints.ts --github owner/repo`

### SDK Removal

`@anthropic-ai/claude-agent-sdk` has been removed. `entrypoint-analysis/src/agent_queries.ts` is deleted. All LLM work is handled by Claude Code sub-agents via the Task tool.
