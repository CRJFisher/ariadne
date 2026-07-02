---
id: TASK-190.32
title: "Wire the classifier-author authoring flow end-to-end (member_symbol → entry_index)"
status: To Do
assignee: []
created_date: "2026-07-02 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - prioritize
  - authoring-flow
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

TASK-190.30.2 shipped the `classifier-author` agent and the `reconcile-registry
--stage` insertion path, both correctly gated. A regime audit found the authoring
flow is **not end-to-end wired**: a legitimate permanent-limitation group cannot
actually reach the agent as documented.

### The broken link

- `classifier-author` (`.claude/agents/classifier-author.md`) is told its prompt
  carries "a project name and a list of sample triage **entry indices**," and it
  calls `get_entry_context.ts --project <project> --entry <entry_index>`.
- `get_entry_context.ts` keys **exclusively** on the integer `entry_index` (a
  run-local positional index into a triage `state.entries[]` file).
- But `prioritize` reads its groups from the plan engine's `PlanTaskEvidence`
  rows, which carry `project`, `run_id`, and the **stable `member_symbol`**
  (`(file_path, name, kind, start_line)`) — and **deliberately drop `entry_index`**
  because it is line-drift-unstable across sweeps.

So the data prioritize holds (`member_symbol`) is not what `get_entry_context.ts`
accepts (`entry_index`), and nothing documents the `member_symbol + run_id →
entry_index` translation. The flow stalls at the first hop.

Compounding it: `prioritize/SKILL.md` step 3a gives **no concrete dispatch-prompt
template** (unlike every sibling step), so an orchestrator has neither the data
nor the instruction to build a valid `classifier-author` dispatch.

### The fix

Choose one:

1. **Extend `get_entry_context.ts` to accept `--member-symbol <symbol>`** (with
   `--run-id`), resolving `member_symbol → entry_index` internally against the
   run's triage state. This is the more robust option — prioritize keeps the
   stable identity and never handles the unstable index.
2. **Have prioritize carry `entry_index` through** by pairing each plan group
   back to its source `NovelIssue` per `run_id` at dispatch time.

In either case, add a concrete **step-3a dispatch-prompt template** to
`prioritize/SKILL.md` naming exactly what to substitute (`<project>`, the
resolved sample selectors, `<run>`, `<group_id>`), matching the blockquote style
of steps 3, 4, and 7a.

### Secondary: the routing false-negative has no backstop

The audit also noted an asymmetry: a *fixable* bug misrouted to
`classifier-author` is caught (the agent's "if fixable, stop — emit no draft"
gate), but a *true permanent limitation* misrouted to `refactor-investigator` →
backlog has no symmetric "this is actually unfixable, stop" gate, so the
limitation silently never gets its classifier. Consider adding a lightweight
"unfixable?" check to the refactor-investigator path, or a prioritize-step note
that makes the human's permanent-vs-fixable call before dispatch, not only inside
the agent.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A permanent-limitation group flows end-to-end: prioritize can produce a
      valid `classifier-author` dispatch from the data it holds (no undocumented
      manual `member_symbol → entry_index` step).
- [ ] `get_entry_context.ts` accepts a stable selector (`--member-symbol` +
      `--run-id`) OR prioritize threads `entry_index` through — with a test.
- [ ] `prioritize/SKILL.md` step 3a carries a concrete dispatch-prompt template.
- [ ] The routing false-negative (true limitation → backlog with no backstop) is
      addressed or explicitly documented as accepted.

<!-- AC:END -->
