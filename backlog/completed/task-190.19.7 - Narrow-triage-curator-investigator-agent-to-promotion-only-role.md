---
id: TASK-190.19.7
title: Narrow `triage-curator-investigator` agent to promotion-only role
status: Done
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

- [x] #1 Agent prompt has no "discover" / "investigate residual group" / "underlying detection gap" language
- [x] #2 Prompt inputs include the full novel-issue record (`canonical_name`, `root_cause`, `citations[]` with evidence)
- [x] #3 Output schema is unchanged (`BuiltinClassifierSpec` + `ariadne_bug` + `signal_gap`)
- [x] #4 Fixture test asserts the new prompt body shape with `toEqual` on a typed literal expected snapshot
<!-- AC:END -->

## Implementation Notes

### Agent prompt rewrite (`.claude/agents/triage-curator-investigator.md`)

Replaced the dual-mode "residual / promoted" framing with a single promote-novel role:

- **Purpose**: explicitly names what the agent does *not* own — the coordinator already decided novelty and clustered the citations. The agent's single deliverable is `BuiltinClassifierSpec` + `ariadne_bug` proposal for the registered novel issue.
- **Inputs**: the hydrated bundle now centres on a `NovelIssue` record (`id`, `canonical_name`, `root_cause`, `citations[]` with `entry_index` + `evidence_excerpt`). The `mode` field is the literal `"promote-novel"`.
- **"Trust the citations"**: per-entry investigator already saw the source for each citation; spot-check source only when drafting a classifier check requires it.
- **Positional-index rule**: explicit warning that `positive_examples` / `rejected_members[].entry_index` are positions in `citations[]`, not the citation's own `entry_index` value.
- **`retargets_to` heuristic**: brief scan-the-registry heuristic for recognising an existing classifier that already covers the pattern.
- **Worked-example wording**: clarified that "inspection shows" is agent self-review, not validator output (the validator only checks structural rules, not semantic coverage).

Dropped sections: `## Mode`, `## Residual path`, `## Promoted path`, all five promoted-mode actions (`tighten`/`replace`/`split`/`retire`/`keep`), and the permanent-locked exit. The `keep` and split paths are no longer reachable because the coordinator handles outlier carving upstream.

### Session-log narrowing (`src/types.ts`, `src/session_log.ts`)

- `InvestigatorSessionLog.mode` narrowed from `"residual" | "promoted"` to the literal `"promote-novel"`. The discriminant slot is retained for log readability.
- `InvestigatorFailureCategory` drops `"permanent_locked"` — promoted-path exit no longer reachable.
- `BuiltinClassifierSpec.positive_examples` / `.negative_examples` and `RejectedMember` JSDoc updated to reference `citations[]` positional indexes rather than the stale "`group.entries[]`" / "QA outliers in promoted mode" / "rough-aggregator over-grouped" prose.

### Fixture test (`src/triage_curator_investigator_prompt.test.ts`)

Reads the agent .md file, extracts frontmatter scalars + section headings via an inline minimal parser, and asserts:

1. Frontmatter (name, tools allowlist, mcpServers, model, maxTurns) — pinned `toEqual` against a typed literal. `description` is intentionally excluded as editorial prose.
2. H1 + ordered H2 section list — pinned `toEqual` against a typed literal array (catches silent additions/reorderings).
3. Forbidden substrings — fails if any residual/promoted/discovery framing creeps back in (covers all three AC #1 phrases plus old field names like `qa_outliers`, `registry_entry`, `permanent_locked`, `FalsePositiveGroup`).
4. Required substrings — fails if the new framing (novel_issue_id, canonical_name, root_cause, citations[], evidence_excerpt, promote-novel, retargets_to, validator script paths) is accidentally erased.

### Test/typecheck status

- Curator skill: 17/17 test files, 209/209 tests pass; `tsc --noEmit` clean.
- Self-repair-pipeline skill: `tsc --noEmit` clean.

### Review

Five opus reviewers ran in parallel. Adopted fixes:

- (#1) Worked-example clarified — validator only checks structural rules.
- (#2) Renamed test file to `triage_curator_investigator_prompt.test.ts` to match the task's own naming; relaxed the over-narrow `description` pin; added `validate_responses.ts` / `get_investigate_context.ts` / `retargets_to` to the required-substring list; added capitalised forbidden variants.
- (#3) Verified no production callers depend on the dropped `mode` union or `permanent_locked` literal across the worktree.
- (#4) Added "you do not re-decide novelty" sentence, positional-index distinction, and `retargets_to` heuristic.
- (#5) Dropped the speculative-future justification from the `mode` JSDoc per constitution (YAGNI / no surplus code); fixed stale JSDoc in `BuiltinClassifierSpec` and `RejectedMember` that still referenced `group.entries[]` and promoted mode.
