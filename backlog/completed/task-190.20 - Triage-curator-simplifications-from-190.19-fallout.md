---
id: TASK-190.20
title: >-
  Triage-curator simplifications enabled by 190.19 (dead-code subtraction,
  Phase 4 collapse, foundational hardening)
status: Done
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
- **TASK-190.20.7** — _Superseded by TASK-190.21.1_ (shared
  `@ariadnejs/skill-fs` package covers the atomic_write +
  tsx-invocation guard + `errors.ts` hoist).
- **TASK-190.20.8** — Add `finalize_run.ts` test coverage + residual doc
  / cast / naming sweep

## Acceptance criteria

<!-- AC:BEGIN -->

- [x] #1 All seven remaining sub-tasks (190.20.1–6, 190.20.8) land or
      have been explicitly de-scoped with a written rationale
      (190.20.7 was superseded by 190.21.1)
- [x] #2 `pnpm test` is green inside `.claude/skills/triage-curator/` and
      `.claude/skills/triage-entrypoints/`
- [x] #3 No file under `.claude/skills/triage-curator/` references
      `QaResponse`, `QaOutlier`, `mark_drift_in_registry`,
      `triage-curator-qa`, `get_qa_context`, or `source_excerpt`
- [x] #4 No occurrence of `qa-sample` as a `DriftEvidenceSource` discriminator
      remains (collapsed to single-source after the QA wave is removed)
- [x] #5 `scripts/render_classifier.ts` is no longer dispatched from
      `SKILL.md`'s top-level phase flow; the README primary diagram either
      omits a render phase or has it folded into the investigator subgraph
- [x] #6 `scripts/finalize_run.ts` has a colocated test file covering at
      minimum: sentinel guard, coherence-violation exit code, orphan-cleanup
      safety check, and replay safety after partial failure
- [x] #7 `src/atomic_write.ts` no longer carries the "Mirror of …"
      comment — both writers import from a single shared module
- [x] #8 `finalize_run.ts` no longer reaches across the skill boundary
    with `../../triage-entrypoints/scripts/...` imports
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

### Wave A landed (2026-05-25)

Sub-tasks 190.20.1, .2, .3, .4 landed as the "subtract + collapse" wave:

- **190.20.1** — entire QA wave deleted (script, agent, types, drift source).
  `DriftEvidence` collapsed to single-source `{ entry_index, evidence_excerpt }`.
- **190.20.2** — Phase 4 render collapsed into `finalize_run.ts` (Option B,
  finalize-owned). New helper `src/render_authored_files.ts` with 6 unit
  tests. `--authored-files` plumbing removed; standalone
  `scripts/render_classifier.ts` deleted (the pure renderer in
  `src/render_classifier.ts` is now invoked from inside finalize).
- **190.20.3** — `InvestigatorSessionLog.mode` singleton dropped;
  `sort_by_drift_priority` deleted (puller no longer reads the registry);
  `RunDispatch.classifier_regressions` count-echo dropped. Decision on
  `fixed_novel_issue_resurfacings`: kept (surfaced via `curate_all` stdout
  for human review).
- **190.20.4** — `group_id` → `novel_issue_id` rename on dispatch-side
  types (`NovelPromoteDispatch`, `DispatchEntry`). Registry-side types
  (`KnownIssue.group_id`, `InvestigateResponse.group_id`,
  `InvestigatorSessionLog.group_id`) retained per the lifecycle boundary.

Wave A reviewed by 5 opus agents post-implementation; their fixes landed
inline (lifecycle-doc label cleanup, JSDoc rephrasing, state-files path
canonicalization, meta.json `bypasses` cleanup, helper-idempotency test,
dedupe-assumption comment).

Tests: 213 passing in `.claude/skills/triage-curator/`; typecheck clean.

Wave B (190.20.5, .6, .8 — atomic finalize + exhaustiveness sweep + tests
and residual cleanup) is the remaining work under this umbrella.

### Wave B landed (2026-05-26)

- **190.20.5** — `finalize_run.ts` made atomic + idempotent (sentinel
  guard, MCP task-id persistence before linkage, replay-safe after
  partial failure). Sidecar contract tightened. Commits `aa27ea72`,
  `3cfc0c9f`.
- **190.20.6** — Type-exhaustiveness sweep: runtime `Set<Union>` lookups
  replaced with `satisfies Record<Union, …>` patterns; ariadne
  root-cause predicate tightened. Commits `2e07149f`, `fdc8d98c`.
- **190.20.8** — `finalize_run.ts` colocated test file added (sentinel
  guard, coherence-violation exit code, orphan-cleanup safety, replay
  safety). CLI guard hardened, tolerant scan, single DI seam.
  Cross-skill `../../triage-entrypoints/scripts/...` import removed
  (AC#8). Commits `3858bc22`, `7e181215`.

The `atomic_write` "Mirror of …" duplication (AC#7) closed via
TASK-190.21.1's `@ariadnejs/skill-fs` extraction — both writers now
import from the shared workspace package.

Parallel scope note: the equivalent `Set<Union>` sweep on the
triage-entrypoints side is parked under **TASK-346**, filed
independently (commit `8ec229dd`). It is not part of this umbrella.

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
