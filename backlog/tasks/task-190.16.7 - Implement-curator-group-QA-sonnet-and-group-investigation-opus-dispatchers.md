---
id: TASK-190.16.7
title: Implement curator group QA (sonnet) and group investigation (opus) dispatchers
status: Done
assignee: []
created_date: "2026-04-17 14:39"
completed_date: "2026-04-22"
labels:
  - triage-curator
  - skill
  - agent
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - .claude/skills/triage-curator/
  - .claude/skills/self-repair-pipeline/known_issues/registry.json
parent_task_id: TASK-190.16
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase F4.

Implement the two LLM-powered halves of the curator. Both are invoked per group within `curate_run.ts`.

**Part (a) — Auto-classified group QA (sonnet, lightweight).**
File: `src/group_qa.ts` + `templates/prompt_group_qa.md`.
Single sonnet sub-agent per auto-classified group. Input: `group_id`, registry entry, up to ~15 member entries (file paths + snippets + diagnostics summary) in one prompt. Task: spot obvious outliers — not deep investigation. Output JSON: `{ outliers: Array<{ entry_index, reason }>, confidence_remains_high: boolean, notes }`.
Cost discipline: one prompt, max ~5000 input tokens; agent does NOT read source files unless an outlier hint specifically demands it. Token-intensive deep dives negate the point of deterministic classification. QA outputs feed into drift detection: if a classifier's outlier rate exceeds ~15%, tag registry entry `drift_detected: true`.

**Part (b) — Residual / novel group investigation (opus, deep).**
File: `src/group_investigate.ts` + `templates/prompt_group_investigate.md`.
Opus sub-agent per residual group. Input: `group_id` (possibly `novel:`-prefixed), all member entries with full diagnostics, current classifier inventory (from `known_issues/registry.json`), signal inventory (from `reference/signal_inventory.md`), Ariadne introspection APIs. Task: propose a uniquely-identifying `ClassifierSpec`, linked backlog task, any new signal/API needed, and any code changes. Output JSON: `{ proposed_classifier, backlog_ref, new_signals_needed, code_changes, reasoning }`.

Allowed tools for the opus agent: full Read/Grep/Glob; Edit/Write on `known_issues/registry.json` and `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/*.ts`; MCP `mcp__backlog__task_search`/`task_create`/`task_edit`; MCP `mcp__ariadne__*` for call-graph queries.

Reviewability: opus output is proposals + code diffs; a human approves in a PR. The investigation is autonomous; the application isn't — or if `--dry-run` is passed, nothing is written.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `src/group_qa.ts` and `src/group_investigate.ts` exist with tests — _superseded: replaced by `.claude/agents/triage-curator-{qa,investigator}.md` sub-agents + `scripts/get_{qa,investigate}_context.ts` dispatchers + `src/apply_proposals.ts`_
- [x] #2 `templates/prompt_group_qa.md` and `templates/prompt_group_investigate.md` exist — _superseded: prompts are the body of the sub-agent `.md` files under `.claude/agents/`_
- [x] #3 End-to-end: running `curate_run` on an existing webpack triage run produces sonnet QA output for auto-classified groups (with single-prompt, no file reads) and opus investigation output for ≥1 residual group
- [x] #4 Sonnet QA results populate `outcome.qa_outliers_found` in curator state
- [x] #5 Opus investigation results populate `outcome.classifiers_proposed` and list backlog task proposals in curator state
- [x] #6 Classifier drift tagging works: a synthetic high-outlier-rate result sets `drift_detected: true` on the registry entry
- [x] #7 `--dry-run` prevents all writes to registry, backlog, and code
- [x] #8 Drift-tagging threshold is 15% (outlier rate) as a configurable constant; test asserts tagging fires at 15% and not at 14%
- [x] #9 Opus investigator output JSON matches the specified shape: `{ proposed_classifier, backlog_ref, new_signals_needed, code_changes, reasoning }`; sonnet QA output matches `{ outliers, confidence_remains_high, notes }` — _shape refined: `code_changes` replaced by `classifier_spec: BuiltinClassifierSpec | null` (main agent renders source from the spec in Step 4.5); QA response dropped `confidence_remains_high` (drift is computed from outlier rate, not self-reported confidence)_
- [x] #10 When current signals are insufficient to uniquely identify a group, the opus investigator surfaces this by emitting a non-empty `new_signals_needed` array — tested with a synthetic residual group that requires a new resolver field
- [x] #11 Opus write-scope is restricted to `known_issues/registry.json`, `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/*.ts`, and MCP `backlog__task_*` calls; any write outside this set is rejected by the dispatcher — _tightened: investigator's Write scope is `~/.ariadne/triage-curator/**` only (response + session log); classifier source files and the registry are authored by the main agent from the investigator's structured spec, eliminating the need for filesystem write-scope enforcement on the sub-agent_
<!-- AC:END -->

## Implementation Notes

Shipped in two stages: `f5d0edde` (initial QA + investigator dispatchers, registry apply, drift detection) and `7dd43d65` (spec-driven classifier authoring; investigator emits `BuiltinClassifierSpec` and the main agent renders source in Step 4.5).

### Architecture shift: sub-agents over single-file modules

The task originally scoped `src/group_qa.ts` and `src/group_investigate.ts` as in-process dispatcher modules that would call out to the LLM. The shipped shape inverts this: both phases are **Claude Code sub-agents** (`triage-curator-qa`, `triage-curator-investigator`) with their own frontmatter-scoped tools, and the orchestrator in `scripts/curate_run.ts` dispatches them via the `Task` tool. Benefits:

- Sub-agent boundaries are enforced by the harness (tool allowlist, maxTurns, mcpServers), not by in-process validation code.
- Context hydration lives in `scripts/get_qa_context.ts` and `scripts/get_investigate_context.ts` — small CLI scripts the sub-agents invoke to self-serve their inputs. The orchestrator only passes pointers (`group_id`, `run_path`, `output_path`), never a large payload.
- The sub-agent response is a JSON file the main agent reads, not a return value — aligns with the pipeline's file-only communication convention.

Sub-agent write-scope is `Write(~/.ariadne/triage-curator/**)` only (response JSON + session log). The registry upsert and the classifier `.ts` source file are authored by the main agent in later phases.

### Phased orchestration in `scripts/curate_run.ts`

`curate_run` operates in five phases, each writing intermediate artefacts under `~/.ariadne/triage-curator/<run_id>/`:

1. **plan** — enumerates QA candidates (auto-classified groups) and residual candidates (un-classified groups) from `triage_results.json`; pre-creates output directories.
2. **qa** — main agent spawns `triage-curator-qa` per QA candidate; each writes `qa/<group_id>.json`.
3. **promote** — `src/promote_to_investigate.ts` + `scripts/promote_qa_to_investigate.ts` read the QA outputs and promote groups whose outlier rate exceeds `DRIFT_OUTLIER_RATE_THRESHOLD` (15%) into a second investigator wave under `investigate_promoted/`.
4. **investigate** — main agent spawns `triage-curator-investigator` per residual + promoted candidate; each writes `investigate/<group_id>.json` (or `investigate_promoted/<group_id>.json`) plus a session log.
5. **author** (Step 4.5) — for every investigate response with `classifier_spec !== null`, the main agent invokes `scripts/render_classifier.ts` to generate `check_<group_id>.ts` under `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/`.
6. **finalize** — `src/apply_proposals.ts` validates each authored file, runs an AST syntax check (`ts.transpileModule`), upserts registry entries, tags `drift_detected`, emits backlog-task proposals, and aggregates `CurationOutcome` telemetry.

### Investigator output shape

Final `InvestigateResponse` shape (`src/types.ts:197-208`):

```typescript
{
  group_id: string;
  proposed_classifier: ClassifierSpecProposal | null;  // { kind: "none" | "predicate" | "builtin" }
  backlog_ref: BacklogRefProposal | null;
  new_signals_needed: string[];
  classifier_spec: BuiltinClassifierSpec | null;  // required when kind === "builtin"
  reasoning: string;
}
```

`BuiltinClassifierSpec` is a closed, structured record of `SignalCheck` ops + combinator + positive/negative example indexes. The main agent's renderer (`src/render_classifier.ts`) is a pure function — `render_classifier(spec) === render_classifier(spec)` byte-identical — so the invariant is that the authored `.ts` file is a pure function of its spec. Hand-edits to generated classifier files will be clobbered; authors edit the spec (or flip `status: "permanent"`) instead.

The `code_changes[]` escape hatch from the original task spec was dropped entirely. Removing it eliminated the path-allowlisting validator, the canonicalisation logic, and the risk of malformed TypeScript being written directly by an opus sub-agent.

### Drift detection

`DRIFT_OUTLIER_RATE_THRESHOLD = 0.15` is exported from `src/detect_drift.ts`. `detect_drift(qa_response, group_size)` returns `true` when `outliers.length / group_size >= 0.15`. Tests cover: fires at exactly 15% (3/20), does not fire at 14% (7/50), does not fire at 10% (2/20), guards against divide-by-zero for empty groups, returns `false` for zero-outlier responses regardless of group size.

### `--dry-run` and commit control

`ApplyOptions.dry_run` short-circuits every filesystem write in `apply_proposals` — registry file, authored files presence check, backlog task creation. `scripts/curate_run.ts` additionally accepts `--commit-to current|new-branch|none` to gate whether finalize-phase state changes land as a git commit.

### Session logging

`src/session_log.ts` persists a typed `InvestigatorSessionLog` per investigator turn: `status ∈ { success, failure, blocked_missing_signal }`, structured `failure_category` (`group_incoherent | pattern_unclear | classifier_infeasible | registry_conflict | permanent_locked | other`), narrative `reasoning`, and aggregate `actions` telemetry. The finalize phase rolls these up into `CurationOutcome.{success_count, failure_count, blocked_count, failed_groups[]}` so sweep summaries surface both the happy path and why individual groups couldn't be classified.

### Key files

- `.claude/agents/triage-curator-qa.md` — sonnet QA sub-agent (maxTurns: 50)
- `.claude/agents/triage-curator-investigator.md` — opus investigation sub-agent (maxTurns: 200)
- `scripts/curate_run.ts` — phased orchestrator
- `scripts/get_qa_context.ts`, `scripts/get_investigate_context.ts` — sub-agent context hydration
- `scripts/promote_qa_to_investigate.ts` — QA-outlier → investigation promotion
- `scripts/render_classifier.ts` — `BuiltinClassifierSpec → .ts` renderer CLI
- `src/apply_proposals.ts` — finalize-phase registry upsert + AST validation + drift tagging
- `src/render_classifier.ts` (+ `.test.ts`, 26 tests) — pure renderer; one test case per `SignalCheck.op`, combinator fold, example bounds, syntactic validity under `ts.transpileModule`
- `src/session_log.ts` (+ `.test.ts`, 21 tests) — typed session logs with status/failure-category discriminants
- `src/promote_to_investigate.ts` (+ `.test.ts`, 11 tests) — QA → investigate promotion logic
- `src/detect_drift.ts` (+ `.test.ts`, 7 tests) — 15% threshold constant + pure predicate
