---
id: TASK-190.19.3
title: Update `triage-investigator` prompt and extend dispense payload
status: To Do
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - self-repair-pipeline
  - srp-redesign
dependencies:
  - TASK-190.19.1
  - TASK-190.19.2
parent_task_id: TASK-190.19
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The per-entry investigator becomes the heavy lifter: it must produce one of the five verdict kinds and, for novel cases, carry enough evidence forward that the coordinator can dedupe without re-running the investigation. The dispense payload also has to grow to include the registry slice and current novel-issues snapshot, so investigators can detect classifier regressions and cite existing novel issues without re-fetching the world.

## Scope

### Dispense payload extension

`.claude/skills/self-repair-pipeline/scripts/get_next_triage_entry.ts` (or its successor) extends the dispense payload with:

- `relevant_registry_slice` — list of wip + permanent classifier rules whose `diagnosis_category` matches the entry's category OR whose `file_path_glob` matches the entry's path. Bounded to ~20 rules; sort by `observed_count` descending if more match.
- `novel_issues_snapshot` — the current `novel_issues.json` content at dispense time (issues + citations).
- `entry_context` — unchanged from today (entry index, name, file_path, kind, diagnosis_category, etc.).

### Investigator agent prompt

Rewrite `.claude/agents/triage-investigator.md`:

- Goal: emit exactly one `TriageVerdict` (kinds defined in 190.19.1).
- Instructions:
  1. Read the dispense payload (entry context + registry slice + novel-issues snapshot).
  2. If `novel_issues_snapshot` already contains an issue matching this entry's evidence: emit `fp-novel-cited` immediately and stop. No further investigation needed.
  3. Otherwise, fetch source via Read + call graph via Ariadne MCP `show_call_graph_neighborhood`.
  4. Decide:
     - Real caller exists in source but Ariadne missed it → check `relevant_registry_slice` for a rule whose predicate _should_ match but did not → if so, emit `fp-classifier-regression` with `should_have_matched_rule_id`.
     - Otherwise → emit `fp-novel-new` with `proposed_root_cause` + `evidence_excerpt`.
     - Truly unreachable → emit `tp` with `member_evidence`.
     - Cannot reduce to a single verdict → emit `uncertain` with a one-sentence `reason`.
- Output: raw JSON conforming to `TriageVerdict`, parsed by `parse_triage_verdict` on absorb.

### Tests

- `dispense_payload.test.ts` — given a fixture entry + fixture registry + fixture `novel_issues.json`, assert the slice selection (registry filter) and snapshot inclusion with `toEqual` on the literal payload.
- Update existing investigator-prompt fixture tests to expect the new payload fields.

## Out of scope

- No coordinator changes (already in 190.19.2).
- No removal of aggregation files (190.19.5).
- No curator changes (190.19.6).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Dispense payload includes `relevant_registry_slice` (bounded ≤20 rules) + `novel_issues_snapshot` + `entry_context`
- [ ] #2 `triage-investigator.md` instructs the agent to emit one of the five `TriageVerdict` kinds, no free-form `group_id`
- [ ] #3 Investigator early-exits on `fp-novel-cited` before any source read or MCP call (verified by fixture: snapshot contains matching issue → result file shows no MCP tool use)
- [ ] #4 Registry slice filter selects rules by `diagnosis_category` match OR `file_path_glob` match; sort by `observed_count` descending when truncating
- [ ] #5 `parse_triage_verdict` is invoked on every absorbed result; malformed results halt the absorb path with a clear error (no silent skipping)
<!-- AC:END -->
