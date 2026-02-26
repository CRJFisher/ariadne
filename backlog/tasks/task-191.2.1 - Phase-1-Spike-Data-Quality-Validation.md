---
id: task-191.2.1
title: 'Phase 1 Spike: Data Quality Validation'
status: Done
assignee: []
created_date: '2026-02-25 16:11'
updated_date: '2026-02-25 16:12'
labels: []
dependencies: []
parent_task_id: task-191.2
---

## Description

Build extract_metrics.py with --probe mode that validates three data sources (metadata.db, JSONL, analytics.db) and produces data quality report. Includes Decision Gate 1.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `extract_metrics.py` with 4-pass pipeline (metadata.db, JSONL, analytics.db, derived)
- [x] #2 `list-sessions` command showing recent sessions with metadata
- [x] #3 `list-sessions --ariadne` filtering to sessions with MCP calls
- [x] #4 `probe <session_id>` producing valid JSON to stdout and quality report to stderr
- [x] #5 JSONL dedup produces correct token totals (last-wins by message.id)
- [x] #6 MCP durations computed from Pre-Post timestamp delta
- [x] #7 Derived metrics (navigation waste, exploration efficiency, backtracking) produce non-trivial values
- [x] #8 Decision Gate 1 documented with assumption validation results
<!-- AC:END -->


## Implementation Notes

### File Created

- `demo/session-comparison/extract_metrics.py` — Single-file 4-pass pipeline, zero external dependencies (stdlib only)

### Decision Gate 1 Results

#### Assumption Register (Updated)

| ID | Assumption | Status | Finding |
|----|-----------|--------|---------|
| A3 | OTEL/metadata.db captures enough for A/B | **PASS** | metadata.db has complete tool call timeline with timestamps, tool_use_id, file paths. 72k events, 519 sessions. |
| A4 | metadata.db hooks capture MCP with tool_use_id | **PASS** | MCP calls fully captured. tool_use_id populated for all MCP events. Pre-Post timestamp delta gives reliable duration (avg 386ms for show_call_graph_neighborhood). |
| A5 | JSONL contains reliable token counts | **PASS** | Dedup (last-wins by message.id) reduces ~3x. Token totals are consistent. Cost calculation produces reasonable amounts ($6-12/session for opus). |
| A4b | analytics.db cross-join via tool_use_id | **CONFIRMED LOW** | Only 7 of 532 analytics.db records have tool_use_id. analytics.db sessions are MCP server sessions (different ID space from Claude Code sessions). Fuzzy timestamp matching has zero overlap because analytics.db records come from headless test sessions, not from Claude Code hook-instrumented sessions. |
| A4c | MCP duration available without analytics.db | **PASS** | metadata.db PreToolUse→PostToolUse timestamp delta provides 100% MCP duration coverage. analytics.db join is unnecessary for duration data. |

#### Go/No-Go: **GO for Phase 2**

All critical assumptions validated:

1. **metadata.db tool call timeline**: PASS — complete, ordered, with file paths
2. **Session boundaries**: PASS — 75%+ have Stop events, last-event fallback works
3. **JSONL dedup**: PASS — 2.9-3.4x dedup ratio, correct token totals
4. **MCP durations**: PASS — Pre-Post delta gives 100% coverage, avg 337-386ms
5. **Derived metrics meaningful**: PASS — Navigation waste ratio clearly differentiates sessions (72.7% ariadne vs 95.2% baseline in sampled pair)
6. **Enough sessions**: PASS — 19 ariadne sessions, plenty of baseline sessions available

#### Key Findings for Phase 2

- analytics.db enrichment is **not needed** for core pipeline. metadata.db Pre-Post delta is the primary MCP duration source.
- `file_path` column in metadata.db only populated for Read/Edit/Write. For Grep/Glob/MCP, extract from `tool_input_json`.
- JSONL model field uses short names (e.g., `claude-opus-4-6`) not full model IDs. Pricing lookup needs prefix matching.
- analytics.db sessions are MCP server-level sessions (randomUUID per MCP connection), not Claude Code conversation sessions. Cross-DB join is effectively tool_use_id-only.
