# Ariadne MCP Benchmark Suite

Standardized A/B benchmarks comparing Claude Code with and without Ariadne MCP tools
(`list_entrypoints`, `show_call_graph_neighborhood`).

## Hypothesis

Ariadne's call graph tools reduce exploration overhead — fewer file reads, fewer tokens,
faster solutions — and improve accuracy on tasks requiring cross-file dependency resolution.

## Quick Start

### Prerequisites

- Python 3.11+
- Claude Code CLI (`claude`) installed and configured
- Ariadne MCP built (`npm run build` in `packages/mcp`)
- `ANTHROPIC_API_KEY` set

### Setup

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Run a Spike (1 task, quick validation)

```bash
# Spike A: MCPBR + SWE-bench Lite
mcpbr run -c mcpbr_ariadne.yaml -o results/spike_a.json

# Spike B: FeatureBench (requires FeatureBench installed)
python run_benchmark.py spike --task-id <task_id> --repo-path /path/to/repo
```

### Run Full Benchmark

```bash
# 50 tasks, 3 runs per condition, blocked paired scheduling
python run_benchmark.py full \
  --manifest manifest.json \
  --runs-per-condition 3 \
  --phase-budget-usd 1200 \
  --output results/full_run.json
```

### Analyze Results

```bash
python analyze_results.py results/full_run.json --output RESULTS.md --plots results/
```

## Directory Structure

```
demo/benchmarks/
├── README.md                 # This file
├── manifest.json             # Task definitions
├── mcpbr_ariadne.yaml        # MCPBR config (Spike A)
├── run_benchmark.py          # Benchmark orchestrator
├── analyze_results.py        # Statistical analysis + visualization
├── requirements.txt          # Python dependencies
├── agents/                   # Custom agents (Spike B)
│   └── claude_code_ariadne.py
├── results/                  # Raw output (gitignored)
└── RESULTS.md                # Generated summary report (gitignored)
```

## Methodology

### Run Protocol

- **Blocked paired schedule**: Randomization unit is task+run pair. Ariadne/baseline are adjacent
  within each pair with randomized order, reducing temporal confounding.
- **Repetition**: 3 runs per task per condition. Majority vote for pass/fail, median for continuous.
- **Environment locking**: Model version (exact ID), Ariadne commit hash, and target repo commit
  are pinned and recorded.
- **Budget guardrail**: Optional phase-level cap with automatic stop at 90% threshold.
- **Evaluation completeness**: Pass/fail must be populated by task evaluators for accuracy analysis.

### Evaluation Contract (manifest v2)

Each task may define evaluator wiring:

```json
{
  "evaluation": {
    "type": "command_json",
    "command": "python evaluator.py --task {task_id} --condition {condition}",
    "timeout_seconds": 300
  }
}
```

Evaluator command must emit JSON on stdout:

```json
{ "status": "ok", "passed": true, "details_path": "optional/path.json" }
```

### Metrics (Pre-Registered)

**Primary** (formal hypothesis testing):

1. Resolve rate (pass/fail) — McNemar's test
2. Total token usage — Wilcoxon signed-rank test
3. API cost per task — Wilcoxon signed-rank test

**Secondary**: Wall-clock time, tool call count, files explored.

**Exploratory**: Ariadne tool call frequency, time to first edit, duplicate reads.

### Statistical Tests

- McNemar's exact test for paired binary outcomes (pass/fail rates)
- Wilcoxon signed-rank test for paired continuous outcomes (tokens, cost)
- Bootstrap 95% CIs for relative reduction percentages (10,000 iterations)
- Wilson score 95% CIs for proportions

## Cost Estimates

| Run Type | Tasks | Total Runs | Estimated Cost |
|----------|-------|------------|----------------|
| Spike (1 task) | 1 | 2 | $2-10 |
| Full (Sonnet, 50 tasks) | 50 | 300 | $150-450 |
| Full (Sonnet, 30 tasks) | 30 | 180 | $90-360 |

Use pilot medians and p90s from actual runs to calibrate final spend projections.
