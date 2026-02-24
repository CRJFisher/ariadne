---
id: task-191.1
title: 'Track A: Benchmark Evaluation (Data + Backend)'
status: To Do
assignee: []
created_date: '2026-02-24 09:59'
labels: []
dependencies: []
parent_task_id: task-191
priority: low
---

## Description

Run standardized benchmarks with and without Ariadne MCP to produce credible, reproducible numbers. This is the data capture, processing, and analysis track — the "backend" that produces the raw evidence.

Uses the Discovery-Driven Planning approach (see doc-1): start with assumption testing spikes before committing to full benchmark runs. Later sub-tasks are provisional and will be created/refined at decision gates.

## Acceptance Criteria

- [ ] At least one benchmark harness (MCPBR or custom) running Ariadne vs baseline comparison
- [ ] Metrics captured per task: pass/fail, token usage (4 types), tool call count, files explored, wall-clock time, cost
- [ ] Results run 3-5 times per condition with variance reported
- [ ] Data extraction pipeline produces normalized JSON suitable for visualization (Track B input)

## Assumption Register

| ID | Assumption | Confidence | Criticality | Test |
|----|-----------|-----------|-------------|------|
| A1 | MCPBR can run with Claude Code + Ariadne MCP server | LOW | HIGH | Spike: install + try 1 task |
| A2 | SWE-bench tasks meaningfully benefit from call graph tools | MEDIUM | HIGH | Run 5 tasks, compare tool traces |
| A3 | Claude Code native OTEL captures enough data for A/B comparison | HIGH | MEDIUM | Enable OTEL, inspect output |
| A4 | Existing metadata.db hooks capture MCP tool calls with tool_use_id | HIGH | LOW | Query existing DB |
| A5 | JSONL transcripts contain reliable token counts for cost calculation | HIGH | MEDIUM | Parse 3 sessions, cross-check |

## Provisional Sub-Tasks

### Phase 1: Probes (time-boxed spikes, ~1 day)

> These test the riskiest assumptions before committing to implementation.

- **191.1.1** — Spike: MCPBR feasibility test
  - Install MCPBR, configure Ariadne as MCP server under test
  - Run 1 SWE-bench Verified task with and without Ariadne
  - Document: Does it work? What breaks? What's the output format?
  - Time-box: 4 hours
  - Tests: A1

- **191.1.2** — Spike: Ad-hoc session comparison (3 curated tasks)
  - Run 3 tasks manually (`claude --no-mcp -p "..."` vs `claude -p "..."`)
  - Extract JSONL metrics, query metadata.db, check analytics.db linkage
  - Document: What data do we actually get? Are the metrics meaningful?
  - Time-box: 4 hours
  - Tests: A2, A3, A4, A5

### Decision Gate 1

Review spike results. Update assumption register. Create Phase 2 tasks.

### Phase 2: Data Pipeline (provisional, ~2-3 days)

> Created after Decision Gate 1. Tasks below are best-guess placeholders.

- **191.1.3** — Build `extract_metrics.py`: normalized JSON per session
  - Query metadata.db for tool call timeline
  - Parse JSONL for token usage (dedup by message.id)
  - Join analytics.db for Ariadne call durations
  - Compute derived metrics (exploration efficiency, time-to-first-edit, duplicate reads)

- **191.1.4** — Build `run_comparison.sh`: session capture orchestrator
  - Manifest-driven: reads task definitions, runs both conditions
  - Enables OTEL + metadata hooks
  - Captures session IDs back to manifest
  - Ensures same git commit for both runs

### Decision Gate 2

Review pipeline output. Is the data quality sufficient for visualization? Redirect if needed.

### Phase 3: Benchmark at Scale (provisional, ~3-5 days)

> Created after Decision Gate 2. Only if MCPBR proves viable.

- **191.1.5** — Run SWE-bench Verified subset (50 tasks, 3 runs each)
- **191.1.6** — Run SWE-QA (576 tasks, if SWE-bench shows promise)
- **191.1.7** — Statistical analysis and summary report

## Reference

- Parent task: task-191
- Planning framework: doc-1 (Adaptive Planning Frameworks)
- Key tools: [MCPBR](https://github.com/greynewell/mcpbr), [HAL Harness](https://github.com/princeton-pli/hal-harness)
- Data sources: metadata.db, analytics.db, JSONL transcripts, OTEL events
