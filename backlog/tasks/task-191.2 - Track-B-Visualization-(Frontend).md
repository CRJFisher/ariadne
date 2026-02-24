---
id: task-191.2
title: 'Track B: Visualization (Frontend)'
status: To Do
assignee: []
created_date: '2026-02-24 09:59'
labels: []
dependencies: [task-191.1]
parent_task_id: task-191
priority: low
---

## Description

Build visualizations that make benchmark results and session comparisons compelling for demos, presentations, and documentation. Consumes the normalized JSON output from Track A (task-191.1).

Uses the Spike/Tracer Bullet pattern (see doc-1): start with a minimal static chart (tracer bullet), then iterate toward interactive HTML and animated output.

## Acceptance Criteria

- [ ] Side-by-side timeline visualization of agent trajectories (vanilla vs Ariadne) for at least 3 tasks
- [ ] Static chart output (PNG/SVG) suitable for README, blog posts, and slides
- [ ] At least one animated output (GIF or video) showing the comparison in action
- [ ] All visualizations produced from the same normalized JSON (no manual data entry)

## Assumption Register

| ID | Assumption | Confidence | Criticality | Test |
|----|-----------|-----------|-------------|------|
| B1 | Python + matplotlib can produce publication-quality side-by-side timelines | HIGH | MEDIUM | Spike: render 1 session pair |
| B2 | A self-contained HTML file with D3.js is sufficient for interactive demos | MEDIUM | LOW | Spike: build minimal prototype |
| B3 | The pixel-view concept (jhlee0409) translates well to A/B comparison | MEDIUM | MEDIUM | Visual prototype with real data |
| B4 | Playback animation is achievable with FuncAnimation or JS requestAnimationFrame | MEDIUM | LOW | Quick prototype |

## Provisional Sub-Tasks

### Phase 1: Tracer Bullet (static charts, ~2 days)

> The minimal end-to-end visualization. Depends on task-191.1 producing at least some data.

- **191.2.1** — Spike: Hero timeline chart prototype
  - Take the output from task-191.1.2 (ad-hoc session data) or mock data
  - Build a matplotlib side-by-side timeline (Chart A from task-191)
  - Color-coded tool calls, labeled with file paths
  - Output: single PNG showing vanilla vs Ariadne
  - Time-box: 4 hours
  - Tests: B1, B3

- **191.2.2** — Build `render_comparison.py`: full static chart suite
  - Chart A: Hero Timeline (side-by-side tool call sequences)
  - Chart B: Benchmark Results Summary (pass rate, token usage, cost bars)
  - Chart C: Cumulative Tokens Over Time (two lines)
  - Chart D: Exploration Funnel (files read → relevant → edited)
  - Chart E: Pareto Frontier (accuracy vs cost, HAL-style)
  - Color palette: Read=#4A90D9, Grep=#7BC67E, Glob=#F5A623, Bash=#9B9B9B, Edit/Write=#D0021B, MCP=#8B5CF6

### Decision Gate 1

Review static charts. Are they compelling? Which chart types best tell the story? Refine before investing in interactivity.

### Phase 2: Interactive HTML (provisional, ~3 days)

> Created after Decision Gate 1. Only if static charts validate the approach.

- **191.2.3** — Build `dashboard.html`: self-contained interactive visualization
  - Session data embedded as JSON (no server required)
  - Two synchronized scrollable timelines with hover tooltips
  - Toggle time-proportional vs event-proportional view
  - Summary stats panel with delta percentages
  - Brushing/filtering (tool type, file, MCP — borrowing Pattern 7 from task-191)

### Decision Gate 2

Review interactive dashboard. Is playback mode needed? What's the target output format (GIF, MP4, live demo)?

### Phase 3: Animation + Polish (provisional, ~2 days)

> Created after Decision Gate 2.

- **191.2.4** — Add playback mode to dashboard.html or build matplotlib FuncAnimation
  - Events appear sequentially on both timelines
  - Ariadne side finishes first (the key visual)
  - Configurable speed (1x, 2x, 5x)

- **191.2.5** — GIF/video capture pipeline
  - Screen recording of dashboard playback, or Puppeteer automation
  - Produce shareable artifacts for README/presentations

## Borrowable Patterns (from task-191 Appendix)

| Pattern | Source | Use For |
|---------|--------|---------|
| Pixel view colors | jhlee0409/history-viewer | Tool category color coding |
| Log-height scaling | jhlee0409/history-viewer | Token count → bar height |
| Brushing UX | jhlee0409/history-viewer | Interactive filtering |
| Swim lane bucketing | disler/hooks-observability | Time-axis rendering |

## Reference

- Parent task: task-191
- Depends on: task-191.1 (data extraction output)
- Planning framework: doc-1 (Adaptive Planning Frameworks)
- Key design inspiration: [jhlee0409/history-viewer](https://github.com/jhlee0409/claude-code-history-viewer), [HAL Leaderboard](https://hal.cs.princeton.edu/)
