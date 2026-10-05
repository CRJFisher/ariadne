---
id: TASK-190.19.2
title: Add `triage-coordinator` sub-agent and dispatcher absorb path
status: In Progress
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - triage-entrypoints
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

## Architecture

The absorb path lives in a new module `.claude/skills/triage-entrypoints/src/absorb_verdict.ts` — the successor to `merge_results.ts` for the verdict-shaped result file world. The legacy `merge_results.ts` is unchanged for now; 190.19.3 wires investigators to emit `TriageVerdict` and 190.19.5 collapses Phase 4, at which point `absorb_verdict` becomes the sole absorb surface.

Module decomposition under `src/coordinator/`:

- `coordinator/decision.ts` — `CoordinatorDecision` discriminated union (`kind: "merge_into" | "register_new" | "flag"`) + strict runtime parser. `kind` matches `TriageVerdict.kind`'s naming so cross-union code reads uniformly.
- `coordinator/prompt.ts` — renders the coordinator's input as a single pretty-printed JSON object (`{ entry_index, verdict, current }`). JSON envelope rather than positional labeled blocks to remove the order-sensitive parsing contract.
- `coordinator/apply_decision.ts` — pure application of a decision to a `NovelIssuesFile`. Includes the dispatcher's defensive downgrade: a `merge_into` with an unknown `novel_issue_id` is rewritten to a `flag` so the coordinator's hallucinated id cannot crash the absorb.
- `coordinator/log.ts` — append-only `coordinator_log.jsonl` writer + reader. Lines validated through the strict verdict + decision parsers on read (no `as` casts).

`NovelVerdict` (the subset of `TriageVerdict` that routes through the coordinator) lives in `triage_verdict.ts` alongside the parent union, not in the log module.

## Scope

### Sub-agent definition

New file `.claude/agents/triage-coordinator.md`:

- Model: sonnet.
- maxTurns: 30 (small context, single decision).
- Tools: Read only. (Enforced by an executable check in `write_boundary.test.ts`.)
- Input prompt: a single JSON object with fields `entry_index`, `verdict` (the just-absorbed `TriageVerdict`), and `current` (the run's `novel_issues.json` snapshot, including `flagged`).
- Output schema (`kind` discriminator, mirroring `TriageVerdict`):
  - `{ kind: "merge_into", novel_issue_id: string, reason: string }`
  - `{ kind: "register_new", canonical_name: string, root_cause: string, reason: string }`
  - `{ kind: "flag", reason: string }`
- `reason` is always populated (used for the decision log).
- `canonical_name` is bounded to ≤ 60 chars in the prompt body.

### Dispatcher absorb path

`absorb_verdict.ts` exports an async `absorb_verdict(entry_index, verdict, opts)`:

- Re-parses the incoming verdict through `parse_triage_verdict` at the boundary — TypeScript types are erased and a malformed value would otherwise corrupt the registry on the next read.
- Branches on `kind`:
  - `fp-novel-new` | `fp-novel-cited` → invoke `triage-coordinator` synchronously; apply the decision via `apply_coordinator_decision`; persist atomically; append to `coordinator_log.jsonl`.
  - `tp` | `fp-classifier-regression` | `uncertain` → absorb directly; no coordinator call, no I/O on the novel-issues surface.
- **Single-writer mutex.** A process-local per-path Promise chain serializes overlapping absorbs against the same `novel_issues_path`, eliminating the read-modify-write race that `atomic_write_file` alone does not protect against.
- **Replay guard.** If `entry_index` already appears in any issue's citations or in `flagged`, the absorb short-circuits as a no-op without invoking the coordinator. Replays after partial failures are safe even though `register_new` is not naturally idempotent.
- **Coordinator failures degrade to flag.** Any throw from the coordinator callback is caught and synthesized as a `flag` decision with the error message in `reason`. Every novel verdict therefore produces exactly one log entry, regardless of whether the agent succeeded.
- **Log before file write.** The decision is appended to the JSONL log before `novel_issues.json` is rewritten. A crash between the two leaves the audit trail intact; the replay guard catches the case where the registry write completed in a prior pass.
- Coordinator decisions are recorded in `coordinator_log.jsonl` (append-only) with: timestamp, entry_index, full verdict payload, and the *applied* decision (which may differ from the agent's raw decision when the dispatcher downgraded).
- `novel_issues.json` is persisted via `write_novel_issues` (atomic temp+rename).

### Novel-issues storage extension

`NovelIssuesFile` (defined in 190.19.1) gains a `flagged: FlaggedVerdict[]` field. Flag decisions become first-class storage rather than log-mining, so the curator's human-review surface and finalization tooling can read them directly. Pure mutator `flag_verdict` and lookup helpers `find_issue_citing`, `find_flagged` are added in the same module.

### Tests

Colocated `.test.ts` files for every new module:

- `absorb_verdict.test.ts` — all three coordinator decision kinds with `toEqual` against typed literal `NovelIssuesFile` snapshots; direct-absorb kinds never call the coordinator; replay-guard idempotency for both `merge_into` and `register_new`; coordinator-throw → synthetic flag; unknown `merge_into` id → downgraded flag; verdict-shape rejection at the boundary; per-path mutex under concurrent absorbs.
- `coordinator/prompt.test.ts` — JSON envelope round-trips; size bound (< 40K chars) holds when `current` grows large AND when the verdict's strings are large (both axes covered).
- `coordinator/decision.test.ts` — strict parser round-trips every kind and rejects every malformed shape branch.
- `coordinator/log.test.ts` — append/read round-trips; parser validation on read (non-novel verdict kinds, negative entry_index, empty timestamp, extra fields).
- `coordinator/apply_decision.test.ts` — covers each `kind`, the slug-collision `-2` suffix path, and the unknown-id downgrade-to-flag path.
- `novel_issues.test.ts` extended to cover `flag_verdict`, `find_issue_citing`, `find_flagged`, and the new `flagged` parser branches.
- `write_boundary.test.ts` extended to assert `triage-coordinator.md` declares `tools: Read` (and nothing else) — the read-only invariant is executable, not just documentary.

## Out of scope

- No investigator prompt changes (190.19.3).
- No removal of the existing aggregation files (190.19.5).
- No wire-up of `absorb_verdict` into the live worker pool — that happens when `merge_results.ts` is replaced in 190.19.3 / 190.19.5. The absorb function is a library surface at this point; 190.19.5's task should thread `opts.coordinator` (and `opts.now`) from the dispatcher script down through the result-file scan.
- The coordinator does not write the global `registry.json` — only the per-run `novel_issues.json`.

## Plan evolution after multi-agent review

The initial implementation matched the spec literally — a single `absorb_verdict.ts` colocated with `merge_results.ts`, three sibling `coordinator_*.ts` files, `decision`/`coordinated` boolean discriminators, prompt rendered as labeled positional blocks. Five Opus reviewers (architecture, test-coverage, API/DDD, AC compliance, adversarial failure-mode) surfaced three critical, five high, and a cluster of medium correctness/design findings. The user opted for the full restructure; the changes above absorb that feedback:

- **C1 (coordinator hallucinated ids → mid-flight throw, no audit trail).** Added the unknown-`novel_issue_id` downgrade-to-flag path in `apply_coordinator_decision`.
- **C2 (log write after registry write → silent state/audit drift).** Reversed the order — log first, file second — and documented the crash window in the module header.
- **C3 ("single-writer" was a comment).** Added a process-local per-path Promise-chain mutex (`with_path_lock` in `absorb_verdict.ts`).
- **H1 (`parse_triage_verdict` never called in the absorb path).** Verdict re-parsed at the boundary so a malformed value cannot reach the file write.
- **H4 (coordinator throw → no log entry).** Wrapped the coordinator call in try/catch → synthetic flag with the error in `reason`.
- **H5 (`register_new` not idempotent under replay).** Replay guard scans existing citations + `flagged` and short-circuits before the coordinator is invoked.
- **API / DDD findings.** Discriminator renamed `decision` → `kind` for cross-union consistency; redundant `coordinated: boolean` dropped (`kind`/`outcome` carry the same information without the consistency hazard); `registered_issue: NovelIssue | null` eliminated by decision-discriminating the result type; `NovelVerdict` moved from `coordinator_log.ts` to `triage_verdict.ts` (it is a verdict-domain concept); coordinator prompt switched from positional labeled blocks to a single JSON envelope; `apply_decision` lifted out of `absorb_verdict.ts` to colocate with `CoordinatorDecision`; coordinator modules moved under `src/coordinator/` to mirror the existing `src/aggregation/` pattern.
- **Storage findings.** `flag` decisions promoted to first-class storage via `NovelIssuesFile.flagged: FlaggedVerdict[]` with the `flag_verdict` pure mutator and lookup helpers.
- **Hygiene.** `coordinator/log.ts` no longer uses `JSON.parse as CoordinatorLogEntry` — every log line round-trips through a strict parser; agent doc drops the unenforceable "be deterministic" claim and gains an empty-snapshot guidance section.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 `.claude/agents/triage-coordinator.md` exists; declares sonnet, Read-only tools, strict output schema with `kind` discriminator
- [x] #2 Dispatcher absorb path invokes the coordinator only on `fp-novel-new` / `fp-novel-cited`; never on `tp` / `fp-classifier-regression` / `uncertain`
- [x] #3 Each coordinator decision is logged to `coordinator_log.jsonl` with timestamp + entry_index + verdict payload + decision (the *applied* decision after any dispatcher downgrade)
- [x] #4 `novel_issues.json` writes are atomic (temp+rename) and idempotent under repeated identical absorptions for all three decision kinds (replay guard via citation/flagged scan)
- [x] #5 Tests cover all three decision kinds with `toEqual` against typed literal `NovelIssuesFile` snapshots
- [x] #6 Coordinator's tool allowlist permits Read only — enforced by an executable check in `write_boundary.test.ts`
- [x] #7 Single-writer invariant enforced by per-path mutex in `absorb_verdict.ts` (not just a comment)
- [x] #8 Verdict shape re-validated at the absorb boundary via `parse_triage_verdict` — malformed input cannot reach the file write
- [x] #9 Coordinator throw, unknown `merge_into` id, and `flag` decisions all produce exactly one log entry — every novel verdict has an audit trail
- [x] #10 `NovelIssuesFile` extended with `flagged: FlaggedVerdict[]` first-class storage; `flag_verdict` pure mutator added
<!-- AC:END -->
