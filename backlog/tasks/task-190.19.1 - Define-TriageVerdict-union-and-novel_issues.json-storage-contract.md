---
id: TASK-190.19.1
title: Define `TriageVerdict` union and `novel_issues.json` storage contract
status: To Do
assignee: []
created_date: "2026-05-20 10:00"
labels:
  - self-repair
  - self-repair-pipeline
  - srp-redesign
dependencies: []
parent_task_id: TASK-190.19
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

Foundation pass: define the types and I/O contract that every later sub-task depends on. No behavior changes — only the type surface, file helpers, and tests.

## Scope

### Verdict schema

New file `.claude/skills/self-repair-pipeline/src/triage_verdict.ts`:

- Discriminated union `TriageVerdict` with `kind: "tp" | "fp-novel-new" | "fp-novel-cited" | "fp-classifier-regression" | "uncertain"`.
- Each kind carries its required payload (no `?:` everywhere):
  - `tp`: `{ kind, member_evidence }`
  - `fp-novel-new`: `{ kind, proposed_root_cause, evidence_excerpt, member_evidence }`
  - `fp-novel-cited`: `{ kind, novel_issue_id, evidence_excerpt }`
  - `fp-classifier-regression`: `{ kind, should_have_matched_rule_id, evidence_excerpt, member_evidence }`
  - `uncertain`: `{ kind, reason, member_evidence }`
- `MemberEvidence = { file: string, line: number, why: string }`.
- Runtime parser `parse_triage_verdict(raw: unknown): TriageVerdict` that throws on invalid shape (no silent coercion).

### Novel issues storage

New file `.claude/skills/self-repair-pipeline/src/novel_issues.ts`:

- `NovelIssue = { id: string, canonical_name: string, root_cause: string, citations: NovelIssueCitation[] }`
- `NovelIssueCitation = { entry_index: number, evidence_excerpt: string }`
- `NovelIssuesFile = { issues: NovelIssue[] }`
- `read_novel_issues(path: string): NovelIssuesFile` — returns `{ issues: [] }` if file does not exist.
- `write_novel_issues(path: string, data: NovelIssuesFile): void` — temp+rename atomic write via the shared `atomic_write_file` helper.
- Pure-function mutators (no I/O): `add_citation`, `register_issue`. These return new `NovelIssuesFile` values for the dispatcher to persist.

### Tests

Colocated `.test.ts` files:

- `triage_verdict.test.ts` — round-trip each verdict kind through `parse_triage_verdict`; reject malformed inputs (missing required fields, wrong `kind`, etc.) with exact `toEqual` matches.
- `novel_issues.test.ts` — write then read, append citations idempotently, register new issues with unique IDs.

## Out of scope

- No coordinator behavior, no dispatcher changes, no investigator prompt changes.
- No removal of existing aggregation files (190.19.5).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `triage_verdict.ts` exports the discriminated union, member-evidence type, and a strict parser; no `as any`/`as unknown`/`as never` assertions
- [ ] #2 `novel_issues.ts` exports the file shape, reader, atomic writer, and pure-function mutators; no in-place mutation
- [ ] #3 `read_novel_issues` returns `{ issues: [] }` for a missing file (no thrown error)
- [ ] #4 Colocated `.test.ts` files cover every verdict kind round-trip and every mutator code path with `toEqual` against typed literal objects
- [ ] #5 `write_novel_issues` uses the shared `atomic_write_file` helper (temp+rename)
<!-- AC:END -->
