---
id: TASK-190.19.2
title: Add `triage-coordinator` sub-agent and dispatcher absorb path
status: To Do
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - self-repair-pipeline
  - srp-redesign
dependencies:
  - TASK-190.19.1
parent_task_id: TASK-190.19
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Once novel verdicts can be emitted, something has to decide whether each one is genuinely new or a duplicate of an issue another agent registered moments earlier. The coordinator sub-agent is the single consistency point: it sees the current `novel_issues.json` snapshot plus the just-absorbed proposal and emits a merge / register / flag decision.

## Scope

### Sub-agent definition

New file `.claude/agents/triage-coordinator.md`:

- Model: sonnet.
- maxTurns: 30 (small context, single decision).
- Tools: Read only.
- Input prompt template includes: the current `novel_issues.json` content + the just-absorbed verdict's full payload.
- Output schema:
  - `{ decision: "merge_into", novel_issue_id: string, reason: string }`
  - `{ decision: "register_new", canonical_name: string, root_cause: string, reason: string }`
  - `{ decision: "flag", reason: string }`
- `reason` is always populated (used for the decision log).

### Dispatcher absorb path

Extend `.claude/skills/self-repair-pipeline/src/merge_results.ts` (or its successor):

- After parsing the per-entry verdict, branch on `kind`:
  - `fp-novel-new` | `fp-novel-cited` → invoke `triage-coordinator` synchronously; apply the decision to `novel_issues.json` via the pure-function mutators from 190.19.1.
  - `tp` | `fp-classifier-regression` | `uncertain` → absorb directly; no coordinator call.
- Coordinator decisions are appended to `coordinator_log.jsonl` (per-run, append-only) with: timestamp, entry_index, agent verdict payload, coordinator decision.
- Persist `novel_issues.json` via `write_novel_issues` (atomic temp+rename).

### Tests

- `merge_results.test.ts` — given a mock coordinator response, assert the resulting `novel_issues.json` content after each decision kind.
- `triage_coordinator_prompt.test.ts` — render the coordinator's input prompt against a fixture; assert key fields are present and bounded in size (warn at ~10K tokens worth of input).

## Out of scope

- No investigator prompt changes (190.19.3).
- No removal of the existing aggregation files (190.19.5).
- The coordinator does not write the global `registry.json` — only the per-run `novel_issues.json`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `.claude/agents/triage-coordinator.md` exists; declares sonnet, Read-only tools, strict output schema
- [ ] #2 Dispatcher absorb path invokes the coordinator only on `fp-novel-new` / `fp-novel-cited`; never on `tp` / `fp-classifier-regression` / `uncertain`
- [ ] #3 Each coordinator decision is logged to `coordinator_log.jsonl` with timestamp + entry_index + verdict payload + decision
- [ ] #4 `novel_issues.json` writes are atomic (temp+rename) and idempotent under repeated identical absorptions
- [ ] #5 Tests cover all three decision kinds with `toEqual` against typed literal `NovelIssuesFile` snapshots
- [ ] #6 Coordinator's tool allowlist permits Read only — it cannot mutate any file directly
<!-- AC:END -->
