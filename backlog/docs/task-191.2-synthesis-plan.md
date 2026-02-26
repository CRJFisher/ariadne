# Task 191.2 Implementation Plan — Synthesized from 5 Planner Agents

## Executive Summary

Five independent planner agents investigated the data extraction pipeline from different angles: (1) extraction architecture and JSON contract, (2) session capture orchestration, (3) metrics design and statistical rigor, (4) cross-DB integration and data quality, (5) DX, testing, and spike design. This document synthesizes their findings into a single implementation plan.

### Critical Discoveries

All five agents converged on three findings that fundamentally reshape the implementation:

1. **analytics.db `tool_use_id` is 1.3% populated, not 86%**. Only 7 of 532 records have `tool_use_id`. The cross-DB join strategy must be dual-path: direct `tool_use_id` when available, timestamp+tool_name fuzzy matching as fallback.

2. **MCP tool calls are invisible in JSONL transcripts**. MCP tools execute within Task subagent contexts and do not appear in the parent session's JSONL. `metadata.db` is the sole source for MCP tool call data; JSONL provides only aggregate tokens.

3. **JSONL dedup is mandatory**. The same `message.id` appears 2–7 times per message (streaming chunks). The LAST occurrence per `message.id` has the correct `output_tokens`. A subtract-and-add or last-wins dedup strategy is required.

### Updated Assumption Register

| ID  | Assumption                                           | Original Confidence | Revised Confidence | Finding                                                                                |
| --- | ---------------------------------------------------- | ------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| A3  | OTEL captures enough for A/B                         | HIGH                | HIGH               | Confirmed — OTEL provides cost_usd, tool details, and session.id                       |
| A4  | metadata.db hooks capture MCP with tool_use_id       | HIGH                | **MEDIUM**         | metadata.db captures MCP calls, but `tool_use_id` linkage to analytics.db is only 1.3% |
| A5  | JSONL contains reliable token counts                 | HIGH                | **MEDIUM**         | Reliable after dedup; no cost_usd field exists — must compute from tokens + pricing    |
| NEW | MCP calls visible in JSONL                           | —                   | **BUSTED**         | MCP calls absent from JSONL; metadata.db is the sole source                            |
| NEW | analytics.db join is straightforward via tool_use_id | —                   | **BUSTED**         | Only 1.3% direct join; need fuzzy matching fallback                                    |

---

## Architecture

### 4-Pass Pipeline (consensus across all 5 agents)

```
Pass 1: metadata.db    → tool call timeline, file paths, session boundaries
Pass 2: JSONL          → token usage (deduped), cost calculation
Pass 3: analytics.db   → Ariadne MCP call durations (dual-path join)
Pass 4: Derivation     → computed metrics from passes 1-3
```

Each pass is a pure function that takes a session_id and returns a typed dict. The passes compose into the final normalized JSON.

### File Structure

```
demo/session-comparison/
├── extract_metrics.py       # Core pipeline (all 4 passes + CLI)
├── pricing.py               # Model pricing table (extracted for maintainability)
├── run_comparison.sh         # Session capture orchestrator
├── manifest.json             # Task definitions + run records
├── output/                   # Generated normalized JSON files
│   ├── {session_id}.json     # Per-session normalized output
│   └── comparison_{task}.json # Paired comparison output
└── fixtures/                 # Test fixtures (snapshotted from real data)
    ├── create_fixtures.py    # One-time fixture generator
    └── *.json                # Frozen test data
```

### Zero External Dependencies (Phase 1)

Python stdlib only: `sqlite3`, `json`, `pathlib`, `argparse`, `statistics`, `datetime`. No pip install required. This was a strong consensus point — the pipeline must be runnable immediately on any machine with Python 3.10+.

---

## Normalized JSON Contract (Track C Interface)

Reconciled from Agent 1's rich timeline schema and Agent 3's paired comparison structure. The per-session schema is the atomic unit; paired comparisons are composed from two per-session outputs.

### Per-Session Schema

```json
{
  "schema_version": "1.0.0",
  "session": {
    "session_id": "string",
    "condition": "baseline" | "ariadne",
    "task_description": "string",
    "task_id": "string (from manifest)",
    "start_time": "ISO 8601",
    "end_time": "ISO 8601",
    "wall_clock_ms": 0,
    "model": "string",
    "git_commit": "string"
  },
  "tokens": {
    "input": 0,
    "output": 0,
    "cache_read": 0,
    "cache_creation": 0,
    "total": 0
  },
  "cost": {
    "total_usd": 0.0,
    "input_usd": 0.0,
    "output_usd": 0.0,
    "cache_read_usd": 0.0,
    "cache_creation_usd": 0.0,
    "pricing_model": "string (e.g. claude-opus-4-6-20250219)"
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
    "total": 0,
    "by_tool": {
      "list_entrypoints": { "count": 0, "total_duration_ms": 0, "avg_duration_ms": 0 },
      "show_call_graph_neighborhood": { "count": 0, "total_duration_ms": 0, "avg_duration_ms": 0 }
    },
    "join_method": "tool_use_id" | "fuzzy_timestamp" | "none"
  },
  "timeline": [
    {
      "timestamp": "ISO 8601",
      "event_type": "tool_call" | "api_request",
      "tool_name": "string (null for api_request)",
      "tool_category": "read" | "search" | "edit" | "bash" | "mcp" | "other",
      "file_path": "string | null",
      "duration_ms": 0,
      "tokens_used": 0,
      "cumulative_tokens": 0
    }
  ],
  "derived": {
    "exploration_efficiency": 0.0,
    "navigation_waste_ratio": 0.0,
    "time_to_first_edit_ms": 0,
    "duplicate_read_count": 0,
    "backtracking_count": 0,
    "reads_before_first_correct_edit": 0,
    "files_per_output_token": 0.0
  },
  "data_quality": {
    "warnings": ["string"],
    "errors": ["string"],
    "metadata_events_count": 0,
    "jsonl_messages_count": 0,
    "jsonl_dedup_count": 0,
    "analytics_join_rate": 0.0,
    "analytics_join_method": "tool_use_id" | "fuzzy_timestamp" | "none"
  }
}
```

### Tool Category Mapping

| Category | Tools                                                                      |
| -------- | -------------------------------------------------------------------------- |
| `read`   | Read                                                                       |
| `search` | Grep, Glob, WebSearch, WebFetch                                            |
| `edit`   | Edit, Write, MultiEdit, NotebookEdit                                       |
| `bash`   | Bash                                                                       |
| `mcp`    | mcp**ariadne**list_entrypoints, mcp**ariadne**show_call_graph_neighborhood |
| `other`  | Task, TodoRead, TodoWrite, etc.                                            |

### File Path Extraction (per tool type)

| Tool       | Field                                            | Confidence |
| ---------- | ------------------------------------------------ | ---------- |
| Read       | `tool_input.file_path`                           | HIGH       |
| Edit/Write | `tool_input.file_path`                           | HIGH       |
| Grep       | `tool_input.path`                                | HIGH       |
| Glob       | `tool_input.path` or `tool_input.pattern` prefix | MEDIUM     |
| Bash       | Regex heuristic on command string                | LOW        |
| MCP        | `tool_input.symbol_ref` (split on `:`)           | MEDIUM     |

---

## Metrics Design

### Tier 1: Smoking Gun Metrics (highest impact for demos)

| ID  | Metric                     | Formula                                    | Why It Matters                                                                 |
| --- | -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| M1  | **Navigation Waste Ratio** | `files_read_not_edited / total_files_read` | The single most intuitive metric: "Ariadne eliminates X% of wasted file reads" |
| M2  | **Duplicate Read Count**   | Count of file_path read > 1 time           | Direct evidence of exploration inefficiency                                    |
| M3  | **Total Cost (USD)**       | Sum of tiered token costs                  | Dollar impact is universally understood                                        |
| M4  | **Time to First Edit**     | First Edit/Write timestamp − session start | Speed to productivity                                                          |

### Tier 2: Core Efficiency

| ID  | Metric            | Formula                  |
| --- | ----------------- | ------------------------ |
| M5  | Total Token Count | Sum of all 4 token types |
| M6  | Tool Call Count   | Count from metadata.db   |
| M7  | Wall-Clock Time   | Last event − first event |

### Tier 3: Behavioral Insight

| ID  | Metric                          | Formula                                             |
| --- | ------------------------------- | --------------------------------------------------- |
| M8  | Exploration Efficiency          | `files_read_then_edited / total_files_read`         |
| M9  | Backtracking Count              | Re-reads of previously visited files                |
| M10 | Reads Before First Correct Edit | Count of Read calls before first Edit that survives |

### Cost Calculation

```python
PRICING = {
    "claude-opus-4-6-20250219": {
        "input_per_mtok": 15.0,
        "output_per_mtok": 75.0,
        "cache_read_per_mtok": 1.50,
        "cache_creation_per_mtok": 18.75,
    },
    # Add other models as needed
}

def calculate_cost(tokens: dict, model: str) -> dict:
    rates = PRICING[model]
    return {
        "input_usd": tokens["input"] * rates["input_per_mtok"] / 1_000_000,
        "output_usd": tokens["output"] * rates["output_per_mtok"] / 1_000_000,
        "cache_read_usd": tokens["cache_read"] * rates["cache_read_per_mtok"] / 1_000_000,
        "cache_creation_usd": tokens["cache_creation"] * rates["cache_creation_per_mtok"] / 1_000_000,
    }
```

### Statistical Methodology

- **Test**: Mann-Whitney U (non-parametric, handles small N)
- **Confidence intervals**: Bootstrap (10,000 resamples)
- **Alpha**: 0.10 (one-tailed, acknowledging small sample sizes)
- **Noise floor**: 6% (from Anthropic infrastructure noise research)
- **Cross-task aggregation**: Geometric mean of per-task ratios
- **Interpretation tiers**: Strong (p<0.05, effect>6%), Suggestive (p<0.10), Inconclusive, Counter-evidence

---

## Session Capture Orchestration

### manifest.json Schema

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
      "task_id": "rename-function",
      "description": "Rename the function parse_query to parse_user_query in packages/core/src/...",
      "prompt": "exact prompt text",
      "repo_path": ".",
      "setup_commands": ["git checkout <commit>"]
    }
  ],
  "runs": [
    {
      "run_id": "uuid",
      "task_id": "rename-function",
      "condition": "baseline" | "ariadne",
      "session_id": "uuid (pre-generated)",
      "started_at": "ISO 8601",
      "completed_at": "ISO 8601",
      "exit_code": 0,
      "output_json": "output/session_id.json"
    }
  ]
}
```

### run_comparison.sh Design

Key principles (from Agent 2):

1. **Interleaved scheduling**: Alternate baseline/ariadne runs per task (not all baselines then all ariadne) to avoid systematic temporal bias
2. **Randomized condition order**: Coin flip per task for which condition runs first
3. **Pre-generated session IDs**: Use `uuidgen` before each run, store in manifest
4. **Pre-flight checks**: Verify git is clean, metadata.db is accessible, Claude Code is installed
5. **Cool-down**: 30-second pause between runs to avoid API rate effects
6. **MCP config isolation**: `--mcp-config mcp-ariadne.json` vs `--mcp-config mcp-baseline.json` (empty)
7. **OTEL tagging**: `OTEL_RESOURCE_ATTRIBUTES="experiment.group=ariadne,task_id=rename-function"`
8. **Git reset between runs**: Ensure clean state for each run

### A/B Classification

Dual approach:

- **Explicit**: `experiment.group` OTEL resource attribute set by `run_comparison.sh`
- **Inferrable**: Presence of `mcp__ariadne__` tool calls in metadata.db (for ad-hoc sessions not run via the orchestrator)

### Initial Task Set (3 curated tasks)

1. **Cross-file rename**: Rename a function used across multiple files (tests Ariadne's call graph)
2. **Add feature with dependencies**: Implement a feature requiring understanding of existing call chains
3. **Debug a failing test**: Trace a test failure to its root cause across modules

These should be real tasks in the Ariadne codebase, not synthetic, to maximize credibility.

---

## JSONL Parsing Strategy

### Dedup Algorithm (last-wins per message.id)

```python
def parse_jsonl_tokens(jsonl_path: Path) -> dict:
    """Parse JSONL transcript, deduplicating by message.id (last occurrence wins)."""
    messages = {}  # message_id -> usage dict

    for line in open(jsonl_path):
        record = json.loads(line)
        msg = record.get("message", {})
        msg_id = msg.get("id")
        if not msg_id:
            continue

        usage = msg.get("usage")
        if usage:
            messages[msg_id] = {
                "input_tokens": usage.get("input_tokens", 0),
                "output_tokens": usage.get("output_tokens", 0),
                "cache_read_input_tokens": usage.get("cache_read_input_tokens", 0),
                "cache_creation_input_tokens": usage.get("cache_creation_input_tokens", 0),
                "model": msg.get("model", "unknown"),
            }

    # Sum across deduplicated messages
    totals = {"input": 0, "output": 0, "cache_read": 0, "cache_creation": 0}
    for usage in messages.values():
        totals["input"] += usage["input_tokens"]
        totals["output"] += usage["output_tokens"]
        totals["cache_read"] += usage["cache_read_input_tokens"]
        totals["cache_creation"] += usage["cache_creation_input_tokens"]

    return totals
```

### Session Boundary Detection

- 75% of sessions have explicit `Stop` events in metadata.db
- Remaining 25%: use timestamp of last event as session end
- Session start: first event timestamp OR first JSONL record timestamp

### JSONL File Location

```python
def find_jsonl_for_session(session_id: str) -> Path | None:
    """Find JSONL transcript for a session. Supports prefix matching."""
    base = Path.home() / ".claude" / "projects"
    for jsonl in base.rglob("*.jsonl"):
        if session_id in jsonl.name or session_id[:8] in jsonl.name:
            return jsonl
    return None
```

---

## Cross-DB Join Strategy

### Dual-Path Join (analytics.db → metadata.db)

```python
def join_analytics(session_id: str, metadata_events: list, analytics_db: Path) -> dict:
    """Join analytics.db MCP call data with metadata.db events.

    Path 1: Direct tool_use_id join (1.3% of records — high confidence)
    Path 2: Fuzzy timestamp+tool_name matching (fallback — medium confidence)
    """
    conn = sqlite3.connect(analytics_db)

    # Path 1: Direct join
    direct = conn.execute(
        "SELECT tool_use_id, tool_name, duration_ms, success "
        "FROM tool_calls WHERE tool_use_id IS NOT NULL"
    ).fetchall()
    direct_by_id = {r[0]: r for r in direct}

    # Path 2: Fuzzy matching for records without tool_use_id
    fuzzy = conn.execute(
        "SELECT tool_name, created_at, duration_ms, success "
        "FROM tool_calls WHERE tool_use_id IS NULL"
    ).fetchall()

    joined = []
    for event in metadata_events:
        if event["tool_name"].startswith("mcp__ariadne__"):
            tuid = event.get("tool_use_id")
            if tuid and tuid in direct_by_id:
                joined.append({**event, "analytics": direct_by_id[tuid], "join_method": "tool_use_id"})
            else:
                # Fuzzy: match by tool_name suffix + closest timestamp (within 2s)
                match = find_closest_fuzzy(event, fuzzy, tolerance_ms=2000)
                if match:
                    joined.append({**event, "analytics": match, "join_method": "fuzzy_timestamp"})

    return joined
```

---

## Implementation Sequence

### Phase 1: Spike (191.2.1) — 4 hours, time-boxed

**Key insight from Agent 5**: The spike is NOT throwaway. Build the skeleton of `extract_metrics.py` with a `--probe` mode that becomes the foundation for the full pipeline.

```bash
python extract_metrics.py --probe              # Dump data quality report for recent sessions
python extract_metrics.py --probe SESSION_ID   # Probe a specific session (prefix match)
```

Spike deliverables:

1. Validate JSONL dedup produces correct token totals (cross-check with OTEL `cost_usd` if available)
2. Validate metadata.db query returns correct tool call timeline for a session
3. Validate analytics.db join rate (confirm 1.3% direct, measure fuzzy match rate)
4. Validate session boundary detection (Stop events vs last-event fallback)
5. Validate file path extraction for each tool type
6. Output: `DataQualityReport` printed to stderr, raw data to stdout as JSON

**Assumption tests:**

- A3: ✅ or ❌ — Is OTEL data sufficient? (Compare with metadata.db)
- A4: ✅ or ❌ — What is the actual tool_use_id join rate?
- A5: ✅ or ❌ — Do deduped JSONL tokens match OTEL totals?

### Decision Gate 1

Review spike output. Update assumption register. If data quality is sufficient, proceed to Phase 2. If not, identify gaps and create fix tasks.

### Phase 2: Tracer Bullet (191.2.2) — 4-6 hours

Build `extract_metrics.py` with full pipeline:

```bash
python extract_metrics.py --extract SESSION_ID      # Extract one session → JSON to stdout
python extract_metrics.py --extract-pair S1 S2       # Extract paired comparison
python extract_metrics.py --list-sessions            # List available sessions
python extract_metrics.py --list-sessions --ariadne  # List sessions with Ariadne MCP
```

Implementation order within the tracer bullet:

1. Pass 1: metadata.db extraction (tool calls, file paths, timestamps)
2. Pass 2: JSONL token extraction (dedup, cost calculation)
3. Pass 3: analytics.db join (dual-path)
4. Pass 4: Derived metrics (M1–M10)
5. Data quality section
6. CLI argument handling

### Phase 2b: Test Fixtures (191.2.2, continued) — 2-3 hours

```bash
python fixtures/create_fixtures.py    # Snapshot real data into frozen test fixtures
python -m pytest extract_metrics.py   # Run inline doctests + fixture-based tests
```

Test categories:

- JSONL parsing: dedup correctness, empty sessions, malformed lines
- metadata.db queries: tool call extraction, session boundary detection
- Cross-DB join: direct vs fuzzy matching, edge cases
- Derived metrics: all M1–M10 formulas
- CLI: argument parsing, error messages
- Data quality: warning/error detection

### Phase 3: Orchestrator (191.2.3) — 3-4 hours

Build `run_comparison.sh` + `manifest.json`:

1. Manifest schema (task definitions, environment pinning)
2. Pre-flight checks (git clean, tools available)
3. Interleaved run scheduling with randomized condition order
4. MCP config isolation (ariadne vs baseline)
5. Session ID pre-generation and manifest recording
6. Post-run extraction (calls extract_metrics.py per session)
7. Manifest update with run results

### Phase 4: Enrichment (191.2.4) — optional, additive

Join benchmark results (from task-191.1) with session metrics. Only if both Track A and Track B produce data.

---

## Strengths and Weaknesses by Agent

### Agent 1 (Data Extraction Architecture)

- **Strengths**: Clean 4-pass architecture, rich timeline schema with cumulative_tokens, clear separation of concerns
- **Weaknesses**: Underestimated analytics.db join complexity, didn't address fuzzy matching

### Agent 2 (Session Capture Orchestration)

- **Strengths**: Detailed interleaved scheduling, MCP config isolation, pre-generated session IDs, randomized condition order
- **Weaknesses**: Overengineered OTEL setup for Phase 1, some features are Phase 3+

### Agent 3 (Metrics & Statistical Rigor)

- **Strengths**: Navigation Waste Ratio framing (highest demo impact), rigorous statistical methodology, interpretation tiers, 6% noise floor
- **Weaknesses**: JSON schema was overly paired-comparison-oriented, some novel metrics (M12, M13) are hard to compute reliably

### Agent 4 (Cross-DB Integration & Gaps)

- **Strengths**: Most thorough live data exploration, discovered 1.3% join rate, detailed file_path extraction per tool type, caching strategy
- **Weaknesses**: Overly complex DataQualityReport class hierarchy, some defensive coding beyond what's needed for Phase 1

### Agent 5 (DX, Testing & Spike Design)

- **Strengths**: "Spike is not throwaway" insight, prefix-matching CLI UX, zero-dependency emphasis, clear sequencing with hour estimates
- **Weaknesses**: Fixture strategy could be simpler (snapshot real data rather than generate synthetic)

### What Was Adopted from Each

| Agent | Key Contribution Adopted                                                            |
| ----- | ----------------------------------------------------------------------------------- |
| 1     | 4-pass pipeline architecture, timeline[] in JSON schema                             |
| 2     | Interleaved scheduling, manifest.json design, MCP config isolation                  |
| 3     | Navigation Waste Ratio (M1), statistical methodology, pricing table                 |
| 4     | Dual-path join strategy, file_path extraction table, data quality section in JSON   |
| 5     | Spike-as-skeleton pattern, --probe CLI mode, zero-dependency constraint, sequencing |

---

## Risk Register

| Risk                                                      | Likelihood | Impact | Mitigation                                                   |
| --------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------ |
| JSONL dedup produces wrong token totals                   | LOW        | HIGH   | Cross-check against OTEL cost_usd in spike                   |
| analytics.db fuzzy join produces false matches            | MEDIUM     | MEDIUM | 2-second tolerance window, report join_method in output      |
| Session boundaries are unreliable for 25% of sessions     | MEDIUM     | LOW    | Use last-event timestamp, flag in data_quality.warnings      |
| MCP tool calls missing from metadata.db for some sessions | LOW        | HIGH   | Validate in spike with known Ariadne sessions                |
| Curated tasks don't show meaningful Ariadne advantage     | MEDIUM     | HIGH   | Choose tasks that specifically require cross-file navigation |
| Python 3.10 not available on target machine               | LOW        | LOW    | No features beyond 3.10; fallback to 3.8 with minor changes  |

---

## Summary: Implementation Priorities

1. **Start with the spike** (191.2.1). It validates assumptions AND produces the pipeline skeleton.
2. **Navigation Waste Ratio is the hero metric**. Design everything to make this number compelling.
3. **metadata.db is the primary data source**, not JSONL. JSONL is only for token counts.
4. **Zero dependencies, zero setup**. The pipeline must work immediately.
5. **Interleaved scheduling is non-negotiable**. Sequential baseline-then-ariadne would invalidate results.
6. **Data quality transparency**. Every output includes a `data_quality` section so downstream consumers (Track C) know what to trust.
