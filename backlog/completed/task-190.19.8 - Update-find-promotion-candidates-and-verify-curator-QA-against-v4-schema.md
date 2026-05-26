---
id: TASK-190.19.8
title: Update `find-promotion-candidates` and verify curator-QA against v4 schema
status: Done
assignee: []
created_date: "2026-05-20 10:00"
updated_date: "2026-05-24 12:58"
labels:
  - self-repair
  - triage-curator
  - srp-redesign
dependencies:
  - TASK-190.19.6
parent_task_id: TASK-190.19
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

`find-promotion-candidates` surfaces `wip` rows that qualify for human `wip → permanent` review. After 190.19.4, wip rows carry the extended `drift_evidence` array with `source: "in-flight" | "qa-sample"`. The script must surface both signal sources so the human reviewer can weight them. The `triage-curator-qa` agent is unchanged in role but reads from the v4 shape — verify with a fixture pass.

## Scope

### `find-promotion-candidates`

`.claude/skills/triage-curator/scripts/find_promotion_candidates.ts`:

- Read each wip row's `drift_evidence` and group entries by `source` in the rendered output.
- Update qualifying criteria: a wip row with N in-flight regressions is a stronger signal than N qa-sample drifts of equal count — surface that distinction in the output (e.g., separate columns or a tagged badge).
- Output format remains markdown-rendered to stdout; downstream invocation flow unchanged.

### `triage-curator-qa` verification

`.claude/agents/triage-curator-qa.md`:

- Agent role unchanged (sample classified groups, flag outliers).
- Input fixture: replace any v3 `groups[]` reference in the test fixture with v4 `novel_issues[].citations[]`.
- Run the existing QA fixture test against v4 and assert no behavior change.

### Tests

- `find_promotion_candidates.test.ts` — registry fixture with mixed-source `drift_evidence` produces an output that distinguishes in-flight vs qa-sample counts. Assert with `toEqual` against a literal expected markdown string.
- `triage_curator_qa_prompt.test.ts` — same expected QA output against the v4-shaped fixture.

## Out of scope

- Investigator agent rewrite (190.19.7).
- Curator absorb (190.19.6).
- Skill rename (190.19.9).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `find-promotion-candidates` output groups `drift_evidence` entries by `source` and surfaces both counts per wip row
- [x] #2 Qualifying-criteria function exposes the split (caller can read in-flight count and qa-sample count separately, not just total)
- [x] #3 `triage-curator-qa` fixture test passes against a v4-shaped input with no agent prompt changes
- [x] #4 Both `.test.ts` files assert against typed literal expected outputs (no weak existence checks)
<!-- AC:END -->

## Implementation Notes

### Surface changes

- `PromotionCandidate` (`src/types.ts`) gained `drift_in_flight_count` + `drift_qa_sample_count` numeric fields alongside the existing `drift_detected` boolean. The boolean remains the authoritative veto gate; the counts are the informational breakdown that lets the human weight in-flight verdicts above qa-sample drifts. The dual role is documented inline on the type.
- `count_drift_evidence_by_source` (`src/promotion_candidates.ts`) is a new exported pure helper that partitions a `KnownIssue.drift_evidence[]` into `{ in_flight, qa_sample }` counts via an exhaustive switch over `DriftEvidenceSource` (a future variant produces a TS error rather than silent mis-attribution).
- `aggregate_promotion_candidates` now populates the new fields on every emitted candidate.
- `format_table` in `scripts/find_promotion_candidates.ts` was exported and the single `drift` boolean column was replaced with paired `drift_inf` + `drift_qa` columns.
- `scripts/get_qa_context.ts` extracted `select_registry_matches` + `sample_members` as exported pure helpers, and gated `main()` behind an `import.meta.url === pathToFileURL(process.argv[1]).href` check so the test file can import without spawning the CLI.

### Tests

- `src/promotion_candidates.test.ts` — added a `count_drift_evidence_by_source` describe block (empty + mixed-source cases) plus an `aggregate_promotion_candidates` row that asserts the full `PromotionCandidate` literal including both new fields, and an empty-`drift_evidence` fallback case.
- `scripts/find_promotion_candidates.test.ts` (new) — pins the rendered table against a typed literal markdown string for a mixed-source registry fixture, and pins the empty-set explanatory message.
- `scripts/triage_curator_qa_prompt.test.ts` (new) — pins the agent frontmatter (with a raw-file `maxTurns: 50` substring guard against snake_case rename regressions), asserts no v3 vocabulary leaks into the body, and tests the v4 selection helpers against a typed `TriageResultsFile` fixture.

### Review pass

Reviewed via five opus agents (architecture, refactor, test-coverage, code, security). Applied fixes: exhaustive switch on `DriftEvidenceSource`, documented the `drift_detected` / split-counts duality on the type, stripped the historical task-id reference from `load_recent_match_history` docstring, dropped the over-broad `novel_issues` forbidden-token assertion (it's a legitimate v4 field name), dropped the over-generic `classifier` required-token assertion, added a raw-file `maxTurns: 50` substring guard, added the empty-`drift_evidence` aggregator test. Deferred (out of scope or pre-existing): `load_recent_match_history` test extraction, dead `llm_attributed_count` branch removal, curator README diagram rewrite (owned by 190.19.10).

`pnpm test` in `.claude/skills/triage-curator/` reports 221 / 221 passing; `pnpm typecheck` at the repo root is clean.
