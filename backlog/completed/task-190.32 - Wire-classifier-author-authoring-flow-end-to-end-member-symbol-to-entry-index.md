---
id: TASK-190.32
title: "Wire the classifier-author authoring flow end-to-end (member_symbol → entry_index)"
status: Done
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

- [x] A permanent-limitation group flows end-to-end: prioritize can produce a
      valid `classifier-author` dispatch from the data it holds (no undocumented
      manual `member_symbol → entry_index` step).
- [x] `get_entry_context.ts` accepts a stable selector (`--member-symbol` +
      `--run-id`) OR prioritize threads `entry_index` through — with a test.
- [x] `prioritize/SKILL.md` step 3a carries a concrete dispatch-prompt template.
- [x] The routing false-negative (true limitation → backlog with no backstop) is
      addressed or explicitly documented as accepted.

<!-- AC:END -->

## Implementation Notes

## High-level summary

The permanent-limitation authoring flow runs end-to-end on the stable member
identity. Prioritize holds `(project, run_id, member_symbol)` per evidence row
and never an `entry_index`, so `get_entry_context.ts` accepts the identity
directly: `--file <path> --name <name> --kind <kind> --line <n>` plus a
mandatory `--run-id`, resolved internally against that run's triage state. The
`--entry` selector remains the triage-investigator path — each caller
dispatches with the key it naturally holds, so the two selectors are both
load-bearing, not compatibility layers.

The resolution's correctness rests on one normalization: published member
symbols carry project-relative paths while state entries may hold absolute
ones. That normalization, `relativize`, is single-sourced in
`src/store/paths.ts` and shared by the publish side (`finalize/output.ts`),
the TP cache (`finalize/confirmed_unreachable_reuse.ts`), and this lookup —
the match key cannot drift. `--run-id` is required in member-symbol mode
because `start_line` is run-specific; a LATEST-run fallback would silently
resolve against the wrong run. Zero matches and collisions fail loud through
`resolution_failure_message`, whose tiered diagnostics name which identity
field diverged (line drift across runs, a `--kind` mismatch, or a wrong-run
selector); the parser, resolver, and diagnostics are pure exported functions
with exact-string tests in `get_entry_context.test.ts`.

`prioritize/SKILL.md` step 3a carries the concrete dispatch-prompt template:
samples come from the group's `PlanTaskEvidence` rows (dedup by
`member_symbol`, cap ~5), the `<group_id>` is minted fresh by the orchestrator,
and a sample whose triage run was pruned is skipped by the agent at fetch time
and noted in `REVIEW.md`. The routing false-negative has its symmetric
backstop: `refactor-investigator` returns a `PERMANENT-LIMITATION: <boundary>`
verdict when a whole group is out of static reach, and prioritize redispatches
that group through step 3a using the same evidence rows — mirroring
classifier-author's "if fixable, stop" gate, so neither misrouting silently
produces the wrong artifact.

Navigation: the selector and resolution live in
`.claude/skills/triage/scripts/get_entry_context.ts`; the dispatch contract in
`.claude/skills/prioritize/SKILL.md` step 3a and
`.claude/agents/classifier-author.md`; the backstop in
`.claude/agents/refactor-investigator.md` and step 3.
