---
id: TASK-190.30
title: "Tighten classifier scope to permanent limitations only and close the authoring gap"
status: To Do
assignee: []
created_date: "2026-06-29 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - prioritize
  - registry
parent_task_id: TASK-190
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The classifier registry currently conflates two semantically distinct roles: (1)
a catalog of patterns that are **permanently unresolvable by static analysis**,
and (2) a suppressor list of patterns that Ariadne **doesn't yet handle** but
could if the relevant code were fixed. This conflation makes the registry hard to
reason about and impossible to maintain: 94% of entries are `wip`, 152 of 169
are unfilled stubs that never fire, and no pipeline tooling exists to create a
new classifier — the gap between a plan proposal and a live registry entry is
entirely manual.

### Current state

**Registry distribution (180 entries):**

- `wip`: 169 entries — 94% of the registry
- `permanent`: 9 entries — 5%
- `fixed`: 2 entries — 1%

Of the 169 wip entries:

- 105 have `classifier.kind = "none"` — they carry the description "Proposed by
  plan investigator — fill in before enabling" and never fire during triage
- 61 have `kind: "builtin"` — they suppress triage cost but many represent
  deferred fixable bugs, not permanent limitations
- 13 have `kind: "predicate"`
- ~30 have `backlog_task` links to fixable bugs (clearly deferred features, not
  permanent limitations)
- ~14 with names like `eval-based-dynamic-dispatch`, `dynamic-runtime-injection`,
  `compiler-generated-dynamic-dispatch` represent genuinely impossible patterns
  filed as `wip` simply because they have never been formally reviewed for
  promotion

**Creation gap:** No pipeline agent authors classifiers. `plan` proposes
`PlanTask` rows for classifier work but produces no classifier artifacts.
`prioritize` routes classifier-work rows to backlog tasks. The actual predicate
expression or builtin function must be authored entirely by hand, with no
tooling.

### Proposed solution

Redefine the registry as the **permanent-limitations catalog**: a closed set of
patterns where the call relationship is fundamentally unknowable to a static
analyzer — dynamic dispatch via computed keys, runtime invocation through
interpreter protocols, macro expansion invisible to the pre-expansion AST,
callers in unindexed external modules. Deferred-feature patterns that represent
fixable Ariadne bugs live exclusively in the backlog, not the registry.

Close the authoring gap by adding a `classifier-author` agent to the `prioritize`
skill that produces a validated classifier draft for permanent-limitation groups,
staged for human review and insertion via `reconcile-registry`.

The user explicitly accepts short-term triage coverage loss from removing wip
suppressor classifiers for deferred-feature patterns.

### Changes

Two sub-tasks cover the work:

**TASK-190.30.1 — Registry audit and cleanup** — Categorize every wip entry as
permanent limitation or deferred feature, execute dispositions (promote ~14
impossible-pattern entries to `permanent`, remove ~155 deferred-feature stubs),
and update documentation. See sub-task for detail.

**TASK-190.30.2 — Add `classifier-author` agent to `prioritize`** — New
sub-agent that takes a triage novel group categorized as a permanent limitation
and produces a draft `KnownIssue` entry (predicate or builtin kind) plus a
`reconcile-registry` command for the human to apply. Adds a `--stage` insertion
path to `reconcile_registry.ts` for validating and atomically inserting a
classifier authored outside the script. See sub-task for detail.

### Lifecycle contract after this change

The fundamental invariant — **the human is the registry's sole decider** — is
unchanged. What changes is the semantic scope of entries and the tooling
available to the human when authoring them.

The tightened lifecycle:

1. Triage emits `fp-novel` for unclassified permanent-limitation patterns
2. Plan groups them by fault area
3. Prioritize, for permanent-limitation groups, dispatches `classifier-author`
   which produces a staged draft
4. Human reviews the draft, runs `reconcile-registry --stage <draft>` to insert
   as `wip` with a real classifier
5. Classifier fires during triage over multiple runs; if stable, human promotes
   via `reconcile-registry --id <group_id> --promote` → `permanent`
6. Fixable-bug patterns are not in the registry at all; they live as backlog tasks

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] All 169 wip entries in `registry.json` have been reviewed and disposed:
      genuinely impossible patterns promoted to `permanent`, deferred-feature
      stubs removed (and confirmed covered by existing backlog tasks where
      applicable).
- [ ] `permanent_data.ts` regenerated and `permanent_data.sync.test.ts` passes.
- [ ] The `classifier-author` agent exists and integrates with the `prioritize`
      skill flow for permanent-limitation groups.
- [ ] `reconcile_registry.ts` supports a `--stage <draft-path>` insertion mode
      that validates and atomically inserts a classifier draft file.
- [ ] `.claude/rules/classifier-lifecycle.md` reflects the tightened scope: only
      permanent limitations enter the registry; deferred features are backlog-only.
- [ ] Triage SKILL.md and prioritize SKILL.md are updated to document the new
      authoring path.

<!-- AC:END -->

## Sub-tasks

- TASK-190.30.1: Registry audit and cleanup
- TASK-190.30.2: Add `classifier-author` agent to `prioritize`
