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
   - `classifier.kind`: always `"builtin"` — the predicate DSL is removed by this
     task; every classifier is a bespoke `BuiltinCheckFn`
   - `function_name` referencing the new builtin
   - `status: "wip"` — starts as candidate before promotion
   - `min_confidence: 0.95`

2. `check_<group_id>.ts` — the self-contained `BuiltinCheckFn` implementing the
   detection logic, ready to be placed in
   `packages/core/src/classify_entry_points/builtins/`.

3. `REVIEW.md` — a brief human-readable summary: what the pattern is, why it is
   a permanent limitation (not a fixable bug), which entry points from the triage
   run it would have matched, and a review checklist.

**Agent constraints:** Always emits a `builtin` — the predicate DSL has been
removed, so every classifier is a bespoke `BuiltinCheckFn`. The agent authors the
self-contained detection function directly. Never writes `registry.json`.

### Predicate DSL removal

This task also removes the classifier predicate DSL entirely; every registry
classifier becomes a `builtin`:

- Deletes `PredicateClassifierSpec`, `PredicateExpr`, `PREDICATE_OPERATORS`,
  `PredicateOperator`, and `ClassifierAxis` from `packages/types/src/known_issues.ts`;
  narrows `ClassifierSpec` to `none | builtin | retired` (and `retired.from` to
  `BuiltinClassifierSpec`).
- Deletes `predicate_evaluator.ts` and its test; drops the predicate arm from
  `classify_entry_points.ts`, the compiled-pattern clone chain from
  `registry_loader.ts`, the predicate-tree guard from `enrich_call_graph.ts`, the
  `validate_predicate_expr` validator and axis/operator sets from
  `known_issues_registry.ts`, and the predicate diagnosis-inclusion path from
  `dispense_payload.ts` (relevance falls back to language match only).
- Converts the existing permanent `predicate` registry entries to `builtin`
  classifiers (new `check_*.ts` under `builtins/`, barrel updated) and regenerates
  the permanent slice.
- Retires the `unindexed-external-module` rule: its predicate compared against a
  `resolution_failure.reason` value that does not exist in the enum, so it never
  fired; converting it faithfully is impossible and no available signal expresses
  its intent without over-matching, so it is dropped from the registry.

### `reconcile_registry.ts --stage <draft-path>` insertion path

Add a new subcommand to `reconcile_registry.ts` that provides a validated human-
operated insertion path:

```
node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts \
  --stage ~/.ariadne/prioritize/<run>/classifier-author/<group_id>/draft_entry.json
```

Behaviour:

1. Read and validate `draft_entry.json` against the `KnownIssue` schema
   (`validate_registry`, which also enforces the `observed_count >= 1` evidence gate).
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
- [ ] Agent produces a valid `draft_entry.json` (passes the `KnownIssue` schema)
      and `REVIEW.md` for a permanent-limitation group.
- [ ] Agent always emits `kind: "builtin"` with a self-contained
      `check_<group_id>.ts` `BuiltinCheckFn` (the predicate DSL is removed).
- [ ] The predicate DSL is removed: `PredicateExpr` / `PREDICATE_OPERATORS` /
      `PredicateClassifierSpec` / `ClassifierAxis` deleted from `@ariadnejs/types`;
      `ClassifierSpec` is `none | builtin | retired`; `predicate_evaluator.ts` and
      its test deleted.
- [ ] The existing permanent `predicate` registry entries are converted to
      `builtin` classifiers (barrel updated, permanent slice regenerated) and
      `permanent_data.sync.test.ts` passes; the non-firing
      `unindexed-external-module` rule is retired.
- [ ] `pnpm build` and the full test suite pass after removal (no dangling
      `predicate` type/import references).
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
