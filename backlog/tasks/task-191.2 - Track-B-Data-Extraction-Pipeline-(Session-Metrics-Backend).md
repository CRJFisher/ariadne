---
id: task-191.2
title: 'Track B: Data Extraction Pipeline (Session Metrics Backend)'
status: In Progress
assignee: []
created_date: '2026-02-24 12:00'
updated_date: '2026-02-26 00:00'
labels: []
dependencies: []
parent_task_id: task-191
priority: low
---

## Description

Build the data extraction pipeline that produces normalized JSON per session from `metadata.db` + JSONL transcripts, with optional diagnostics from `analytics.db`. Includes session capture orchestration and derived metrics. The output is the contract consumed by task-191.3 (Visualization).

Uses the Discovery-Driven Planning approach (see doc-1): start with a data quality validation spike before committing to pipeline implementation.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Normalized JSON per session from metadata.db + JSONL + analytics.db
- [ ] #2 Metrics: token usage (4 types), tool call count, files explored, wall-clock time, cost, MCP durations
- [ ] #3 Derived metrics: exploration efficiency, time-to-first-edit, duplicate reads, backtracking
- [ ] #4 JSON schema documented (contract for task-191.3)
- [ ] #5 At least 3 curated task pairs captured and extracted
<!-- AC:END -->

## Assumption Register

| ID | Assumption | Confidence | Criticality | Spike Result |
|----|-----------|-----------|-------------|-------------|
| A3 | Claude Code native OTEL captures enough data for A/B comparison | HIGH | MEDIUM | **PASS** - metadata.db has complete tool call timeline (72k events, 519 sessions) |
| A4 | Existing metadata.db hooks capture MCP tool calls with tool_use_id | HIGH | LOW | **PASS** - MCP calls captured with Pre-Post duration (avg 337-386ms) |
| A5 | JSONL transcripts contain reliable token counts for cost calculation | HIGH | MEDIUM | **PASS** - 2.9-3.4x dedup ratio, $6-12/session for opus |
| A4b | analytics.db is suitable as a primary MCP duration source | LOW | LOW | **CONFIRMED LOW** - 7/532 records with `tool_use_id`; analytics is optional diagnostics, metadata Pre-Post is canonical |

## Provisional Sub-Tasks

### Phase 1: Probe (time-boxed spike, ~1 day)

> Tests data quality assumptions before committing to pipeline implementation.

- **191.2.1** - Spike: Ad-hoc session data quality validation
  - Run 3 tasks manually (`claude --no-mcp -p "..."` vs `claude -p "..."`)
  - Query metadata.db for tool call timeline
  - Parse JSONL for token usage
  - Check analytics.db linkage via tool_use_id
  - Document: What data do we actually get? Are the metrics meaningful?
  - Time-box: 4 hours
  - Tests: A3, A4, A5

### Decision Gate 1 - **GO for Phase 2**

All critical assumptions validated. Data quality is sufficient. metadata.db Pre-Post delta provides canonical MCP duration coverage, and analytics remains optional diagnostics.

### Phase 2: Data Pipeline (provisional, ~2-3 days)

> Created after Decision Gate 1. Tasks below are implementation scope.

- **191.2.2** - Build `extract_metrics.py`: normalized JSON per session
  - Query metadata.db for tool call timeline
  - Parse JSONL for token usage (dedup by `message.id`)
  - Compute MCP durations from metadata PreToolUse -> PostToolUse deltas
  - Include analytics.db join stats as optional diagnostics only (warning-only)
  - Compute derived metrics:
    - **Exploration efficiency**: files_read_then_edited / total_files_read
    - **Time to first edit**: elapsed ms from session start to first Edit/Write
    - **Duplicate reads**: files read more than once
    - **Backtracking**: re-reads of previously visited files
    - **Navigation waste ratio**: files_read_not_edited / total_files_read

- **191.2.3** - Build `run_comparison.sh` + `manifest.json`: session capture orchestrator
  - Manifest-driven: reads task definitions, runs both conditions
  - Enables OTEL + metadata hooks
  - Captures session IDs back to manifest
  - Ensures same git commit for both runs
  - Captures and extracts at least 3 curated task pairs

### Decision Gate 2

Review pipeline output. Is the data quality sufficient for visualization? Are the derived metrics meaningful?

### Phase 3: Enrichment (optional, additive)

- **191.2.4** - Enrich benchmark results with session metrics
  - For task-191.1 runs that had OTEL enabled, extract per-task tool traces
  - Join benchmark pass/fail outcomes with session-level behavioral metrics
  - Additive - benchmark results are valid without this enrichment

## Location

`demo/session-comparison/` at repo root.

## Reference

- Parent task: task-191
- Consumed by: task-191.3 (Visualization)
- Planning framework: doc-1 (Adaptive Planning Frameworks)
- Data sources: metadata.db, analytics.db, JSONL transcripts, OTEL events
- Key patterns: JSONL token dedup (Pattern 2 in task-191), cost calculation (Pattern 3), cross-DB linkage (Pattern 6)

## Implementation Notes

### Phase 1 Spike (191.2.1) - Completed

Created `demo/session-comparison/extract_metrics.py`: single-file pipeline with zero external dependencies.

Current implemented commands:

- `list-sessions [--ariadne] [--limit N]`
- `probe <session_id_prefix>`

Phase 2 command contract:

- `extract <session_id_prefix> [--out PATH]`
- `extract-pair <s1_prefix> <s2_prefix> [--task-id TASK_ID] [--out PATH]`

Validated on real data:

- Probed session `dd63d90d` (ariadne, 144 tools, 8 MCP): nav waste 72.7%, cost $12.00
- Probed session `5f5cd88d` (baseline, 513 tools, 0 MCP): nav waste 95.2%, cost $6.90
- 19 ariadne sessions available, 500+ baseline sessions

### Acceptance Criteria Mapping

- **AC #1**: `extract` output uses metadata + JSONL and includes optional analytics diagnostics fields.
- **AC #2**: `tokens`, `tool_calls`, `files`, `session.wall_clock_ms`, `cost`, `mcp_calls` provide required metric coverage.
- **AC #3**: `derived` includes exploration efficiency, time-to-first-edit, duplicate reads, backtracking.
- **AC #4**: JSON schema is documented in `backlog/docs/task-191.2-synthesis-plan.md` and consumed by Track C.
- **AC #5**: `manifest.json` plus `output/` session and pair artifacts demonstrate at least 3 curated task pairs.

### Testing Scope (Phase 2)

Stdlib-first test strategy (`unittest`) with fixture-backed cases:

- JSONL dedup correctness and malformed line handling
- metadata session boundary and ordered timeline extraction
- MCP Pre/Post duration pairing coverage
- Derived metric formulas (including navigation waste ratio)
- CLI prefix-match ambiguity and missing-session errors
- Optional analytics diagnostics behavior when DB is missing/unmatched
