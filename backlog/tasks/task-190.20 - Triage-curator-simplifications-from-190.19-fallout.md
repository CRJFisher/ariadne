---
id: TASK-190.20
title: >-
  Triage-curator simplifications enabled by 190.19 (dead-code subtraction,
  Phase 4 collapse, foundational hardening)
status: To Do
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - self-repair
  - triage-curator
  - simplification
  - capstone
dependencies:
  - TASK-190.19
parent_task_id: TASK-190
priority: high
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

TASK-190.19 collapsed the upstream Phase 4 aggregation cascade and moved the
full triage decision into the per-entry investigator, leaving the curator
consuming v4 `triage_results/<run-id>.json` (`novel_issues[]` +
`classifier_regressions[]`). A 15-agent post-redesign review surfaced
remaining drift and several structural opportunities the v4 shape now
permits but the implementation did not yet take. A second 5-agent review
after the 190.19 cleanup commit confirmed which opportunities survived
and which had already landed.

This umbrella collects those opportunities. The unifying theme is the
same as 190.19's: **delete what's now unused, collapse phases that have
shrunk to a single call, and pin foundational correctness issues** that
the upstream redesign did not touch.

The headline finding is that the **entire QA wave is now dead** —
producer artefacts (`get_qa_context.ts`, `triage-curator-qa` agent,
`source_excerpt.ts`, `QaResponse` types, `mark_drift_in_registry`) are
intact but no caller loads them. `finalize_run.ts:311` invariably passes
`apply_proposals([], …)` and hard-codes `qa_groups_checked: 0`,
`qa_outliers_found: 0` at lines 390–391. `absorb_classifier_regressions`
(from 190.19.4) is the sole drift writer in practice. That deletion
alone removes ~15 files, ~6 types, and one sub-agent.

Beyond the QA-wave subtraction, the v4 shape makes the investigator's
`mode` field a singleton, the puller's `sort_by_drift_priority` a
constant function, and Phase 4 a one-script-call pass that does not earn
its own phase boundary. Several foundational correctness gaps surfaced
in prior reviews (atomic sentinel writes, finalize idempotency, MCP
task-id persistence, union exhaustiveness, the shared `atomic_write`
mirror) also remain open and are folded in here because they are cheap
to address alongside the simplifications.

## Scope (sub-tasks)

Split into eight sub-tasks below, ordered roughly by independence and
risk. Sub-tasks .1, .3, .4 are pure subtraction / renames and can land in
any order. Sub-task .2 (Phase 4 collapse) is independent. Sub-tasks .5
and .6 are correctness fixes; .7 is the shared-package extraction;
.8 is the residual sweep that lands last.

- **TASK-190.20.1** — Delete the dead QA wave (entire chain from producer
  script through the `qa-sample` `DriftEvidenceSource` variant)
- **TASK-190.20.2** — Collapse Phase 4 render into the investigator's
  self-validate loop (or into `finalize_run.ts`)
- **TASK-190.20.3** — Drop vestigial dispatch concepts (mode singleton,
  `sort_by_drift_priority` no-op, `RunDispatch.classifier_regressions`
  echo, `fixed_novel_issue_resurfacings` dead bookkeeping)
- **TASK-190.20.4** — Rename `group_id → novel_issue_id` on dispatch
  types; keep `group_id` registry-side only
- **TASK-190.20.5** — Make finalize atomic + idempotent, persist
  MCP-created task ids before linkage
- **TASK-190.20.6** — Type exhaustiveness sweep (`Set`-based runtime
  lookups → `satisfies Record<Union, …>` patterns)
- **TASK-190.20.7** — Hoist `atomic_write` + tsx-invocation guard +
  `errors.ts` to a shared workspace package; drop the cross-skill deep
  import in `finalize_run.ts`
- **TASK-190.20.8** — Add `finalize_run.ts` test coverage + residual doc
  / cast / naming sweep

## Acceptance criteria

<!-- AC:BEGIN -->

- [ ] #1 All eight sub-tasks land or have been explicitly de-scoped with a
      written rationale
- [ ] #2 `pnpm test` is green inside `.claude/skills/triage-curator/` and
      `.claude/skills/triage-entrypoints/`
- [ ] #3 No file under `.claude/skills/triage-curator/` references
      `QaResponse`, `QaOutlier`, `mark_drift_in_registry`,
      `triage-curator-qa`, `get_qa_context`, or `source_excerpt`
- [ ] #4 No occurrence of `qa-sample` as a `DriftEvidenceSource` discriminator
      remains (collapsed to single-source after the QA wave is removed)
- [ ] #5 `scripts/render_classifier.ts` is no longer dispatched from
      `SKILL.md`'s top-level phase flow; the README primary diagram either
      omits a render phase or has it folded into the investigator subgraph
- [ ] #6 `scripts/finalize_run.ts` has a colocated test file covering at
      minimum: sentinel guard, coherence-violation exit code, orphan-cleanup
      safety check, and replay safety after partial failure
- [ ] #7 `src/atomic_write.ts` no longer carries the "Mirror of …"
      comment — both writers import from a single shared module
- [ ] #8 `finalize_run.ts` no longer reaches across the skill boundary
    with `../../triage-entrypoints/scripts/...` imports
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

### Review provenance

Findings consolidated from:

1. A 10-agent pre-190.19 audit of the curator (see chat transcript dated
   2026-05-23) that surfaced architectural, type-soundness, error-handling,
   docs-drift, and performance candidates.
2. The 15-agent post-190.19 review captured in `task-190.19.md`'s
   Implementation Notes (most acted-on findings landed in commit
   `c8342241`; deferred items duplicated here only where still applicable).
3. A 5-agent re-validation pass after `c8342241` (2026-05-24) that
   confirmed which prior findings remained open against current code and
   surfaced the QA-wave dead-path discovery.

### What is NOT in scope here

- **The full information-architecture sub-folder reorg** (stage folders
  like `dispense/`, `verdict/`, `absorb/`, `finalize/`, `store/`)
  recommended by 190.19's architecture-review agent. That is a 50+ file
  reshuffle that warrants its own umbrella separate from this one.
- **Live-run verification** (AC#2 of 190.19) — operator action, not a
  code change.
- **Settings-allowlist entry update** — operator action, deferred from
  190.19.
- **Renaming `failure_category: "group_incoherent"`** to
  `"novel_issue_incoherent"` — semantically right but touches several
  enum-use sites and is purely cosmetic. Logged as a follow-up
  consideration only.
