---
id: task-191
title: >-
  Benchmarking & Visualization: Demonstrate Ariadne MCP value with A/B
  comparisons
status: To Do
assignee: []
created_date: '2026-02-23 17:26'
labels: []
dependencies: []
priority: low
---

## Description

Demonstrate that Ariadne's MCP server measurably improves Claude Code coding sessions — faster task completion, more accurate code navigation, and reduced token usage. This is a two-track effort: (1) running standardized benchmarks with and without Ariadne, and (2) building visualizations that make the results compelling for demos and presentations.

The core hypothesis: Ariadne's call graph analysis and entry point detection reduce the agent's exploration overhead, leading to fewer file reads, fewer tokens consumed, and faster time-to-solution.

## Acceptance Criteria

- [ ] At least one standardized benchmark (FeatureBench, SWE-bench Pro, or SWE-QA) run with and without Ariadne MCP, with reproducible results
- [ ] Metrics captured per task: pass/fail, token usage (all 4 types), tool call count, files explored, wall-clock time, cost
- [ ] Side-by-side visualization of agent trajectories (vanilla vs Ariadne) for at least 3 curated tasks
- [ ] Static chart output (PNG/SVG) suitable for README, blog posts, and slide decks
- [ ] Results show statistical significance (3-5 runs per condition to measure variance)
- [ ] Final review against the original research plan (`/Users/chuck/.claude/plans/noble-orbiting-swan.md`) confirms all research inputs were considered and the implementation covers the full scope

## Research Findings

### Agentic Coding Benchmark Landscape

Ariadne's value is in **codebase navigation and cross-file understanding**. The benchmarks that best test this:

| Benchmark | What It Tests | Ariadne Relevance | Difficulty |
|-----------|--------------|-------------------|------------|
| **[SWE-QA](https://arxiv.org/abs/2509.14635)** | Repo-level Q&A: intention understanding, cross-file reasoning, multi-hop dependencies | HIGHEST — directly tests what Ariadne provides | 576 tasks, Python repos |
| **[SWE-EVO](https://arxiv.org/abs/2512.18470)** | Multi-file evolution (avg 21 files, avg 874 tests) | VERY HIGH — cross-cutting changes need call graphs | 48 tasks, GPT-5 at 21% |
| **[SWE-bench Pro](https://scale.com/leaderboard/swe_bench_pro_public)** | Real GitHub issues, multi-language (Python/Go/TS/JS), 41 repos. Replaces retired SWE-bench Verified (saturated at ~80%, contaminated) | HIGH — unsaturated (~23% top), less contaminated, good headroom | 1,865 tasks, Claude Opus 4.1 at 23% |
| **[RepoBench-R](https://proceedings.iclr.cc/paper_files/paper/2024/file/d191ba4c8923ed8fd8935b7c98658b5f-Paper-Conference.pdf)** | Cross-file code retrieval | HIGH — Ariadne gives this for free | ICLR 2024 |
| **[FEA-Bench](https://github.com/microsoft/FEA-Bench)** | Feature implementation in existing codebases | HIGH — requires understanding existing architecture | Microsoft, ACL 2025 |
| **[FeatureBench](https://github.com/LiberCoders/FeatureBench)** | End-to-end feature development. Primary failure mode is `NameError` from cross-file dependency resolution — exactly what Ariadne's call graph addresses. ICLR 2026. | HIGHEST — Claude Opus 4.5 at 11%, cross-file deps are the bottleneck | 200 tasks, 24 repos |
| **[CrossCodeEval](https://www.evidentlyai.com/blog/llm-coding-benchmarks)** | Cross-file code completion (Python, Java, TS, C#) | HIGH — tests dependency understanding | Multilingual |

### MCP-Specific Evaluation Tools

| Tool | What It Does | Install |
|------|-------------|---------|
| **[MCPBR](https://github.com/greynewell/mcpbr)** | Purpose-built A/B comparison: runs MCP Agent vs Baseline Agent on SWE-bench tasks | `pip install mcpbr && mcpbr run -n 1` |
| **[MCP-Bench](https://github.com/Accenture/mcp-bench)** | 28 MCP servers, 250 tools, 6 evaluation axes | Accenture |
| **[MCPAgentBench](https://arxiv.org/abs/2512.24565)** | Real-world tasks with simulated MCP tools, measures efficiency | Academic |
| **[AgiFlow token-usage-metrics](https://github.com/AgiFlow/token-usage-metrics)** | Token efficiency comparison methodology: 3 sessions per approach, per-request tracking | GitHub |

### Evaluation Harnesses

| Harness | Best For |
|---------|----------|
| **[MCPBR](https://github.com/greynewell/mcpbr)** | A/B comparison of MCP effectiveness (primary tool) |
| **[HAL Harness](https://github.com/princeton-pli/hal-harness)** | Cost-controlled evaluation, Pareto frontiers (accuracy vs cost) |
| **[Harbor](https://github.com/laude-institute/harbor)** | Containerized evaluation at scale |
| **[SWE-agent](https://github.com/SWE-agent/SWE-agent)** | Configurable agent scaffolding for SWE-bench |

### Data Capture: Claude Code Native OTEL

Claude Code has **built-in OpenTelemetry support** — no third-party exporter needed. Only a lightweight backend is needed to receive the data.

**Metrics** (8 counters, exported as time series):

| Metric | Attributes | Relevance |
|--------|-----------|-----------|
| `claude_code.token.usage` | type (input/output/cacheRead/cacheCreation), model, session.id | Core A/B metric |
| `claude_code.cost.usage` | model, session.id | Core A/B metric |
| `claude_code.active_time.total` | type (user/cli) | Core A/B metric |
| `claude_code.session.count` | session.id | Tracking |
| `claude_code.lines_of_code.count` | type (added/removed) | Useful |
| `claude_code.code_edit_tool.decision` | tool_name, decision, source, language | Useful |

**Events** (5 types, exported via OTEL logs protocol):

| Event | Key Attributes |
|-------|---------------|
| `claude_code.tool_result` | tool_name, success, duration_ms, mcp_server_scope, tool_parameters (mcp_server_name, mcp_tool_name when `OTEL_LOG_TOOL_DETAILS=1`), tool_result_size_bytes |
| `claude_code.api_request` | model, cost_usd, duration_ms, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, speed |
| `claude_code.user_prompt` | prompt_length, prompt (when `OTEL_LOG_USER_PROMPTS=1`) |
| `claude_code.api_error` | model, error, status_code, duration_ms, attempt |
| `claude_code.tool_decision` | tool_name, decision, source |

All events within a single user prompt share `prompt.id` (UUID v4). `event.sequence` provides ordering within a session.

**Minimal setup:**

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_LOG_TOOL_DETAILS=1
export OTEL_RESOURCE_ATTRIBUTES="experiment.group=control"  # or "ariadne"
```

**Backend options:** console (zero setup), [claude-code-otel](https://github.com/ColeMurray/claude-code-otel) Docker Compose (30min), or any OTEL-compatible backend.

### Existing Data Infrastructure

Already in place:

- **`~/.claude/metadata.db`** — Hook-based capture of ALL Claude Code tool calls with timestamps, file paths, diffs, git context. Populated by `/Users/chuck/workspace/vscode_lite_llm/scripts/hooks/metadata-collector.cjs`.
- **`~/.ariadne/analytics.db`** — Ariadne MCP call analytics (duration_ms, success, arguments). Linked to metadata.db via `tool_use_id`.
- **JSONL transcripts** at `~/.claude/projects/` — Full conversations including token usage per API turn.

### OSS Visualization Tool Evaluation

| Tool | Score | Best For | Critical Gap |
|------|-------|----------|-------------|
| **[claude-code-otel](https://github.com/ColeMurray/claude-code-otel) (Grafana)** | **7/10** | Data capture + interactive dashboards | Requires Docker; needs custom A/B panels |
| **[jhlee0409/claude-code-history-viewer](https://github.com/jhlee0409/claude-code-history-viewer)** | 4/10 | Browsing sessions, pixel view concept | Desktop-only, no A/B grouping, no export |
| **[disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability)** | 4/10 | Real-time hook pipeline | No token data, no A/B, no export |
| **[ccusage](https://github.com/ryoppippi/ccusage)** | 3/10 | Accurate cost calculation | No tool visibility, no MCP awareness |

**Verdict:** No existing tool does A/B session comparison. Build custom, borrow selectively:

| Component | Source |
|-----------|--------|
| Data capture | Claude Code native OTEL (built-in) + existing metadata hooks |
| Ariadne-specific metrics | Existing `analytics.db` |
| JSONL token parsing | Borrow patterns from ccusage (dedup by `message.id`, LiteLLM pricing) |
| Pixel view concept | Borrow visual design from jhlee0409/history-viewer |
| A/B comparison + visualization | Build custom |

### Key Methodology Considerations

From [Anthropic's infrastructure noise research](https://www.anthropic.com/engineering/infrastructure-noise):

- Infrastructure config alone can swing results by 6 percentage points
- Differences under 3 points should be treated with skepticism
- Both conditions must be interleaved, not sequential

From [AgiFlow](https://agiflow.io/blog/token-efficiency-in-ai-assisted-development/):

- Run 3+ sessions per approach to measure variance
- MCP Optimized achieves ~1% variance vs 47% reduction after warm-up

## Implementation Plan

Three tracks, with A and B running in parallel and C depending on B:

```
191.1 Benchmarks ──────────────────────┐
  [no deps, can start immediately]     │ (optional enrichment via 191.2.4)
                                       v
191.2 Data Pipeline ──────────> 191.3 Visualization
  [no deps, parallel with 191.1]   [depends on 191.2]
```

### Track A: Standardized Benchmark Evaluation (task-191.1)

**Location**: `demo/benchmarks/` at repo root.

Dual strategy: (1) **accuracy lift** on hard benchmarks where cross-file understanding is the bottleneck (FeatureBench at 11%, SWE-EVO at 21%), and (2) **efficiency gains** on medium benchmarks where models already pass (SWE-bench Pro at 23%). External harnesses, prescribed methodology — value = *credibility*.

Sub-tasks: 191.1.1 (harness feasibility spike) → 191.1.2 (FeatureBench ~50 tasks) → 191.1.3 (SWE-bench Pro ~50 tasks) → 191.1.4 (SWE-QA 576 tasks) → 191.1.5 (statistical analysis).

### Track B: Data Extraction Pipeline (task-191.2)

**Location**: `demo/session-comparison/` at repo root.

Build `extract_metrics.py`, `run_comparison.sh`, and `manifest.json` to capture richer behavioral metrics from our infrastructure (metadata.db, analytics.db, JSONL). Custom tooling, our methodology — value = *insight*. Output is the normalized JSON contract consumed by Track C.

Sub-tasks: 191.2.1 (data quality spike) → 191.2.2 (extract_metrics.py) → 191.2.3 (run_comparison.sh + manifest) → 191.2.4 (optional benchmark enrichment).

### Track C: Visualization (task-191.3)

**Location**: `demo/session-comparison/` at repo root.

Build visualizations (static charts, interactive HTML, GIF/video) from the normalized JSON produced by Track B. Consumes data, does not produce it.

Sub-tasks: 191.3.1 (hero timeline spike) → 191.3.2 (render_comparison.py) → 191.3.3 (dashboard.html) → 191.3.4 (playback mode) → 191.3.5 (GIF/video capture).

### Key Metrics

| Metric | Source | Why |
|--------|--------|-----|
| Tool call count ratio | metadata.db | Headline: "X% fewer tool calls" |
| Token input reduction | JSONL transcripts | Direct cost saving |
| Time to first edit | metadata.db timestamps | Speed to productivity |
| Exploration efficiency | metadata.db file_path | Targeting precision |
| Duplicate reads eliminated | metadata.db | Ariadne prevents re-reading |
| Wall-clock time | metadata.db timestamps | Absolute time saving |

### Files to Create

```
demo/
├── benchmarks/                    # Track A (task-191.1)
│   └── (MCPBR config + results)
└── session-comparison/            # Track B (task-191.2) + Track C (task-191.3)
    ├── manifest.json              # Track B
    ├── run_comparison.sh          # Track B
    ├── extract_metrics.py         # Track B
    ├── render_comparison.py       # Track C
    ├── dashboard.html             # Track C
    └── output/
```

### Reference Files (not modified)

- `/Users/chuck/workspace/vscode_lite_llm/scripts/hooks/metadata-collector.cjs`
- `/Users/chuck/workspace/vscode_lite_llm/src/extract/sqlite-loader.ts`
- `/Users/chuck/workspace/ariadne/packages/mcp/src/analytics/analytics.ts`
- `/Users/chuck/workspace/ariadne/packages/mcp/src/analytics/query_stats.ts`

## Appendix: Borrowable Patterns from OSS Tools

### Pattern 1: Pixel View Color System (jhlee0409/history-viewer)

| Category | Color | Tools |
|----------|-------|-------|
| Code (edits) | foreground/70 | Edit, Write, MultiEdit |
| File (reads) | sky-500 (#0EA5E9) | Read, Glob |
| Search | amber-500 (#F59E0B) | Grep, WebSearch |
| Terminal | sky-500 (#0EA5E9) | Bash |
| Git | orange-500 (#F97316) | git operations |
| MCP | purple-500 (#A855F7) | Any MCP tool call |

Height: logarithmic mapping from token count to pixel height (4px–20px).

### Pattern 2: JSONL Transcript Parsing (jhlee0409/history-viewer)

Key fields per JSONL line:

```
uuid, parent_uuid, session_id, timestamp,
message_type: "user" | "assistant" | "system" | "progress",
message: {
  role, content: ContentBlock[], id, model, stop_reason,
  usage: { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens }
},
cost_usd, duration_ms, is_sidechain
```

Content block types: `text`, `thinking`, `tool_use`, `tool_result`, `mcp_tool_use` (with serverName, toolName), `mcp_tool_result`.

Token dedup: Multiple JSONL lines share `message.id`. Deduplicate by Set.

### Pattern 3: Cost Calculation (ccusage)

```python
def calculate_tiered_cost(tokens, base_rate, above_200k_rate, threshold=200_000):
    if tokens <= threshold:
        return tokens * base_rate
    else:
        return (threshold * base_rate) + ((tokens - threshold) * above_200k_rate)
```

Source: LiteLLM's community-maintained pricing database.

### Pattern 4: Hook Event Pipeline (disler/hooks-observability)

Hook stdin payload fields by type:

| Hook | Fields |
|------|--------|
| PreToolUse | tool_name, tool_input, tool_use_id |
| PostToolUse | tool_name, tool_result, tool_use_id, mcp_server_name, mcp_tool_name |
| Stop | session_id, reason |
| SubagentStart | agent_id, agent_type, model |
| SubagentStop | agent_id, transcript_path |

### Pattern 5: OTEL A/B Experiment Tagging

```bash
export OTEL_RESOURCE_ATTRIBUTES="experiment.group=control,experiment.run=1"
```

Useful PromQL:

```promql
sum by (type) (increase(claude_code_token_usage_tokens_total{session_id="$session"}[1h]))
```

Useful LogQL:

```logql
sum by (tool_name) (count_over_time({service_name="claude-code"} |= "claude_code.tool_result" | json | session_id="$session" [$__range]))
```

### Pattern 6: Cross-Database Linkage

Join key: `tool_use_id` (Anthropic `toolu_01...` content block ID), present in metadata.db, analytics.db, JSONL transcripts, and OTEL events.

```sql
ATTACH '~/.ariadne/analytics.db' AS ariadne;
SELECT m.tool_name, m.timestamp, a.duration_ms, a.success
FROM events m
INNER JOIN ariadne.tool_calls a ON m.tool_use_id = a.tool_use_id
WHERE m.session_id = ?;
```

### Pattern 7: Swim Lane Time Bucketing (disler/hooks-observability)

Time bucketing for activity charts:

| Time Range | Bucket Size | Max Points |
|------------|------------|------------|
| 1 minute | 1 second | 60 |
| 3 minutes | 3 seconds | 60 |
| 5 minutes | 5 seconds | 60 |
| 10 minutes | 10 seconds | 60 |

Bucket normalization: `Math.floor(timestamp / bucketSize) * bucketSize`

Data point structure:

```typescript
{ timestamp, count, eventTypes: { [type]: count }, sessions: { [id]: count } }
```

Canvas rendering (80px height, 30 FPS):

1. Clear and draw background
2. Draw axes and time labels
3. `barWidth = chartArea.width / dataPoints.length`
4. Draw color-coded stacked bars per bucket
5. Pulse animation at right edge for new events

### Pattern 8: Brushing/Filtering UX (jhlee0409/history-viewer)

Brush state model:

```typescript
type ActiveBrush = { type: 'tool' | 'mcp' | 'command' | 'file', value: string } | null
```

Four independent filter dimensions:

| Dimension | Source | Example Values |
|-----------|--------|---------------|
| Tools | tool_name from content blocks | Read, Edit, Bash, Grep |
| MCP Servers | serverName from mcp_tool_use | ariadne, filesystem |
| Shell Commands | first arg from Bash tool_use | git, npm, python |
| Files | file_path from Read/Edit/Write | src/index.ts |

Highlight behavior:

- Match: full opacity + `ring-1 inset` accent border
- No match: `opacity-25` + `saturate(0)` CSS filter
- Transition: 150ms ease
- Header shows match ratio: "12/47" with mini histogram

Interaction: Hover = transient highlight. Click = sticky (persists until Escape or click elsewhere). MCP filter shows conditionally only when MCP servers detected in session data.
