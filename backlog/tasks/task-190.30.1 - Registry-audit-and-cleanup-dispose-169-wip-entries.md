---
id: TASK-190.30.1
title: "Registry audit and cleanup: dispose 169 wip entries"
status: To Do
assignee: []
created_date: "2026-06-29 00:00"
labels:
  - self-repair
  - classifier-lifecycle
  - registry
parent_task_id: TASK-190.30
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Audit all 169 wip entries in `.claude/skills/triage/known_issues/registry.json`
and dispose each according to the tightened scope: the registry is the
permanent-limitations catalog only. Deferred-feature entries are removed.

### Disposition categories

Each wip entry falls into exactly one category:

**Promote** — Genuinely impossible to resolve by static analysis. The pattern
represents a fundamental structural limitation: dynamic runtime binding,
macro-expansion opacity, unindexed-external callers, interpreter-protocol
invocations. Has an authored classifier (`kind: "predicate"` or `"builtin"`).
Action: `reconcile-registry --id <group_id> --promote` → `permanent`.

**Remove-stub** — Has `classifier.kind = "none"` and no authored classifier.
Either a deferred feature or a permanent limitation that was stubbed before
being classified. 105 entries carry the description "Proposed by plan
investigator — fill in before enabling." Action: delete entry from registry.
If it represents a genuine permanent limitation that warrants a classifier,
it will re-enter via TASK-190.30.2's `classifier-author` path.

**Remove-deferred-tracked** — Has a `backlog_task` link to a fixable Ariadne
bug. The fix is already in the backlog. The classifier (if present) was
suppressing triage cost for a pattern whose underlying bug is already tracked.
Action: delete entry from registry (backlog task remains, no new task needed).

**Remove-deferred-untracked** — Has an authored classifier (`kind: "builtin"` or
`"predicate"`) for a fixable Ariadne bug but NO `backlog_task` link. This is
the critical gap: the classifier exists because the pattern is real and
high-volume, but no task tracks the underlying fix. Removing the entry without
first creating a task loses the signal entirely — the pattern will re-emerge as
`fp-novel` in future triage runs with nothing in the backlog driving its fix.
Action: **create a new backlog task for the underlying bug first**, then delete
the registry entry (with the new task id set as `backlog_task` before removal
for audit trail purposes). The backlog task is the deliverable here; the entry
deletion is the cleanup.

**Keep-pending** — Has an authored classifier and may represent a permanent
limitation, but the evidence is ambiguous. Action: leave as `wip`, document the
ambiguity in the entry's `description`, revisit after TASK-190.30.2 is
complete.

### Pre-classified entry guidance

Based on the audit findings:

**Promote candidates (~14 entries):** `eval-based-dynamic-dispatch`,
`dynamic-runtime-injection`, `compiler-generated-dynamic-dispatch`,
`dynamic-method-dispatch`, `dynamic-dispatch`, `type-cast-dispatch`,
`type-cast-receiver`, `dynamic-cast-structural-type-dispatch`,
`dynamic-or-untyped-property-access`, `dependency-injection-type-resolution`,
`dynamic-new-function-dispatch`, `string-keyed-dispatch`,
`computed-property-method-caller`, `prototype-dispatch`,
`prototype-method-dispatch`. Each has an authored builtin classifier and a name
that indicates runtime/dynamic binding. Verify description confirms the pattern
is a permanent limitation before promoting.

**Remove-stub candidates (105 entries):** All entries with `classifier.kind =
"none"`. These are plan-generated placeholders that have never fired during
triage. Delete them. If any turns out to represent a high-priority permanent
limitation (e.g. top-5 by `observed_count` in a recent triage run), note it for
TASK-190.30.2 to produce a proper classifier.

**Remove-deferred candidates (~30 entries):** All entries with a `backlog_task`
field: `method-call-unresolved` (TASK-184), `test-file-callers-missed` (TASK-182),
`aliased-re-export` (TASK-156), `python-module-attribute-call` (TASK-190.11),
`cross-package-call` (TASK-190.13), `inline-constructor-method-chain` (TASK-187),
`callers-not-in-registry-unclassified` (TASK-202), `cross-package-registry-gap`
(TASK-198), and others. The fix is tracked; the registry entry adds no value.

### Execution order

1. Write a disposition script (scratch, not committed) that reads `registry.json`
   and produces a JSON disposition map: `{ group_id, kind, status, backlog_task,
has_classifier, proposed_disposition, rationale }` for all 169 entries. Review
   the map before making any writes.

2. For each **remove-deferred-untracked** entry: author a new backlog task for
   the underlying Ariadne bug (the pattern is real and observed; the task
   documents what needs to be fixed and at what altitude). The task goes under
   the appropriate parent (e.g. TASK-190 for resolution gaps). Record the new
   task id in the disposition map. This step happens before any registry edits
   so nothing is deleted until the tracking exists.

3. For each **promote** entry: verify the classifier still correctly identifies
   the pattern (sanity-check the predicate expression or builtin name), then run
   `node --import tsx .claude/skills/triage/scripts/reconcile_registry.ts --id
<group_id> --promote`.

4. For each **remove-stub**, **remove-deferred-tracked**, and
   **remove-deferred-untracked** entry: write and run a one-off script using
   `atomic_update_registry` to delete the entries in a single transaction (not
   individually — avoid 150+ separate writes). Print a dry-run summary first;
   apply after review.

5. Regenerate `permanent_data.ts`:
   `node --import tsx .claude/skills/triage/scripts/generate_permanent_data.ts`

6. Verify `permanent_data.sync.test.ts` passes: `pnpm test --filter core`.

### Coverage impact

Removing wip entries that had authored classifiers means triage will re-investigate
those entries as `fp-novel` on the next run. This is expected and accepted. The
`confirmed_unreachable_reuse` cache will not help since these entries were
previously auto-classified and have no stored `tp` verdicts. The coverage
degradation is the intended outcome: these patterns belong in the fix backlog,
not the suppressor registry.

### No backward-compatibility stubs

Do not add deprecation comments, compatibility shims, or any annotation linking
the removed entries to their prior classifier implementation. The builtins for
removed entries are no longer referenced and may be deleted from
`packages/core/src/classify_entry_points/builtins/` if they are not referenced
by any remaining entry. Check the barrel `builtins/index.ts` and remove orphaned
registrations.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A disposition map has been produced and reviewed before any registry write.
- [ ] All wip entries with `classifier.kind = "none"` are removed from the registry.
- [ ] All wip entries with `backlog_task` links to fixable Ariadne bugs are removed
      from the registry.
- [ ] ~14 impossible-pattern wip entries with authored classifiers are promoted to
      `permanent` via `reconcile-registry --promote`.
- [ ] Orphaned builtin `.ts` files (whose `function_name` no longer appears in any
      registry entry) are deleted from `builtins/` and removed from `builtins/index.ts`.
- [ ] `permanent_data.ts` is regenerated and `permanent_data.sync.test.ts` passes.
- [ ] `registry_writers.test.ts` passes.
- [ ] Every `remove-deferred-untracked` entry (authored classifier, fixable bug,
      no existing `backlog_task`) has a new backlog task created before the entry
      is deleted. No deferred-feature classifier is removed without a tracking
      task in place.
- [ ] `.claude/rules/classifier-lifecycle.md` is updated: the `wip` + `kind:none`
      stub pattern is removed as a documented lifecycle state; the new entry point
      is the `classifier-author` agent producing a draft with a real classifier.

<!-- AC:END -->
