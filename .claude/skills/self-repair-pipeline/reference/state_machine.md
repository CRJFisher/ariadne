# State Machine: Phase Transitions and BLOCK/ALLOW Logic

The Stop hook (`scripts/triage_loop_stop.ts`) drives the triage pipeline as a deterministic state machine. Each time Claude attempts to stop, the hook reads the triage state file, evaluates the current phase, and either **BLOCKs** (with instructions for the next action) or **ALLOWs** (pipeline complete).

## Phase Lifecycle

```
triage → aggregation → meta-review → fix-planning → complete
```

Phases transition forward only. Not every phase is reached — the pipeline exits early when there's nothing to do (e.g., no false positives found).

## Phase: triage

| Condition | Action | Decision |
| --------- | ------ | -------- |
| Pending entries exist | Instruct: launch **triage-investigator** sub-agent for next batch | BLOCK |
| All entries completed | Mutate phase → `aggregation` | BLOCK |

## Phase: aggregation

| Condition | Action | Decision |
| --------- | ------ | -------- |
| Aggregation null or pending | Instruct: launch **triage-aggregator** sub-agent | BLOCK |
| Aggregation failed | Mutate phase → `complete` | ALLOW |
| Aggregation completed, FP entries exist | Mutate phase → `meta-review` | BLOCK |
| Aggregation completed, no FP entries | Mutate phase → `complete` | ALLOW |

FP entries are those routed through `llm-triage` with `result.is_true_positive === false`.

## Phase: meta-review

| Condition | Action | Decision |
| --------- | ------ | -------- |
| Meta-review null or pending | Instruct: launch **triage-rule-reviewer** sub-agent | BLOCK |
| Meta-review failed | Mutate phase → `complete` | ALLOW |
| Meta-review completed, multi-entry FP groups exist | Initialize fix planning, mutate phase → `fix-planning` | BLOCK |
| Meta-review completed, no multi-entry FP groups | Mutate phase → `complete` | ALLOW |

Multi-entry FP groups: groups where more than one entry shares the same `group_id`. Single-entry groups are recorded but do not trigger fix planning.

## Phase: fix-planning

Fix planning iterates over groups sequentially. Each group has four sub-phases:

### Sub-phase: planning

| Condition | Action | Decision |
| --------- | ------ | -------- |
| `plans_written < 5` | Instruct: launch **fix-planner** sub-agents | BLOCK |
| `plans_written >= 5` | Mutate sub-phase → `synthesis` | BLOCK |

### Sub-phase: synthesis

| Condition | Action | Decision |
| --------- | ------ | -------- |
| `synthesis_written === false` | Instruct: launch **plan-synthesizer** sub-agent | BLOCK |
| `synthesis_written === true` | Mutate sub-phase → `review` | BLOCK |

### Sub-phase: review

| Condition | Action | Decision |
| --------- | ------ | -------- |
| `reviews_written < 4` | Instruct: launch **plan-reviewer** sub-agents | BLOCK |
| `reviews_written >= 4` | Mutate sub-phase → `task-writing` | BLOCK |

### Sub-phase: task-writing

| Condition | Action | Decision |
| --------- | ------ | -------- |
| `task_file === null` | Instruct: launch **task-writer** sub-agent | BLOCK |
| `task_file !== null` | Mutate sub-phase → `complete`, proceed to next group | (continue) |

When all groups reach sub-phase `complete`:

| Condition | Action | Decision |
| --------- | ------ | -------- |
| All groups complete | Mutate phase → `complete` | ALLOW |

## Constants

| Name | Value | Purpose |
| ---- | ----- | ------- |
| `REQUIRED_PLANS` | 5 | Number of independent fix plans per group |
| `REQUIRED_REVIEWS` | 4 | Number of review angles per group |

## Edge Cases

| Condition | Behavior |
| --------- | -------- |
| `stop_hook_active === true` (in stdin) | ALLOW — prevents recursive hook invocation |
| No triage state file found | ALLOW — no pipeline active |
| State file unparsable (invalid JSON) | ALLOW — log error and let Claude stop |
| `phase === "complete"` | ALLOW — pipeline already finished |
| Unknown phase value | ALLOW — log error and let Claude stop |
