---
id: TASK-190.19.8
title: Update `find-promotion-candidates` and verify curator-QA against v4 schema
status: To Do
assignee: []
created_date: "2026-05-20 10:00"
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

- [ ] #1 `find-promotion-candidates` output groups `drift_evidence` entries by `source` and surfaces both counts per wip row
- [ ] #2 Qualifying-criteria function exposes the split (caller can read in-flight count and qa-sample count separately, not just total)
- [ ] #3 `triage-curator-qa` fixture test passes against a v4-shaped input with no agent prompt changes
- [ ] #4 Both `.test.ts` files assert against typed literal expected outputs (no weak existence checks)
<!-- AC:END -->
