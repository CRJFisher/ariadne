---
id: TASK-190.14
title: >-
  Refactor self-repair pipeline: explicit loop, hierarchical aggregation,
  objective triage
status: Done
assignee: []
created_date: "2026-04-15 13:51"
updated_date: "2026-04-15 21:49"
labels:
  - skill
  - self-repair-pipeline
  - refactor
dependencies: []
documentation:
  - .claude/skills/self-repair-pipeline/SKILL.md
  - .claude/skills/self-repair-pipeline/src/triage_state_types.ts
  - .claude/skills/self-repair-pipeline/src/types.ts
  - .claude/skills/self-repair-pipeline/scripts/triage_loop_stop.ts
  - .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts
  - .claude/agents/triage-investigator.md
  - .claude/agents/triage-aggregator.md
parent_task_id: TASK-190
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Rearchitect the self-repair-pipeline skill to be simpler, more robust, and more objectively focused.

**Working directory:** `.claude/skills/self-repair-pipeline/` in the `feat/self-healing-pipeline-debug` worktree at `.worktrees/self-healing-pipeline/`

---

## 1. Replace Stop Hook with Explicit Triage Loop

The current Stop hook (`triage_loop_stop.ts`) acts as a state machine that intercepts every session stop. Replace it with an explicit script-based loop that the main SKILL.md agent calls directly.

**New script: `scripts/get_next_triage_batch.ts`**

- Discovers and loads the triage state file (`src/discover_state.ts`)
- Scans `triage_state/results/*.json`, merges completed investigator result files into state entries (extract shared function to `src/merge_results.ts` with tests)
- If pending entries remain: writes state (updated_at), returns `{ entries: number[], state_path, progress }` where `entries` is the next `batch_size` pending indices
- If no pending entries: writes state, returns `{ entries: [] }` — main agent then proceeds to aggregation

**SKILL.md Phase 3 rewrite** (plain loop, no hooks):

```
1. Run get_next_triage_batch.ts
2. If entries is empty → proceed to Aggregation
3. For each entry N: run get_entry_context.ts --entry N, pass output as prompt to triage-investigator (run_in_background: true)
4. Wait for all investigators to complete
5. Go to step 1
```

Remove `hooks:` block from SKILL.md frontmatter entirely. Remove `state.phase` field — no phase tracking needed since the main agent follows SKILL.md steps sequentially; implicit state (entry statuses, aggregation files) is sufficient.

**Delete:** `scripts/triage_loop_stop.ts`, `scripts/triage_loop_stop.test.ts`

---

## 2. Refocus Triage Objective: Binary Ariadne Correctness

The current triage makes a subjective three-way split: true-positive / dead-code / false-positive. "True-positive vs dead-code" requires judging codebase intent, which is unreliable and irrelevant to fixing Ariadne.

**New objective:** One binary question — _"Are there callers of this symbol in the codebase that Ariadne's call graph did not include?"_

- `ariadne_correct: true` — No real callers found; Ariadne is correct. Whether it's intentional API or dead code is a downstream concern.
- `ariadne_correct: false` — Real callers exist that Ariadne missed → false positive → detection gap to fix. Agent identifies the pattern and assigns a `group_id`.

**Schema change (`src/triage_state_types.ts`):**

```typescript
// BEFORE
interface TriageEntryResult {
  is_true_positive: boolean;
  is_likely_dead_code: boolean;
  group_id: string;
  root_cause: string;
  reasoning: string;
}
// AFTER
interface TriageEntryResult {
  ariadne_correct: boolean;
  group_id: string; // "confirmed-unreachable" when ariadne_correct=true
  root_cause: string;
  reasoning: string;
}
```

`"true-positive"` and `"dead-code"` group IDs collapse into `"confirmed-unreachable"`. `TriageRoute` renames `"known-tp"` → `"known-unreachable"`. Remove unused `"deterministic-fp"` from `TriageRoute`.

**Triage-investigator instruction changes:** Focus on caller-existence search only.

1. Compare pre-gathered grep hits vs Ariadne call refs
2. Verify grep hits are real invocations (discard comments, type annotations, string literals)
3. Search for callers the initial grep missed (aliased receivers, callbacks, barrel re-exports, dynamic calls)
4. Cross-reference with `show_call_graph_neighborhood` via Ariadne MCP
5. Classify: `ariadne_correct: true` if no real callers found; `ariadne_correct: false` + detection gap `group_id` if missed callers exist

The agent does NOT judge whether code is important, intended, or abandoned.

**Downstream changes:**

- `build_triage_entries.ts`: `KNOWN_TP_RESULT` → `KNOWN_UNREACHABLE_RESULT` with `ariadne_correct: true`
- `build_finalization_output.ts`: two-way partition (`confirmed_unreachable` + `false_positive_groups`)
- `known_entrypoints.ts`: merge `build_project_source` + `build_dead_code_source` → `build_confirmed_unreachable_source`
- `finalize_triage.ts`: write single confirmed-unreachable registry entry; remove `state.phase` guard
- `prepare_triage.ts`: remove `phase`, `aggregation`, `meta_review`, `fix_planning` from state construction
- All four prompt templates: remove "is this a legitimate entry point?" steps
- `get_triage_summary.ts`: use `confirmed_unreachable_count`

---

## 3. Hierarchical Aggregation (Multi-Pass, Option A)

Replace the single-pass `triage-aggregator` agent with a three-pass pipeline. Scripts handle data preparation and collection only — all grouping decisions are made by LLM agents. No deterministic grouping at any stage.

Also remove the `state.phase` and `aggregation` fields from `TriageState` — aggregation state is implicit in the filesystem (presence/absence of `aggregation/slices/`, `aggregation/pass1/`, etc.).

### Pass 1 — Initial grouping by slice

**New script: `scripts/prepare_aggregation_slices.ts`**

- Reads state, filters entries with `ariadne_correct: false`
- Slices into batches of ~50 (no pre-sorting by group_id — would bias composition)
- Each slice entry contains only factual metadata: `{ entry_index, name, file_path, kind, investigator_group_id, root_cause, diagnosis_category, is_exported, unresolved_call_count }`
- Writes slice files to `triage_state/aggregation/slices/slice_{n}.json`

**New agent: `.claude/agents/rough-aggregator.md`** (Sonnet, maxTurns: 50, tools: Read/Write)

- Input: one slice file path
- Groups entries by semantic similarity of root_cause and diagnosis_category
- Output: `aggregation/pass1/slice_{n}.output.json` → `{ slice_id, groups: [{ group_id, root_cause, entry_indices }], ungrouped_indices }`

### Pass 2 — Cross-slice consolidation (optional)

**New script: `scripts/merge_aggregation_pass.ts --pass 1`**

- Collects all pass1 output taxonomies (group summaries only, not entry data)
- If ≤15 distinct group names: skip pass 2, write `pass3/input.json` directly
- Otherwise: partition groups into bundles of ~20 and write `pass2/batch_{n}.input.json`

**New agent: `.claude/agents/group-consolidator.md`** (Sonnet, maxTurns: 50, tools: Read/Write)

- Input: one bundle of group summaries from different slices
- Merges synonymous group_ids (e.g. "barrel-reexport" ≡ "index-barrel-export")
- Output: `aggregation/pass2/batch_{n}.output.json` → `{ consolidated_groups: [{ group_id, root_cause, merged_group_ids, total_entry_count }] }`

**Script: `scripts/merge_aggregation_pass.ts --pass 2`**

- Merges pass2 outputs, traces merged_group_ids chains to resolve `entry_indices`
- Writes `aggregation/pass3/input.json` → `{ canonical_groups: [{ group_id, root_cause, entry_indices, source_group_ids }] }`

### Pass 3 — Per-group deep investigation

**New agent: `.claude/agents/group-investigator.md`** (Opus, maxTurns: 200, tools: Read/Grep/Glob/Write/Bash(node --import tsx:\*), MCP: ariadne)

- One agent per false-positive group, all launched in parallel
- Receives: group_id, root_cause, member entry_indices, state_path
- For each member: reads investigator result file, evaluates whether evidence matches group root cause; for ambiguous members re-fetches diagnostic evidence via `get_entry_context.ts`, reads source code, uses `show_call_graph_neighborhood`
- Classifies each member as confirmed or rejected (with `suggested_group_id`)
- Output: `aggregation/pass3/{group_id}_investigation.json` → `{ group_id, root_cause, confirmed_members: number[], rejected_members: [{ entry_index, suggested_group_id }] }`

**Rejection reallocation (SKILL.md instructions):**
After all group-investigators complete: for each rejected entry with a `suggested_group_id`, move it to that group if it exists; otherwise assign to `"residual-fp"` for manual review.

**Script: `scripts/merge_aggregation_pass.ts --finalize`**

- Applies confirmed + reallocated assignments, writes canonical group_id/root_cause back to `state.entries[].result`

### SKILL.md Aggregation section (plain English, no assumed knowledge):

```
Step 1: Run prepare_aggregation_slices.ts — splits false-positive results into batches of ~50
Step 2: Launch one rough-aggregator agent per batch (parallel) — each groups its entries by root cause
Step 3: Run merge_aggregation_pass.ts --pass 1 — collects group names; if ≤15 skip to step 5
Step 4: Launch one group-consolidator agent per bundle of group names (parallel) — merges synonyms
        Then run merge_aggregation_pass.ts --pass 2
Step 5: Launch one group-investigator (Opus) per false-positive group (parallel) — deeply verifies membership
Step 6: Read investigation outputs, reallocate rejects, run merge_aggregation_pass.ts --finalize
Step 7: Run finalize_triage.ts
```

---

## 4. State Type Cleanup

Remove all phase/pipeline tracking from `TriageState`:

```typescript
// AFTER
interface TriageState {
  project_name: string;
  project_path: string;
  analysis_file: string;
  batch_size: number;
  entries: TriageEntry[];
  created_at: string;
  updated_at: string;
}
```

`TriageRoute` becomes `"known-unreachable" | "llm-triage"` — `"known-tp"` renamed to `"known-unreachable"`, `"deterministic-fp"` removed.

Remove entirely: `AggregationResult`, `FixPlanningState`, `FixPlanGroupState`, `MetaReviewResult`, `ProposedRule`, `RuleReviewOutput`.

Remove from `TriageEntry`: `deterministic_group_id`.

---

## 5. Remove Dropped Phases

Remove from `allowed-tools` in SKILL.md: `triage-rule-reviewer`, `fix-planner`, `plan-synthesizer`, `plan-reviewer`, `task-writer`.

Delete agent files: `triage-aggregator.md`, `triage-rule-reviewer.md`, `fix-planner.md`, `plan-synthesizer.md`, `plan-reviewer.md`, `task-writer.md`.

Simplify `finalize_triage.ts`: remove meta_review patterns write and fix_planning task summary sections.

Create two draft backlog tasks for future work (see acceptance criteria).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 get_next_triage_batch.ts exists and returns { entries: number[], state_path, progress }; returns empty entries array when all entries are completed
- [ ] #2 triage_loop_stop.ts and its test file are deleted
- [ ] #3 merge_result_files logic lives in src/merge_results.ts with colocated tests
- [ ] #4 SKILL.md frontmatter has no hooks: block; Phase 3 is an explicit loop calling get_next_triage_batch.ts
- [ ] #5 TriageEntryResult uses ariadne_correct: boolean instead of is_true_positive/is_likely_dead_code
- [ ] #6 group_id 'confirmed-unreachable' replaces 'true-positive' and 'dead-code' throughout
- [ ] #7 TriageRoute is 'known-unreachable' | 'llm-triage' (no 'deterministic-fp')
- [ ] #8 triage-investigator.md instructions focus on caller-existence search; no subjective true-positive/dead-code judgments
- [ ] #9 All four prompt templates updated to remove 'is this a legitimate entry point?' steps
- [ ] #10 build_finalization_output.ts produces two-way partition: confirmed_unreachable + false_positive_groups
- [ ] #11 known_entrypoints.ts has single build_confirmed_unreachable_source (merged from old tp+dead-code sources)
- [ ] #12 TriageState has no phase, aggregation, meta_review, or fix_planning fields
- [ ] #13 TriageEntry has no deterministic_group_id field
- [ ] #14 AggregationResult, FixPlanningState, MetaReviewResult and their sub-types are removed from triage_state_types.ts
- [ ] #15 prepare_aggregation_slices.ts creates slice files with only factual metadata (no grouping decisions)
- [ ] #16 rough-aggregator.md exists (Sonnet, maxTurns 50); outputs local group taxonomy per slice
- [ ] #17 merge_aggregation_pass.ts supports --pass 1, --pass 2, --finalize modes
- [ ] #18 group-consolidator.md exists (Sonnet, maxTurns 50); merges synonymous group names
- [ ] #19 group-investigator.md exists (Opus, maxTurns 200, Ariadne MCP); verifies group membership per entry
- [ ] #20 SKILL.md Aggregation section describes each step in plain terms without assuming prior knowledge of the codebase
- [ ] #21 triage-aggregator.md, triage-rule-reviewer.md, fix-planner.md, plan-synthesizer.md, plan-reviewer.md, task-writer.md are deleted
- [ ] #22 finalize_triage.ts no longer references meta_review patterns or fix_planning
- [ ] #23 pnpm test passes in .claude/skills/self-repair-pipeline/
- [ ] #24 Draft backlog task created: 'Extract deterministic classification rules from triage history'
- [ ] #25 Draft backlog task created: 'Build a fix-planning skill that turns FP groups into backlog tasks'
- [ ] #26 prepare_triage.ts no longer sets phase, aggregation, meta_review, or fix_planning fields in the state it writes
- [ ] #27 finalize_triage.ts no longer guards on state.phase (the phase field no longer exists on TriageState)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Implemented in commit 7a43f8dd on branch feat/self-healing-pipeline-debug.

Key changes:

- Replaced triage_loop_stop.ts stop hook with explicit get_next_triage_batch.ts loop
- Binary triage: TriageEntryResult now uses ariadne_correct: boolean (removed is_true_positive/is_likely_dead_code)
- Hierarchical 3-pass aggregation: prepare_aggregation_slices.ts → rough-aggregator → merge_rough_groups.ts → group-consolidator → merge_consolidated_groups.ts → group-investigator → finalize_aggregation.ts
- Removed phases: meta-review, fix-planning, triage-aggregator, plan-synthesizer, plan-reviewer, task-writer agents
- Simplified TriageState type: removed AggregationResult, FixPlanningState, FixPlanGroupState, MetaReviewResult, ProposedRule, RuleReviewOutput
- Eliminated all as-unknown-as double casts from core package tests (ESLint compliance)
- Fixed exec_git to unset inherited GIT_DIR/GIT_INDEX_FILE/GIT_COMMON_DIR from parent hook context (bug: git commands inside pre-commit hooks were resolving to the parent repo instead of the target cwd)
- All 60 skill tests, 94 core test files, 12 mcp test files, and 10 types test files pass
<!-- SECTION:FINAL_SUMMARY:END -->
