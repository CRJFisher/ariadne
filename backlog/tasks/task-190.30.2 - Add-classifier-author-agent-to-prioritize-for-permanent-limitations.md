---
id: TASK-190.30.2
title: "Add `classifier-author` agent to `prioritize` for permanent-limitation groups"
status: To Do
assignee: []
created_date: "2026-06-29 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - prioritize
  - tooling
parent_task_id: TASK-190.30
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

After TASK-190.30.1, the registry contains only promoted permanent entries.
When triage surfaces a novel group that represents a permanent limitation, there
is no tooling to produce a classifier for it — the human must hand-author the
predicate expression or builtin function with no assistance. This task closes
that gap by adding a `classifier-author` agent to the `prioritize` skill and a
`--stage` insertion path to `reconcile_registry.ts`.

### The authoring gap today

The `prioritize` skill routes novel groups via two paths controlled by the
`--priority` flag:

- `--priority core`: dispatches `refactor-investigator` to design a code change;
  graduates to a backlog task.
- `--priority classifier`: also graduates to a backlog task (a human-work card
  saying "author a classifier for this group").

The second path ends in a backlog task that is itself manual work. There is no
agent that actually produces the classifier artifact. After TASK-190.30.1,
permanent-limitation groups should not become backlog tasks at all — they should
become registry entries with authored classifiers.

### New path: `--priority permanent`

Add a third prioritize routing: `--priority permanent` selects novel groups that
the human has identified as permanent limitations (not fixable bugs). For these
groups, `prioritize` dispatches the `classifier-author` agent instead of
`refactor-investigator`. The agent produces a staging artifact; the human reviews
and applies it via `reconcile-registry --stage`. No backlog task is created.

### `classifier-author` agent

A new sub-agent (`.claude/agents/classifier-author.md`) with a scoped tool
allowlist: reads `packages/core`, reads the triage entry context via
`get_entry_context.ts`, writes only to its staging directory.

**Input:** One novel-group payload — the same structure the triage investigator
receives: group evidence, sample entry points, source context from the target
project.

**Output (staging dir: `~/.ariadne/prioritize/<run>/classifier-author/<group_id>/`):**

1. `draft_entry.json` — a complete `KnownIssue` object ready for registry
   insertion, with:

   - `group_id`, `title`, `description` — describing the permanent limitation
   - `classifier.kind`: `"predicate"` for patterns expressible in the predicate
     DSL; `"builtin"` for patterns requiring custom logic
   - For predicate kind: a valid `expression` tree (using operators from
     `PredicateExpr` in `packages/types/src/known_issues.ts`)
   - For builtin kind: a `function_name` referencing the new builtin
   - `status: "wip"` — starts as candidate before promotion
   - `min_confidence: 0.95`

2. `check_<group_id>.ts` (builtin kind only) — the `BuiltinCheckFn` stub
   implementing the detection logic, ready to be placed in
   `packages/core/src/classify_entry_points/builtins/`.

3. `REVIEW.md` — a brief human-readable summary: what the pattern is, why it is
   a permanent limitation (not a fixable bug), which entry points from the triage
   run it would have matched, and a review checklist.

**Agent constraints:** Prefers `predicate` over `builtin` — predicates require no
TS compilation. Falls back to `builtin` only when the detection logic requires
file-path regex, `ariadne_call_refs` length checks, or multi-condition logic the
predicate DSL cannot express. Never writes `registry.json` directly.

### `reconcile_registry.ts --stage <draft-path>` insertion path

Add a new subcommand to `reconcile_registry.ts` that provides a validated human-
operated insertion path:

```
node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts \
  --stage ~/.ariadne/prioritize/<run>/classifier-author/<group_id>/draft_entry.json
```

Behaviour:

1. Read and validate `draft_entry.json` against the `KnownIssue` Zod schema.
2. Verify `group_id` does not already exist in the registry (error, not silent
   overwrite).
3. Verify that if `kind === "builtin"`, the referenced `function_name` exists in
   `BUILTIN_CHECKS` (i.e. the `.ts` file has been placed and the barrel rebuilt).
4. Dry-run by default: print the entry that would be inserted and exit.
5. `--apply` flag: insert the entry via `atomic_update_registry`, appending to
   the rules array.

If `kind === "builtin"`, the human is responsible for placing the `.ts` file and
rebuilding (`pnpm build --filter core`) before running `--stage` with `--apply`.
The check in step 3 enforces this.

This respects the atomic-registry contract (`.claude/rules/classifier-lifecycle.md`):
the human runs the command, the script validates and writes through
`atomic_update_registry`. No agent writes `registry.json` directly.

### Prioritize skill update

Update `.claude/skills/prioritize/SKILL.md`:

- Document `--priority permanent` as the new path for novel groups that are
  permanent limitations.
- Document that `classifier-author` runs in place of `refactor-investigator` for
  these groups.
- Document the staging artifact layout and the `reconcile-registry --stage`
  review workflow.
- Update the step-3 description to reflect the new routing.

### Lifecycle doc update

Update `.claude/rules/classifier-lifecycle.md`:

- Add the `classifier-author` as the new entry creator (alongside the human
  path); the agent produces the draft, the human inserts and later promotes.
- Remove the `wip + kind:none` stub state as a lifecycle stage.
- Document the staging directory as the handoff surface between agent and human.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] `classifier-author` agent exists at `.claude/agents/classifier-author.md`
      with scoped tools: `get_entry_context.ts` reads, `packages/core` reads,
      write only to its staging dir.
- [ ] Agent produces a valid `draft_entry.json` (passes `KnownIssue` Zod schema)
      and `REVIEW.md` for at least one real triage novel group used as a test case.
- [ ] Agent produces `check_<group_id>.ts` when it selects `kind: "builtin"`,
      and always selects `kind: "predicate"` when the DSL is sufficient.
- [ ] `reconcile_registry.ts --stage <path>` validates, dry-runs, and (with
      `--apply`) inserts the entry via `atomic_update_registry`.
- [ ] `--stage` blocks insertion if `kind === "builtin"` and `function_name` is
      absent from `BUILTIN_CHECKS` (fail-loud, not silent skip).
- [ ] `--stage` blocks insertion of a draft with no observation evidence: the
      draft's `observed_count` must be >= 1 (every classifier is authored from an
      observed novel group, so it inherits that group's count). This is the
      authoring-path counterpart to the `validate_registry` evidence gate added in
      TASK-190.30.1 (a wip authored classifier with `observed_count < 1` is rejected),
      and stops speculative, never-observed classifiers from entering the catalog.
- [ ] `reconcile_registry.test.ts` covers `--stage` happy path, duplicate
      group_id rejection, and missing-builtin rejection.
- [ ] `prioritize` SKILL.md documents `--priority permanent`, the
      `classifier-author` dispatch, and the staging → `reconcile-registry --stage`
      review workflow.
- [ ] `.claude/rules/classifier-lifecycle.md` removes the `wip + kind:none` stub
      state and adds the `classifier-author` + `--stage` creation path.
- [ ] The `registry_writers.test.ts` AST-walk still passes (agent never calls a
      raw write function against `registry.json`).

<!-- AC:END -->
