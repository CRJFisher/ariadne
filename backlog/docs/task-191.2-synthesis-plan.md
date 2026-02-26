# Task 191.2 Implementation Plan - Execution Realignment

## Summary

This plan defines Track B implementation details for `task-191.2` with decision-complete scope for Phase 2 and Phase 3. It is grounded in the completed Phase 1 spike and aligns directly to the acceptance criteria consumed by Track C.

## Locked Decisions

- `analytics.db` is optional diagnostics only.
- Phase 2 metric scope is acceptance-criteria core metrics, plus Navigation Waste Ratio as the headline display metric.
- CLI shape is subcommands.

## Critical Discoveries

1. **`analytics.db` `tool_use_id` sparsity confirms analytics is not a reliable primary join path.** Only 7 of 532 sampled records had `tool_use_id`, and analytics sessions are often in a different ID space from Claude Code session rows.
2. **MCP tool calls are not visible in JSONL transcripts.** `metadata.db` is the canonical source for MCP call timeline and durations.
3. **JSONL dedup is mandatory.** The same `message.id` appears multiple times, and token totals must use last-wins dedup per `message.id`.

---

## Architecture

### Core Pipeline (Required)

```text
Pass 1: metadata.db  -> tool timeline, session boundaries, MCP durations (Pre/Post delta)
Pass 2: JSONL        -> deduped token usage + model + cost
Pass 3: Derivation   -> core derived metrics + data quality
```

Each pass is a pure function keyed by `session_id`, and outputs compose into one normalized per-session JSON document.

### Optional Analytics Diagnostics (Non-Blocking)

`analytics.db` is read only for supplemental diagnostics.

- Primary diagnostics join: direct `tool_use_id` only.
- Optional probe-only fuzzy matching: best-effort and explicitly marked low-confidence.
- Any analytics failure or no-match condition produces warnings only and never blocks extraction output.

---

## File Structure

```text
demo/session-comparison/
|- extract_metrics.py          # Core pipeline + CLI
|- run_comparison.sh           # Session capture orchestrator
|- manifest.json               # Task definitions + run records
|- output/                     # Generated normalized JSON
|  |- {session_id}.json
|  |- comparison_{task_id}.json
`- fixtures/                   # Frozen fixtures for tests
   |- create_fixtures.py
   `- *.json
```

## Dependency Policy

Phase 2 is stdlib-only for extraction and tests. Primary modules: `sqlite3`, `json`, `pathlib`, `argparse`, `datetime`, `collections`, `unittest`.

---

## Public Interfaces (Frozen)

### CLI Contract

```bash
python extract_metrics.py list-sessions [--ariadne] [--limit N]
python extract_metrics.py probe <session_id_prefix>
python extract_metrics.py extract <session_id_prefix> [--out PATH]
python extract_metrics.py extract-pair <s1_prefix> <s2_prefix> [--task-id TASK_ID] [--out PATH]
```

### Normalized JSON Contract (Per Session)

Required top-level sections:

- `session`
- `tokens`
- `cost`
- `tool_calls`
- `files`
- `mcp_calls`
- `derived`
- `data_quality`

```json
{
  "schema_version": "1.0.0",
  "session": {
    "session_id": "string",
    "condition": "baseline | ariadne",
    "task_id": "string | null",
    "task_description": "string | null",
    "start_time": "ISO 8601",
    "end_time": "ISO 8601",
    "wall_clock_ms": 0,
    "model": "string",
    "git_commit": "string | null"
  },
  "tokens": {
    "input": 0,
    "output": 0,
    "cache_read": 0,
    "cache_creation": 0,
    "total": 0
  },
  "cost": {
    "input_usd": 0.0,
    "output_usd": 0.0,
    "cache_read_usd": 0.0,
    "cache_creation_usd": 0.0,
    "total_usd": 0.0,
    "pricing_model": "string"
  },
  "tool_calls": {
    "total": 0,
    "by_category": {
      "read": 0,
      "search": 0,
      "edit": 0,
      "bash": 0,
      "mcp": 0,
      "other": 0
    },
    "by_tool": {
      "Read": 0,
      "Grep": 0
    }
  },
  "files": {
    "total_unique": 0,
    "read": ["string"],
    "edited": ["string"],
    "read_then_edited": ["string"],
    "read_not_edited": ["string"]
  },
  "mcp_calls": {
    "duration_source": "metadata_pre_post",
    "total": 0,
    "by_tool": {
      "list_entrypoints": { "count": 0, "total_duration_ms": 0, "avg_duration_ms": 0 },
      "show_call_graph_neighborhood": { "count": 0, "total_duration_ms": 0, "avg_duration_ms": 0 }
    }
  },
  "derived": {
    "exploration_efficiency": 0.0,
    "navigation_waste_ratio": 0.0,
    "time_to_first_edit_ms": 0,
    "duplicate_read_count": 0,
    "backtracking_count": 0
  },
  "data_quality": {
    "warnings": ["string"],
    "errors": ["string"],
    "metadata_events_count": 0,
    "jsonl_raw_line_count": 0,
    "jsonl_lines_with_usage": 0,
    "jsonl_dedup_message_count": 0,
    "analytics_diagnostics": {
      "enabled": false,
      "join_method": "none | tool_use_id | fuzzy_timestamp",
      "direct_joins": 0,
      "fuzzy_joins": 0,
      "unmatched": 0,
      "warning": "string | null"
    }
  }
}
```

### Timeline Token Attribution Scope

Per-event token fields (`tokens_used`, `cumulative_tokens`) are out of scope for Phase 2 and are not required in the Track C input contract.

### Tool Category Mapping

| Category | Tools |
| --- | --- |
| `read` | `Read` |
| `search` | `Grep`, `Glob`, `WebSearch`, `WebFetch` |
| `edit` | `Edit`, `Write`, `MultiEdit`, `NotebookEdit` |
| `bash` | `Bash` |
| `mcp` | `mcp__ariadne__list_entrypoints`, `mcp__ariadne__show_call_graph_neighborhood` |
| `other` | `Task`, `TodoRead`, `TodoWrite`, and all unmapped tools |

---

## Metrics Scope

### Required Core Metrics (Phase 2)

- Token usage: input, output, cache read, cache creation, total.
- Tool calls: total, by category, by tool.
- File activity: total unique files, read list, edited list, read-then-edited, read-not-edited.
- Wall-clock time.
- Cost from pricing table.
- MCP durations from `metadata.db` PreToolUse -> PostToolUse delta.

### Required Derived Metrics (Phase 2)

- `exploration_efficiency`
- `time_to_first_edit_ms`
- `duplicate_read_count`
- `backtracking_count`
- `navigation_waste_ratio` (headline metric for demos)

### Deferred Metrics and Analysis (Phase 4)

The following are outside extractor implementation scope:

- Statistical testing (`Mann-Whitney U`, bootstrap confidence intervals, alpha/noise-floor interpretation)
- Advanced derived metrics with unresolved semantics (`reads_before_first_correct_edit`, per-event token attribution)

---

## Session Capture Orchestration

### `manifest.json` Schema

```json
{
  "manifest_version": "1.0.0",
  "environment": {
    "model": "claude-opus-4-6-20250219",
    "git_commit": "string",
    "ariadne_version": "string",
    "claude_code_version": "string"
  },
  "tasks": [
    {
      "task_id": "string",
      "description": "string",
      "prompt": "string",
      "repo_path": ".",
      "setup_commands": ["string"]
    }
  ],
  "runs": [
    {
      "run_id": "uuid",
      "task_id": "string",
      "condition": "baseline | ariadne",
      "session_id": "uuid",
      "started_at": "ISO 8601",
      "completed_at": "ISO 8601",
      "exit_code": 0,
      "output_json": "output/{session_id}.json"
    }
  ]
}
```

### `run_comparison.sh` Execution Rules

1. Interleave baseline and Ariadne runs per task.
2. Randomize condition order per task.
3. Pre-generate session IDs and persist in manifest.
4. Validate pre-flight conditions (`git`, `metadata.db`, Claude Code).
5. Isolate MCP config per condition.
6. Run extraction immediately after each capture and persist output paths.

### Curated Task Set (Minimum)

At least 3 real Ariadne codebase tasks must be captured and extracted:

1. Cross-file rename.
2. Feature addition with dependency traversal.
3. Failing-test root-cause debugging.

---

## JSONL Parsing Strategy

- Deduplicate by `message.id` with last-wins semantics.
- Ignore malformed JSONL lines without failing extraction.
- Determine model from deduplicated message usage records.
- Compute cost via pricing table with prefix-compatible model lookup.

---

## Analytics Diagnostics Strategy

Analytics diagnostics are optional and warning-only.

- Default mode: direct `tool_use_id` diagnostics only.
- Probe mode may enable fuzzy timestamp matching for investigation.
- Fuzzy matches must be labeled low-confidence due to false-match risk.
- Missing `analytics.db` always degrades gracefully.

---

## Implementation Sequence

### Phase 1 (191.2.1) - Completed

`extract_metrics.py` probe/list-sessions spike is complete and validated assumptions against real data.

### Phase 2 (191.2.2) - Core Extractor

1. Finalize `extract` output contract exactly as defined above.
2. Keep MCP duration source canonical: metadata Pre/Post delta.
3. Emit analytics diagnostics as optional non-blocking fields.
4. Finalize derived metrics to Phase 2 required set only.
5. Finalize subcommand CLI and prefix-match behavior.

### Phase 2b (191.2.2 continued) - Fixtures and Tests

```bash
python fixtures/create_fixtures.py
python -m unittest discover -s demo/session-comparison -p '*_test.py'
```

Test categories:

- JSONL dedup correctness and malformed input handling.
- `metadata.db` session boundary and tool timeline extraction.
- MCP duration extraction via Pre/Post pairing.
- Derived metric formulas with deterministic fixtures.
- CLI error handling for ambiguous prefixes and missing sessions.
- Optional analytics diagnostics behavior when DB is missing/unmatched.

### Phase 3 (191.2.3) - Orchestrator

1. Build `manifest.json` and `run_comparison.sh` capture flow.
2. Capture and extract at least 3 curated task pairs.
3. Persist pair-level outputs (`comparison_{task_id}.json`).

### Phase 4 (191.2.4) - Optional Enrichment

Join benchmark outcomes (Track A) with extracted session metrics and run statistical analysis. This phase is additive and does not gate Track B completion.

---

## Test Cases and Scenarios

1. Repeated `message.id` with increasing `output_tokens` resolves by last-wins.
2. Malformed JSONL lines are skipped without crashing extractor.
3. Tool call timeline is ordered by `PostToolUse` timestamp.
4. Session boundaries handle both Stop-present and Stop-missing cases.
5. Pre/Post MCP pairs produce complete duration coverage where tool IDs exist.
6. Analytics diagnostics never fail extraction when `analytics.db` is missing.
7. End-to-end extraction produces one per-session JSON and one paired comparison JSON.

---

## Acceptance Criteria Mapping

| Acceptance Criterion | Output / Artifact |
| --- | --- |
| AC #1 Normalized JSON from metadata + JSONL + analytics | `extract` JSON uses metadata + JSONL as required and includes optional analytics diagnostics |
| AC #2 Core metrics | `tokens`, `tool_calls`, `files`, `session.wall_clock_ms`, `cost`, `mcp_calls` |
| AC #3 Derived metrics | `derived` contains exploration efficiency, time-to-first-edit, duplicate reads, backtracking |
| AC #4 JSON schema documented | This document section "Normalized JSON Contract" is the Track C interface |
| AC #5 At least 3 curated task pairs captured/extracted | `manifest.json` run records + `output/` session/pair JSON artifacts |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Schema drift from Track C expectations | MEDIUM | HIGH | Freeze contract in this document and validate sample output before Track C work |
| JSONL transcript missing or path mismatch | MEDIUM | MEDIUM | Transcript-path-first lookup, fallback search, and warning-only degradation |
| Curated task-pair capture incompletion | MEDIUM | HIGH | Define tasks up front in manifest and enforce run checklist |
| JSONL dedup implementation error | LOW | HIGH | Fixture tests for duplicate message IDs and malformed lines |
| Misuse of analytics as primary MCP source | LOW | MEDIUM | Keep analytics in diagnostics-only section with explicit non-blocking semantics |

---

## Assumptions and Defaults

- Pricing lookup is prefix-compatible for short model IDs.
- Session IDs accept prefix input and fail clearly on ambiguous matches.
- `analytics.db` is non-blocking diagnostics by default.
- Standard-library test tooling is the default for Track B.
