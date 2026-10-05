---
id: TASK-190.30.1
title: "Registry audit and cleanup: dispose 169 wip entries"
status: Done
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

- [x] A disposition map has been produced and reviewed before any registry write.
- [x] All wip entries with `classifier.kind = "none"` are removed from the registry.
- [x] All wip entries with `backlog_task` links to fixable Ariadne bugs are removed
      from the registry.
- [x] ~14 impossible-pattern wip entries with authored classifiers are promoted to
      `permanent` via `reconcile-registry --promote`. (Landed as 10 + the restored
      `untyped-attribute-receiver`; see summary for why the count differs.)
- [x] Orphaned builtin `.ts` files (whose `function_name` no longer appears in any
      registry entry) are deleted from `builtins/` and removed from `builtins/index.ts`.
- [x] `permanent_data.ts` is regenerated and `permanent_data.sync.test.ts` passes.
- [x] `registry_writers.test.ts` passes.
- [x] Every `remove-deferred-untracked` entry (authored classifier, fixable bug,
      no existing `backlog_task`) has a new backlog task created before the entry
      is deleted. No deferred-feature classifier is removed without a tracking
      task in place.
- [x] `.claude/rules/classifier-lifecycle.md` is updated: the `wip` + `kind:none`
      stub pattern is removed as a documented lifecycle state; the new entry point
      is the `classifier-author` agent producing a draft with a real classifier.

<!-- AC:END -->

## Implementation Notes

### High-level summary

The registry is now the permanent-limitations catalog: every entry names a call
relationship that is fundamentally unknowable to static analysis, and every entry
carries a real classifier. It shrank from 181 entries to 32 — 20 permanent, 10
keep-pending wip, 2 fixed — by disposing all 170 wip entries against the tightened
scope.

The 102 `kind:none` plan-generated stubs and the 12 authored classifiers already
linked to open fix tasks were deleted outright (mechanical). The 56 authored,
no-`backlog_task` entries were investigated one by one — builtin-gate morphology
plus a live `Project` + `extract_entry_point_diagnostics` reproduction against
current `packages/core` — because the spec's named promote-candidate list proved
unreliable (6 of its candidates were fixable resolver gaps, not impossibilities;
4 framework entries it did not name are genuine impossibilities). That investigation
split the 56 into 10 promotions, 12 already-fixed deletions, 19 still-broken fixable
bugs (now tracked), and 10 ambiguous keep-pending entries.

The catalog's permanent entries carry an impossibility rationale in their
`description`; promotions that subsumed byte-identical or strictly-narrower twins
record the subsumption there too. Coverage of the still-broken patterns is preserved
by six new top-level tracking tasks, so removing their suppressor classifiers loses
no signal — the patterns re-surface as `fp-novel` with a backlog task driving the fix.

### Disposition record (the 170 wip entries)

**Deleted — `kind:none` stubs (102).** Plan-generated placeholders carrying
"Proposed by plan investigator — fill in before enabling"; never fired.

**Deleted — authored classifier linked to an open fix task (11 of the 12 tracked).**
`inline-constructor-method-chain` (TASK-187), `python-module-attribute-call`
(TASK-190.11), `callers-not-in-registry-unclassified` (TASK-202), `call-apply-dispatch`
(TASK-204), `typed-field-method-dispatch` (TASK-205), `cross-package-registry-gap`
(TASK-198), `type-based-method-dispatch` (TASK-205), `constructor-instance-method-resolution`
(TASK-187), `framework-command-builder-callback` (TASK-198), `method-call-unresolved`
(TASK-184), `test-file-callers-missed` (TASK-182). The 12th tracked entry,
`untyped-attribute-receiver`, was **promoted** instead (see below).

**Promoted to `permanent` (10 + 1 restored).** Each verified to encode runtime/
build-time impossibility, not a resolver gap:
`dynamic-dispatch` (webpack constructor-keyed Map dispatch), `string-keyed-dispatch`
(Angular ɵɵ via `new Function`; subsumes `angular-generated-instruction-call` and
`compiler-generated-dynamic-dispatch`), `eval-based-dynamic-dispatch`,
`dynamic-new-function-dispatch`, `dynamic-dispatch-reporter-constructor` (mocha
string-keyed reporter ctor), `bundler-module-substitution` (esbuild fill-plugin;
subsumes `bundler-module-path-substitution` and the broader `dynamic-runtime-injection`),
`dynamic-require-constructor`, `framework-lifecycle-handler` (yargs handler contract),
`framework-lifecycle-dispatch` (NestJS reflect-metadata; subsumes
`framework-decorator-dispatch`), `framework-lifecycle-override` (Node stream protocol).
Plus `untyped-attribute-receiver` — its `backlog_task` pointed at its own *Done*
authoring task (TASK-350.3), and the in-scope shape (untyped Cython `object`
`self.<attr>` receiver) is genuinely out of static reach, so it is a permanent
limitation, not a deferred fix. Its builtin and boundary test are retained.

The promote count is 10 (+1), not the spec's "~14", because 5 spec candidates were
deduped twins, 6 were reclassified as fixable/already-fixed, and `prototype-dispatch`
/ `prototype-method-dispatch` were `kind:none` stubs (no classifier to promote).

**Deleted — dedup twins (5).** Redundant with a surviving promotion, so deleted
rather than promoted: `bundler-module-path-substitution` and `dynamic-runtime-injection`
(→ `bundler-module-substitution`), `framework-decorator-dispatch`
(→ `framework-lifecycle-dispatch`, byte-identical gate),
`angular-generated-instruction-call` and `compiler-generated-dynamic-dispatch`
(→ `string-keyed-dispatch`, whose `ɵɵ` + `/packages/core/src/` gate is a strict
superset of the `/render3/` paths).

**Deleted — already-fixed in current core (12), no task needed.** Each had its
underlying edge re-checked with a live repro; the resolver resolves it now, so the
classifier is obsolete. Where a deeper residual gap remains, it is held by a
still-broken classifier (tracked below), so no signal is lost:

| group_id | evidence the edge now resolves |
| --- | --- |
| `constructor-new-expression` | TS `new Foo()` (same-file, named-import, generic, namespaced) resolves to the class constructor; only JS `require`+`new` remains, outside this TS-only gate (→ TASK-354). |
| `method-call-on-typed-instance` | typed local, `import type` callback param, and annotated `.map` callback receivers all resolve. |
| `intra-class-method-call` | TS `this.method()` self-dispatch resolves within class scope. |
| `commonjs-module-property-call` | `var u = require(); u.member()` resolves with a certain edge. |
| `static-method-on-destructured-import` | `const { Cls } = require(); Cls.make()` resolves. |
| `static-method-resolution` | `import { Cls }; Cls.make()` resolves (imported class binds as a value). |
| `import-resolution-missed` | named import + call across a `bin/` subdirectory boundary resolves. |
| `intra-file-call-not-resolved` | top-level `function f(){}` called from a class-method body gains a resolved inbound caller. |
| `intra-file-call-not-in-registry` | intra-file call sites now register a CallReference (diagnosis no longer `callers-not-in-registry`). |
| `same-file-call-missed` | intra-file named-function-expression call now produces a ref (`ariadne_call_refs ≥ 1`). |
| `local-variable-alias` | `var X = NS.X; new X()` now fires a constructor ref; residual alias-resolution gap held by `constructor-call-resolution` (→ TASK-355). |
| `property-alias-intra-file-call` | aliased intra-file call site now registers a ref; residual held by TASK-355. |

**Tracked, then deleted — still-broken fixable bugs (19).** Each confirmed
still-broken by live repro and routed to a new top-level task (audit trail in each
task's "Origin" section): TASK-351 (member/property reference capture: 6),
TASK-352 (`this`/object-literal receiver binding: 4), TASK-353 (cast receiver-type
propagation: 2), TASK-354 (CJS default-export class binding: 2), TASK-355 (intra-file
var-function scope registration: 2), TASK-356 (import/property alias value-flow: 2).
`stored-callback-via-object-property` is covered by existing TASK-190.28 (Case B).

**Kept `wip` — keep-pending (10).** Authored classifiers that are either ambiguous
(untyped-JS `receiver_type_unknown`, structural-cast, generic-return-type) or have
`observed_count: 0` (unvalidated), so neither promotable nor safely deletable. Each
carries a `Keep-pending (TASK-190.30.1)` note in its `description` recording the
ambiguity for a later `classifier-author` review: `jsx-mdx-component-usage`,
`ts-jsx-component-call`, `ts-decorator-factory-call`, `dynamic-cast-structural-type-dispatch`,
`dependency-injection-type-resolution`, `unresolved-receiver-type`, `receiver-type-unknown`,
`aliased-receiver-type-lost`, `super-inherited-method`, `module-attribute-alias`.

### Builtins and verification

46 orphaned builtin sources were deleted and de-registered from the `BUILTIN_CHECKS`
barrel; the barrel now holds exactly 17 classifiers (one per surviving builtin-kind
registry entry). `permanent_data.ts` was regenerated. `permanent_data.sync.test.ts`,
`registry_writers.test.ts`, the `known_issues_registry` seed-content tests (rewritten
to assert the tightened catalog), and the full workspace suites pass.
