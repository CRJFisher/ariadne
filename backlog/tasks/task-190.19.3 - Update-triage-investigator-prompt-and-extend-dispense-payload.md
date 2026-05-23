---
id: TASK-190.19.3
title: Update `triage-investigator` prompt and extend dispense payload
status: In Progress
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

## Implementation notes

### Slice filter adapted to the actual `KnownIssue` schema

The spec text reads "rules whose `diagnosis_category` matches the entry's category OR whose `file_path_glob` matches the entry's path." Neither field exists on `KnownIssue` (see `packages/types/src/known_issues.ts`). The implemented filter substitutes signals that *do* exist on the schema:

- **`languages` ∋ entry-language** (derived from file extension via `language_from_extension`) — stands in for `file_path_glob`. A rule that targets TypeScript is "in scope" for any `.ts`/`.tsx` entry.
- **`classifier` is a predicate whose tree contains `diagnosis_eq: <entry.diagnosis>`** — stands in for `diagnosis_category`. The recursive walk handles `all`/`any`/`not` wrappers.

This preserves the spec's intent (in-scope subset by category-ish + path-ish signal) using the schema as it is, per YAGNI. If `diagnosis_category` / `file_path_glob` fields are added later, the filter can switch to direct equality without affecting downstream contracts.

### Multi-agent review fixes folded in

Five Opus reviewers (architecture, AC compliance, test coverage, adversarial failure-mode, API/DDD) surfaced one critical and several high-priority findings. The implementation incorporates them:

- **CRITICAL**: `triage-investigator.md` was missing the `mcpServers: [ariadne]` block and an `mcp__ariadne__show_call_graph_neighborhood` tool grant. The non-early-exit hot path (step 3) requires the MCP call; without the grant, the agent would have failed at runtime.
- **HIGH**: `detect_language` (private to the original payload module) was extracted to `src/language_from_extension.ts` and renamed `language_from_extension` so future callers (curator, auto_classify) can import without a backward dependency.
- **HIGH**: The investigator prompt now explicitly forbids `fp-novel-cited` when the snapshot is `{ issues: [], flagged: [] }` — preventing a wasted coordinator round-trip that would just downgrade to `flag`.
- **HIGH**: `substitute_template` was collapsed to take the `DispensePayload` directly instead of pulling entry + slice + snapshot apart, removing a three-way coupling in the call site.
- **HIGH**: `triage_state_paths.test.ts` extended to cover the two new path helpers (`novel_issues_path_for`, `coordinator_log_path_for`).
- **MEDIUM**: Added a slice-filter test for `not`/`any` predicate wrappers — locks in the recursion through every combinator branch.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Dispense payload includes `relevant_registry_slice` (bounded ≤20 rules) + `novel_issues_snapshot` + `entry_context`
- [x] #2 `triage-investigator.md` instructs the agent to emit one of the five `TriageVerdict` kinds, no free-form `group_id`
- [x] #3 Investigator early-exits on `fp-novel-cited` before any source read or MCP call (instruction normative in the prompt; agent-fixture verification deferred to e2e)
- [x] #4 Registry slice filter selects in-scope rules and sorts by `observed_count` descending when truncating (see Implementation notes — filter uses `languages` + predicate `diagnosis_eq` scan in place of the spec's `diagnosis_category` / `file_path_glob` fields, which do not exist on `KnownIssue`)
- [x] #5 `parse_triage_verdict` is invoked on every absorbed result; malformed results halt the absorb path with a clear error (no silent skipping) — implemented in 190.19.2 (`absorb_verdict.ts:143`)
<!-- AC:END -->
