---
id: TASK-190.19.7
title: Narrow `triage-curator-investigator` agent to promotion-only role
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
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The curator's discovery role is gone — the per-entry investigator + run-time coordinator have already identified and named novel issues by the time the curator runs. The curator-investigator's prompt must be rewritten so it does only what the curator uniquely owns: turning a registered novel issue into a `BuiltinClassifierSpec` + an Ariadne deficiency description for a backlog task.

## Scope

### Agent prompt rewrite

`.claude/agents/triage-curator-investigator.md`:

- Drop "discover the root cause of this residual group" / "investigate the underlying detection gap" framing entirely.
- New framing: "given a registered novel issue (`canonical_name`, `root_cause`, `citations[]`), author a `BuiltinClassifierSpec` that would match its members, and identify the Ariadne deficiency (subsystem, suggested fix scope) for the backlog task."
- Inputs simplified — citations (with `evidence_excerpt`) are already in hand; the investigator does not need to re-fetch source for the entries the per-entry investigator already saw, except for spec-authoring spot-checks.
- Output schema unchanged: `BuiltinClassifierSpec` + `ariadne_bug` proposal + `signal_gap` proposal.

### Tests

- Update `triage_curator_investigator_prompt.test.ts` (or equivalent fixture test) to the new input shape and assert the prompt body has no "discover" / "investigate residual" phrasing.

## Out of scope

- Curator absorb / routing (190.19.6).
- `find-promotion-candidates` + curator-QA verification (190.19.8).
- Skill rename (190.19.9).
- Docs prose (190.19.10).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Agent prompt has no "discover" / "investigate residual group" / "underlying detection gap" language
- [ ] #2 Prompt inputs include the full novel-issue record (`canonical_name`, `root_cause`, `citations[]` with evidence)
- [ ] #3 Output schema is unchanged (`BuiltinClassifierSpec` + `ariadne_bug` + `signal_gap`)
- [ ] #4 Fixture test asserts the new prompt body shape with `toEqual` on a typed literal expected snapshot
<!-- AC:END -->
