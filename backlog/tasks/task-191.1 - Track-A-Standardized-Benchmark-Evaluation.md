---
id: task-191.1
title: 'Track A: Standardized Benchmark Evaluation'
status: To Do
assignee: []
created_date: '2026-02-24 09:59'
labels: []
dependencies: []
parent_task_id: task-191
priority: low
---

## Description

Run standardized benchmarks with and without Ariadne MCP to demonstrate two complementary value propositions:

1. **Accuracy lift** on hard benchmarks where cross-file understanding is the bottleneck (FeatureBench, SWE-EVO)
2. **Efficiency gains** (fewer tokens, faster, cheaper) on medium benchmarks where models already pass (SWE-bench Pro)

SWE-bench Verified is retired (saturated at ~80%, contaminated, >60% flagged tasks unsolvable). The post-saturation landscape offers benchmarks with real headroom for differentiation.

Uses the Discovery-Driven Planning approach (see doc-1): start with assumption testing spikes before committing to full benchmark runs. Later sub-tasks are provisional and will be created/refined at decision gates.

## Acceptance Criteria

- [ ] At least one benchmark harness configured to run Ariadne vs baseline comparison
- [ ] At least one benchmark (FeatureBench, SWE-bench Pro, or SWE-QA) run with results
- [ ] Pass/fail rates reported with statistical significance (3-5 runs per condition)
- [ ] Summary report documenting methodology, results, and confidence intervals

## Assumption Register

| ID | Assumption | Confidence | Criticality | Test |
|----|-----------|-----------|-------------|------|
| A1 | MCPBR can run with Claude Code + Ariadne MCP server | LOW | HIGH | Spike: install + try 1 task |
| A2 | SWE-bench tasks meaningfully benefit from call graph tools | MEDIUM | HIGH | Run 5 tasks, compare tool traces |
| A6 | FeatureBench/SWE-EVO harnesses are compatible with Claude Code + Ariadne MCP | LOW | HIGH | Spike: wire Ariadne into FeatureBench eval pipeline |

## Provisional Sub-Tasks

### Phase 1: Probe (time-boxed spike, ~1 day)

> Tests the riskiest assumptions before committing to full runs.

- **191.1.1** — Spike: Harness feasibility
  - Test MCPBR with Ariadne on 1 SWE-bench Pro task (tests A1)
  - Test FeatureBench evaluation pipeline with Claude Code + Ariadne MCP (tests A6)
  - Document: What works? What breaks? What's the output format for each?
  - Time-box: 4 hours per harness
  - Tests: A1, A6

### Decision Gate 1

Review spike results. Update assumption register. Decide which harnesses are viable and which benchmarks to prioritize. Create Phase 2 tasks.

### Phase 2: Benchmark Runs (provisional, ~3-5 days)

> Created after Decision Gate 1. Only if a harness proves viable.

- **191.1.2** — Run FeatureBench subset (~50 tasks, 3 runs each) — accuracy lift target
- **191.1.3** — Run SWE-bench Pro subset (~50 tasks, 3 runs each) — efficiency target
- **191.1.4** — Run SWE-QA (576 tasks, if earlier benchmarks show promise)
- **191.1.5** — Statistical analysis and summary report

## Location

`demo/benchmarks/` at repo root.

## Reference

- Parent task: task-191
- Planning framework: doc-1 (Adaptive Planning Frameworks)
- Key tools: [MCPBR](https://github.com/greynewell/mcpbr), [HAL Harness](https://github.com/princeton-pli/hal-harness), [FeatureBench](https://github.com/LiberCoders/FeatureBench)
- Data sources: benchmark harness output, OTEL events (if enabled during runs)
- Key benchmarks: [FeatureBench](https://github.com/LiberCoders/FeatureBench) (accuracy lift), [SWE-bench Pro](https://scale.com/leaderboard/swe_bench_pro_public) (efficiency), [SWE-QA](https://arxiv.org/abs/2509.14635) (cross-file reasoning)
