---
id: TASK-190.19.10
title: Update SRP and curator READMEs, diagrams, and cross-references
status: Done
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - triage-entrypoints
  - triage-curator
  - srp-redesign
  - docs
dependencies:
  - TASK-190.19.6
  - TASK-190.19.7
  - TASK-190.19.8
  - TASK-190.19.9
parent_task_id: TASK-190.19
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Once the code, schema, and skill rename land, canonical docs must describe the system as it now IS — `triage-entrypoints` instead of `triage-entrypoints`, no Phase 4 aggregation, no `rough-aggregator` / `group-investigator`, no `pass1` / `pass2` directories. Diagrams updated to match. Cross-references in the fix-sequencer task realigned.

## Scope

### triage-entrypoints README

`.claude/skills/triage-entrypoints/README.md`:

- Update the "Pipeline Flow" diagram: collapse the previous Phase 4 (aggregation) into a single "Triage loop" phase that includes the coordinator and `novel_issues.json` store. The umbrella diagram in `task-190.19.md` can be lifted directly.
- Update the "Sub-Agent Summary" table: drop `rough-aggregator` and `group-investigator`; add `triage-coordinator`.
- Update the prose narrative to describe the verdict schema + coordinator path.
- Keep the `## Self-healing pipeline` section heading (chain-level umbrella term).

### Curator README

`.claude/skills/triage-curator/README.md`:

- Update the "Pipeline Flow" diagram: the curator consumes `novel_issues.json` + `classifier_regressions[]` from `triage-entrypoints`. Investigator role is promotion-only.
- Update the prose narrative accordingly.

### Cross-references

- `backlog/tasks/task-190.18 - Build-fix-sequencer-skill-*.md`: confirm the cross-reference points to the renamed skill (`triage-entrypoints`) and that the high-level-flow narrative still matches.
- `.claude/rules/classifier-lifecycle.md`: confirm the write-boundary table — curator remains sole autonomous `wip`-row writer; the `triage-coordinator` writes only the per-run `novel_issues.json`.

### Style

All updates follow the canonical / self-contained documentation style: present tense, describe the system as it IS, no references to "previously", "old", "deprecated", "Phase 4 aggregation", "triage-entrypoints".

## Out of scope

- No code changes (all code-mutating work is in 190.19.1–.9).
- No changes to the `task-190.19` umbrella diagram itself — the README borrows from it.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `triage-entrypoints` README Pipeline Flow diagram contains no `rough-aggregator`, `group-investigator`, `aggregation/slices`, `pass1`, or `pass2` nodes
- [x] #2 `triage-entrypoints` README Sub-Agent Summary table lists `triage-investigator` and `triage-coordinator`; `rough-aggregator` and `group-investigator` are gone
- [x] #3 Curator README Pipeline Flow diagram shows the curator consuming `novel_issues.json` + `classifier_regressions` from `triage-entrypoints`; no residual-group framing
- [x] #4 Cross-reference in `task-190.18` and `.claude/rules/classifier-lifecycle.md` is verified consistent with the renamed skill and new architecture
- [x] #5 No documentation uses "previously", "old", "deprecated", "Phase 4 aggregation", "self-repair-pipeline", or comparable historical-framing language
- [x] #6 `## Self-healing pipeline` section heading remains in the renamed README as the chain-level umbrella term
<!-- AC:END -->

## Implementation Notes

### Curator README (`.claude/skills/triage-curator/README.md`)

Full rewrite of the pipeline narrative around v4 ingestion. Stale banner (the 190.19.6 "diagrams still narrate the pre-v4 residual-groups + QA wave flow" note) is gone. Both Mermaid diagrams (touch-point LR + primary-flow TD) and the maintenance-flow diagram were redrawn:

- **Touch-point LR**: the `triage_results` artifact in the middle of the chain is now labelled `novel_issues[] + classifier_regressions[]` so the dual primary trigger is visible at a glance. Curator's registry write edge is labelled `writes wip · drift_evidence`.
- **Primary-flow TD**: Phase 1 (`curate_all.ts`) now routes by registry status with three labelled exits — `no · new` (dispatch promote-novel), `yes · wip/permanent` (observed-stat bump only), `yes · fixed` (surface resurfacing for human review). `classifier_regressions[]` enters Phase 1 as a parallel input and flows directly into Phase 5's `absorb_classifier_regressions` drift-absorb path with no investigator dispatch. The investigator subgraph is labelled `triage-curator-investigator · opus · 200t · promote-novel` to make the narrowed role from 190.19.7 explicit. Numbering retains the gap at Phase 2 to leave room for the maintenance-flow's QA phase.
- **Maintenance flow TD**: redrawn to show QA as **on-demand** — `get_qa_context.ts` (a manual CLI invocation) is the entry point, not `curate_all`. Confirmed drift exits to finalize as `drift_evidence` with `source: "qa-sample"`, matching the in-flight path's shape distinguished by `source`.

State-files section uses `novel_issue_id` as the per-dispatch identifier (lift from 190.19.6 / 190.19.7).

### triage-entrypoints README (`.claude/skills/triage-entrypoints/README.md`)

The diagram from the rename in 190.19.9 already had no aggregator/group-investigator/pass1/pass2 nodes (AC #1/#2/#6 inherited green). Additional changes here:

- Opening paragraph now names the `TriageVerdict` discriminated union and the coordinator's role inline, so the README is self-contained for a fresh reader who never saw the old design.
- The `## Self-healing pipeline` chain-level diagram and Pipeline Flow diagram had comparative ("rather than a linear pipeline") and meta ("Detail hidden here") framing — both rewritten to canonical present-tense per the project's documentation style.
- The Phase-3 artifact previously drawn as a single combined `novel_issues.json + classifier_regressions.jsonl` node is now two separate artifacts, each labelled with its writer discipline (`dispatcher: single writer · atomic` vs `dispatcher: append-only`). Edges from the branch are now four-way: `fp-novel-*` → coordinator → novel_issues.json; `fp-classifier-regression` → classifier_regressions.jsonl; `tp · uncertain` → in-memory. The "What to look for" caption was updated to call out the dispatcher as the sole writer of both.

### Classifier lifecycle (`.claude/rules/classifier-lifecycle.md`)

- Added a one-liner under the writers table noting that the `triage-coordinator` sub-agent inside triage-entrypoints writes only the per-run `novel_issues.json`, never the registry — preserving the write-boundary contract from TASK-190.19's Constraints section.
- Reframed the "auto-flip is deferred" sentence as present-tense ("The transition stays manual until…").
- Added a paragraph documenting that a resurfaced `fixed` row is surfaced for human review, since the curator never re-flips `fixed → wip`.

### `task-190.18` cross-references

Stale `SRP` acronym references that named a skill invocation (Phase 7 subgraph title, two "what to look for" sentences, one inter-edge label) were updated to `triage-entrypoints`. The structural cross-reference at the top of the high-level flow section already pointed at the renamed skill from the 190.19.9 sweep.

### Review

Five opus reviewers (AC compliance, architecture accuracy, Mermaid coherence, documentation style, cross-reference integrity) ran in parallel. All six AC items confirmed passing on the first draft. Adopted fixes:

- **Architecture**: split the entrypoints diagram's combined novel_issues/classifier_regressions artifact into two nodes with explicit writer discipline; named the dispatcher as the sole writer in the "What to look for" caption.
- **Architecture**: added the `fixed`-row resurfacing exit to the classifier-lifecycle ASCII narrative.
- **Style**: cut comparative framing in the entrypoints README opener ("rather than a linear pipeline"), meta doc-structure commentary in both READMEs ("Detail hidden here", "noted separately so the primary stays a clean top-down flow", "Maintenance flows live below"), and defensive negation ("there is no separate post-investigation validation phase", "never mutates anything other than"). Replaced "deferred" framing in the lifecycle doc with present-tense.
- **Style**: split the dense single-sentence opener in the entrypoints README into two for readability.

Cross-reference integrity review confirmed every relative-path link, script path, module/symbol name, anchor link, and TASK id resolves cleanly — no broken refs.
