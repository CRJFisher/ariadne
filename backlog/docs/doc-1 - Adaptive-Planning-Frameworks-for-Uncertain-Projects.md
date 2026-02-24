---
id: doc-1
title: Adaptive Planning Frameworks for Uncertain Projects
type: other
created_date: '2026-02-24 09:58'
related_tasks: [task-191]
---

# Adaptive Planning Frameworks for Uncertain Projects

Software lives in the Cynefin "complex" domain — cause and effect are only visible in retrospect. Projects with both research unknowns and known implementation work cannot be fully planned upfront. This document surveys planning frameworks that handle this inherent uncertainty.

## 1. Cynefin: Probe-Sense-Respond

In complex systems, you run small experiments ("safe-to-fail probes"), observe what happens, then amplify what works and dampen what does not. You reject upfront planning in favour of parallel probes designed so failure is cheap and informative.

**Task structure:**

```
Phase 1: PROBE (time-boxed, parallel)
  - Probe A: Try approach X (2 hours max)
  - Probe B: Try approach Y (2 hours max)

Phase 2: SENSE (checkpoint)
  - What worked? What surprised us? What assumptions broke?

Phase 3: RESPOND
  - Amplify successful probes, kill dead ends, create new probes if needed
  - [Repeat until the problem moves from "complex" to "complicated"]
```

**Strengths:** Legitimizes parallel experiments and "planning-to-plan". Prevents over-investment.
**Weaknesses:** No built-in mechanism for transitioning from research to implementation. Can feel directionless without strict time-boxing.

Sources: [Cynefin Framework](https://en.wikipedia.org/wiki/Cynefin_framework), [Safe-fail Probes](https://thecynefin.co/safe-fail-probes/)

## 2. Discovery-Driven Planning (McGrath & MacMillan)

Start with the desired outcome, enumerate every assumption that must be true, rank by (uncertainty × criticality), then design checkpoints that convert assumptions into knowledge — cheapest tests first. The plan is explicitly expected to change.

**Task structure:**

```
Step 1: Define success criteria
Step 2: Assumption checklist (scored by confidence × criticality)
  - A1: "MCPBR can run with Ariadne MCP" [confidence: low, criticality: high]
  - A2: "SWE-bench tasks benefit from call graphs" [confidence: medium, criticality: high]
Step 3: Checkpoint plan (cheapest tests of riskiest assumptions first)
  - Checkpoint 1: Test A1 (1 day). GO/NO-GO.
  - Checkpoint 2: Test A2 (2 days). GO/NO-GO.
  - Checkpoint 3: Build implementation (only after key assumptions validated)
```

**Strengths:** The single most impactful practice for planning uncertain work. Forces assumption enumeration. "Cheapest test first" heuristic is extremely practical.
**Weaknesses:** Requires discipline to enumerate assumptions rather than jumping to implementation.

Sources: [Discovery-Driven Planning - HBR 1995](https://hbr.org/1995/07/discovery-driven-planning), [Rita McGrath on DDP](https://www.ritamcgrath.com/sparks/2022/10/taking-a-discovery-driven-approach-to-internal-projects/)

## 3. Shape Up (Basecamp)

Fix the time, vary the scope. Set an "appetite" (how much time you're willing to spend), shape work to fit. Track progress on a "hill chart" distinguishing "figuring it out" (uphill) from "getting it done" (downhill). A task stuck uphill needs a spike, not more effort.

**Task structure:**

```
SHAPING: Define problem + appetite, fat-marker sketch, identify rabbit holes + unknowns
BETTING TABLE: Commit or drop. No infinite backlogs.
BUILDING (time-boxed cycle): Full autonomy within shaped boundaries. Track on hill chart.
```

**Strengths:** Hill chart concept directly maps "research unknowns" vs "known implementation". Appetite-based scoping prevents unbounded research.
**Weaknesses:** Designed for 6-week team cycles. No native conditional/contingent tasks — handles uncertainty through scope cutting.

Source: [Shape Up (free book)](https://basecamp.com/shapeup)

## 4. Spike / Tracer Bullet / Walking Skeleton

Three related patterns ordered by permanence:

- **Spike**: Time-boxed throwaway experiment to answer a technical question. Code is disposable.
- **Tracer Bullet**: End-to-end thin slice of production code connecting all layers. Code is kept and grown.
- **Walking Skeleton**: Smallest possible end-to-end implementation that can be deployed and tested.

**Task structure:**

```
Phase 1: SPIKES (throwaway code, time-boxed)
  → OUTPUT: GO/NO-GO decisions

Phase 2: TRACER BULLET (production code, thin)
  → Build minimal end-to-end path using viable approach from Phase 1

Phase 3: ITERATE
  → Thicken the tracer bullet: error handling, edge cases, optimization
```

**Strengths:** Extremely practical. Clear distinction between throwaway research and production code.
**Weaknesses:** Does not address how to organize multiple concurrent workstreams.

Sources: [Pragmatic Programmer - Tracer Bullets](https://www.barbarianmeetscoding.com/notes/books/pragmatic-programmer/tracer-bullets/), [GROWS Tracer Bullet Development](https://growsmethod.com/grows_tracer_bullets.html)

## 5. Real Options Theory

Never commit early unless you know why. The "last responsible moment" for a decision is when delaying further would eliminate an important alternative. Before that moment, keep options open — the information you gain by waiting exceeds the certainty you gain by committing.

**Formula:** `Last Responsible Moment = Deadline - Implementation Duration`

**Strengths:** Rigorous framework for *when* to decide. Prevents premature commitment. Complements other frameworks.
**Weaknesses:** Can justify procrastination if not applied honestly.

Sources: [Real Options Enhance Agility - InfoQ](https://www.infoq.com/articles/real-options-enhance-agility/), [Black Swan Farming](https://blackswanfarming.com/real-options-embracing-uncertainty/)

## 6. OODA Loop (Observe-Orient-Decide-Act)

The entity that cycles through Observe-Orient-Decide-Act faster wins. "Orient" is the key step — update your mental model based on observations, not just react. Speed of iteration matters more than quality of any single iteration.

**Strengths:** Extremely fast feedback loops (hours, not weeks). Forces model updates.
**Weaknesses:** Very lightweight — does not structure many tasks. Can lead to thrashing.

Sources: [OODA Loop and Agile](https://stevesitton.com/2016/11/the-ooda-loop-and-agile/)

## 7. Kanban with Classes of Service

Visualize work, limit WIP, manage flow. Classes of service define different policies for research vs implementation:

```
Board: Backlog | Research (WIP: 1) | Ready to Implement | Implementation (WIP: 2) | Done

Classes:
  - Research/Spike: Time-boxed, output is decisions or new tasks. WIP: 1.
  - Standard Implementation: Known work. WIP: 2.
```

**Strengths:** Directly supports "research produces implementation tasks". WIP limits prevent starting too many threads.
**Weaknesses:** Flow management, not planning — does not tell you *what* to research.

Sources: [Kanban Guide](https://kanban.university/kanban-guide/), [Classes of Service - Scrum.org](https://www.scrum.org/resources/blog/classes-service-kanban-what-are-they)

---

## Recommended Composite for Task-191

For the Ariadne benchmarking & visualization project, combine:

| From | Take | Apply To |
|------|------|----------|
| **Discovery-Driven Planning** | Assumption register + cheapest-test-first checkpoints | Overall project structure |
| **Cynefin** | Probe-sense-respond for research phases | Track A (benchmarking) |
| **Spike / Tracer Bullet** | Spikes for unknowns, tracer bullets for implementation | Both tracks |
| **Real Options** | Defer backend choice until data capture proves viable | Architecture decisions |
| **Shape Up (hill chart)** | Distinguish "figuring it out" from "getting it done" | Progress tracking |
| **Kanban** | WIP limits + classes of service | Task flow management |

### Concrete Task Pattern

```
=== ASSUMPTION REGISTER ===
A1: MCPBR works with Claude Code + Ariadne MCP [LOW confidence, HIGH criticality]
A2: SWE-bench tasks meaningfully benefit from call graphs [MEDIUM, HIGH]
A3: Native OTEL captures enough data for A/B comparison [HIGH, MEDIUM]
A4: metadata.db hooks capture MCP tool calls correctly [HIGH, LOW]

=== PHASE 1: PROBES (time-boxed spikes) ===
Spike 1: Install MCPBR, test with 1 SWE-bench task + Ariadne [4h] → tests A1
Spike 2: Run 3 ad-hoc sessions (with/without), extract JSONL metrics [4h] → tests A2, A3

=== DECISION GATE 1 ===
Review. Update assumption register. Generate Phase 2 tasks.
(Phase 2 tasks DO NOT EXIST YET — created at the gate.)

=== PHASE 2: TRACER BULLET ===
[Tasks generated based on gate 1 learnings]

=== DECISION GATE 2 ===
Review. Redirect if needed.

=== PHASE 3: ITERATE ===
[Tasks generated based on gate 2 learnings]
```

The key insight: **later-phase tasks are placeholders, not specifications.** They are created at decision gates based on what was learned, not planned upfront.
