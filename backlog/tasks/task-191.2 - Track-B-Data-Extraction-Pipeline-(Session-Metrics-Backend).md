---
id: task-191.2
title: 'Track B: Data Extraction Pipeline (Session Metrics Backend)'
status: To Do
assignee: []
created_date: '2026-02-24 12:00'
labels: []
dependencies: []
parent_task_id: task-191
priority: low
---

## Description

Build the data extraction pipeline that produces normalized JSON per session from metadata.db + analytics.db + JSONL transcripts. Includes session capture orchestration and derived metrics. The output is the contract consumed by task-191.3 (Visualization).

Uses the Discovery-Driven Planning approach (see doc-1): start with a data quality validation spike before committing to pipeline implementation.

## Acceptance Criteria

- [ ] Normalized JSON per session from metadata.db + JSONL + analytics.db
- [ ] Metrics: token usage (4 types), tool call count, files explored, wall-clock time, cost, MCP durations
- [ ] Derived metrics: exploration efficiency, time-to-first-edit, duplicate reads, backtracking
- [ ] JSON schema documented (contract for task-191.3)
- [ ] At least 3 curated task pairs captured and extracted

## Assumption Register

| ID | Assumption | Confidence | Criticality | Test |
|----|-----------|-----------|-------------|------|
| A3 | Claude Code native OTEL captures enough data for A/B comparison | HIGH | MEDIUM | Enable OTEL, inspect output |
| A4 | Existing metadata.db hooks capture MCP tool calls with tool_use_id | HIGH | LOW | Query existing DB |
| A5 | JSONL transcripts contain reliable token counts for cost calculation | HIGH | MEDIUM | Parse 3 sessions, cross-check |

## Provisional Sub-Tasks

### Phase 1: Probe (time-boxed spike, ~1 day)

> Tests data quality assumptions before committing to pipeline implementation.

- **191.2.1** — Spike: Ad-hoc session data quality validation
  - Run 3 tasks manually (`claude --no-mcp -p "..."` vs `claude -p "..."`)
  - Query metadata.db for tool call timeline
  - Parse JSONL for token usage
  - Check analytics.db linkage via tool_use_id
  - Document: What data do we actually get? Are the metrics meaningful?
  - Time-box: 4 hours
  - Tests: A3, A4, A5

### Decision Gate 1

Review spike results. Update assumption register. Is the data quality sufficient to build a pipeline? Create Phase 2 tasks.

### Phase 2: Data Pipeline (provisional, ~2-3 days)

> Created after Decision Gate 1. Tasks below are best-guess placeholders.

- **191.2.2** — Build `extract_metrics.py`: normalized JSON per session
  - Query metadata.db for tool call timeline
  - Parse JSONL for token usage (dedup by message.id)
  - Join analytics.db for Ariadne call durations (via tool_use_id)
  - Compute derived metrics:
    - **Exploration efficiency**: files_read_then_edited / total_files_read
    - **Time to first edit**: elapsed ms from session start to first Edit/Write
    - **Duplicate reads**: files read more than once
    - **Backtracking**: re-reads of previously visited files

- **191.2.3** — Build `run_comparison.sh` + `manifest.json`: session capture orchestrator
  - Manifest-driven: reads task definitions, runs both conditions
  - Enables OTEL + metadata hooks
  - Captures session IDs back to manifest
  - Ensures same git commit for both runs

### Decision Gate 2

Review pipeline output. Is the data quality sufficient for visualization? Are the derived metrics meaningful?

### Phase 3: Enrichment (optional, additive)

- **191.2.4** — Enrich benchmark results with session metrics
  - For task-191.1 runs that had OTEL enabled, extract per-task tool traces
  - Join benchmark pass/fail outcomes with session-level behavioral metrics
  - Additive — benchmark results are valid without this enrichment

## Location

`demo/session-comparison/` at repo root.

## Reference

- Parent task: task-191
- Consumed by: task-191.3 (Visualization)
- Planning framework: doc-1 (Adaptive Planning Frameworks)
- Data sources: metadata.db, analytics.db, JSONL transcripts, OTEL events
- Key patterns: JSONL token dedup (Pattern 2 in task-191), cost calculation (Pattern 3), cross-DB linkage (Pattern 6)
