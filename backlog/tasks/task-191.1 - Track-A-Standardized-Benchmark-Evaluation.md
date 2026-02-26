---
id: task-191.1
title: 'Track A: Standardized Benchmark Evaluation'
status: In Progress
assignee: []
created_date: '2026-02-24 09:59'
updated_date: '2026-02-25 17:45'
labels: []
dependencies: []
parent_task_id: task-191
priority: low
---

## Description

Run a budget-aware, standardized A/B benchmark program with and without Ariadne MCP.

This track validates three outcomes:

1. **Accuracy lift on cross-file coding tasks** (FeatureBench)
2. **Efficiency and reliability on long-horizon issue resolution** (SWE-bench Pro)
3. **MCP tool-use quality** (MCPAgentBench or MCP-Bench subset)

FeatureBench + SWE-bench Pro remains the core coding benchmark pair for Ariadne's value proposition. For claims about **industry-standard MCP benchmarking**, include one MCP-native benchmark track because coding benchmarks alone do not fully measure MCP tool selection/planning robustness.

SWE-bench Verified remains available and can be used as an optional comparability sanity-check, but it is not the primary benchmark for this track.

## Benchmark Portfolio

### Core (required)

- **FeatureBench (lite/full subset)**: Cross-file feature development difficulty where current frontier models still have substantial headroom.
- **SWE-bench Pro (public subset)**: Long-horizon, multi-file software engineering with strong contamination resistance and reproducible evaluation.

### MCP-native (required for MCP-standard claim)

- **MCPAgentBench** (preferred) or **MCP-Bench** (fallback subset).
- Purpose: validate tool selection under distractors, tool-use efficiency, and trajectory quality.

### Optional

- **SWE-bench Verified sanity check** (small subset only) for external comparability, not as the headline benchmark.

## Cost Model and Budget Gates

### Why cost gating is required

FeatureBench and SWE-bench Pro are realistic but expensive at full scale. Budget risk is dominated by the number of runs and per-run token usage variance.

### Pricing basis

Use Anthropic current API pricing as the cost basis during runs and reporting:

- Sonnet 4.5/4.6: $3/MTok input, $15/MTok output
- Batch API: 50% discount when compatible
- Long context (>200K input in 1M context mode): premium rates apply

### Cost formula

`estimated_cost = tasks * runs_per_condition * conditions(2) * median_cost_per_run`

### Planning envelopes

Use these as planning envelopes before pilot calibration:

- **SWE-bench Pro**: $0.30-$2.00 per run
- **FeatureBench**: $1.00-$6.00 per run
- **MCP-native benchmark**: $0.10-$1.50 per run (depends on task depth and judge model)

### Required budget gates

- **Gate B1 (after pilot)**: Re-estimate per-run cost from observed medians and p90.
- **Gate B2 (before full run)**: Do not start a phase if projected phase spend exceeds approved cap.
- **Global stop rule**: Abort new tasks when cumulative spend reaches 90% of approved budget.

### Initial budget caps

- **Pilot cap**: $200
- **Core benchmark cap (Phase 2)**: $1,200 default (raise only with explicit approval)

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 At least two benchmark harnesses configured and validated end-to-end (one coding benchmark + one MCP-native benchmark)
- [ ] #2 Pass/fail is populated by benchmark-native evaluators (not placeholder values)
- [ ] #3 Pilot cost report includes observed per-run median, p90, and projected full-run spend
- [ ] #4 At least one coding benchmark run (FeatureBench or SWE-bench Pro) and one MCP-native benchmark run completed with reproducible artifacts
- [ ] #5 Primary metrics reported with statistical tests and confidence intervals
- [ ] #6 Final report documents methodology, environment locks, budget adherence, and threats to validity
<!-- AC:END -->

## Assumption Register

| ID | Assumption | Confidence | Criticality | Test |
|----|-----------|-----------|-------------|------|
| A1 | MCPBR can run with Claude Code + Ariadne MCP server | MEDIUM | HIGH | Spike: run 1-3 tasks with Ariadne and baseline |
| A2 | SWE-bench Pro tasks benefit from Ariadne call graph tools | MEDIUM | HIGH | Pilot: paired runs on 10 tasks, inspect trajectories and metrics |
| A3 | FeatureBench harness supports stable Claude Code + Ariadne integration | LOW | HIGH | Spike: wire custom agent and run lite split tasks |
| A4 | MCP-native benchmark can represent Ariadne tool-use quality fairly | MEDIUM | HIGH | Run MCPAgentBench (or MCP-Bench subset) with fixed tool allowlists |
| A5 | Cost envelope is manageable within approved budget | LOW | HIGH | Pilot cost calibration + gate B1/B2 |
| A6 | Stream/token accounting is accurate enough for efficiency claims | LOW | HIGH | Validate transcript parsing and dedup against known fixtures |

## Phase Plan

### Phase 0: Measurement Hardening (required before benchmark claims)

- **191.1.0** — Harden runner/evaluator correctness
  - Populate `passed` from benchmark-native evaluation output
  - Fix transcript dedup logic for repeated `message.id`
  - Capture run metadata: model ID, commit hashes, harness version, seed
  - Add run-level budget guardrails and fail-fast on missing evaluator output

### Phase 1: Feasibility + Cost Pilot (~1-2 days)

- **191.1.1** — Harness feasibility spikes
  - MCPBR + Ariadne on SWE-bench style task(s)
  - FeatureBench integration with custom Claude Code Ariadne agent
  - MCP-native harness smoke test (MCPAgentBench preferred)

- **191.1.2** — Cost calibration pilot
  - SWE-bench Pro: 10 tasks x 1 run per condition
  - FeatureBench: 5-10 tasks x 1 run per condition
  - MCP-native: 20 tasks x 1 run per condition
  - Produce pilot cost/variance report and projected full-run budget

### Decision Gate 1

Proceed only if all are true:

- Evaluator-generated pass/fail is complete
- Token/cost accounting validation passes
- Projected Phase 2 spend is within approved cap
- Ariadne tools are actually being invoked in treatment runs

### Phase 2: Core Benchmark Runs (~3-7 days)

- **191.1.3** — SWE-bench Pro paired run
  - Target: 30 tasks x 3 runs per condition (expand to 50 only if budget allows)

- **191.1.4** — FeatureBench paired run
  - Target: 20-30 tasks x 3 runs per condition (scale based on pilot cost)

- **191.1.5** — MCP-native paired run
  - Target: benchmark-defined subset sufficient for stable efficiency/task metrics

### Decision Gate 2

Decide whether to scale up sample sizes based on statistical power and remaining budget.

### Phase 3: Analysis and Reporting

- **191.1.6** — Final statistical analysis and report
  - Accuracy: paired pass/fail tests
  - Efficiency: tokens, cost, time
  - MCP-specific: tool selection efficiency and execution metrics
  - Confidence intervals and validity threats

## Methodology Controls

- Interleaved A/B scheduling with fixed seeds
- Identical model version and environment per paired comparison
- Pinned repository commits and harness versions
- Pre-registered primary metrics and tests
- Explicit handling of infra noise and run failures
- Reproducible artifacts: raw JSON results + generated report

## Location

`demo/benchmarks/` at repo root.

## References

- Parent task: task-191
- Planning framework: doc-1 (Adaptive Planning Frameworks)
- FeatureBench paper: https://arxiv.org/abs/2602.10975
- FeatureBench repo: https://github.com/LiberCoders/FeatureBench
- SWE-bench Pro paper: https://arxiv.org/abs/2509.16941
- SWE-bench Pro leaderboard: https://scale.com/leaderboard/swe_bench_pro_public
- SWE-bench datasets overview (Verified still available): https://www.swebench.com/SWE-bench/
- MCPAgentBench paper: https://arxiv.org/abs/2512.24565
- MCP-Bench paper: https://arxiv.org/abs/2508.20453
- MCP-Bench repo: https://github.com/Accenture/mcp-bench
- MCPBR: https://github.com/greynewell/mcpbr
- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing

## Implementation Notes

### Infrastructure in place

All benchmark infrastructure currently lives in `demo/benchmarks/`:

- `mcpbr_ariadne.yaml`
- `agents/claude_code_ariadne.py`
- `run_benchmark.py`
- `analyze_results.py`
- `manifest.json`
- `requirements.txt`
- `README.md`

### Mandatory fixes before claiming benchmark results

1. Ensure benchmark-native evaluators write `passed` for every run result.
2. Correct transcript dedup logic in stream parser (`message.id` last-wins behavior).
3. Expand manifest from single spike task to paired benchmark cohorts with seeds.
4. Add pilot budget reporting (`median`, `p90`, projected full spend) as a first-class output.

### Immediate next steps

1. Implement Phase 0 hardening items.
2. Run Phase 1 pilot and generate budget calibration report.
3. Re-scope Phase 2 task counts based on observed pilot cost and variance.
