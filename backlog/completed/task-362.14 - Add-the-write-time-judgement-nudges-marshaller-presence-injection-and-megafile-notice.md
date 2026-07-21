---
id: TASK-362.14
title: >-
  Add the write-time judgement nudges: marshaller-presence injection and
  megafile notice
status: Done
assignee: []
created_date: "2026-07-05 11:40"
labels:
  - information-architecture
  - claude-customisation
  - encourage
dependencies:
  - TASK-362.10
parent_task_id: TASK-362
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Source: the IA-enforcement strategy (2026-07-05 workflow over the `ia-review` drafts and task 362). Deliver the two judgement-heavy signals that static rules cannot time correctly, as `additionalContext`-only micro-injections at the exact write event — **never a deny/block**, per the enforce-vs-encourage split (a false-positive block on a judgement call is worse than a miss). Context cost: zero always-on; 1–4 injected lines only on the matching rare events.

### 1. Marshaller-presence injection

On the ALLOW path of `.claude/hooks/file_naming_validator.ts` (which already spawns on the `Write|Edit` PreToolUse matcher and parses `tool_input.file_path`): when the write creates a NEW `{feature}.{language}.ts` leaf under `packages/core/src/**` and `fs.existsSync` finds no sibling `{feature}.ts` in the same folder, emit `hookSpecificOutput.additionalContext` (1–2 sentences): _a folder with language variants needs an in-folder `{feature}.ts` marshaller owning the dispatch switch — do not displace dispatch into a stage orchestrator; gold standard `import_resolution/import_resolution.ts`._ Keep the injection code isolated from the existing block logic; de-dupe per session if practical to avoid payload accumulation.

(The deduplicated design drops the broader injection table: stage-direction injection is redundant with the `stage_boundary_stop` enforcement + `stage-boundaries.md`, and `@language` injection is redundant with the path-scoped types rule that loads on the same edit.)

### 2. Megafile notice

New `.claude/hooks/megafile_notice.ts` wired as a PostToolUse handler on `Write|Edit` with an if-gate for `packages/*/src/**/*.ts` (exempt `*.test.ts` and `classify_entry_points/builtins/`): after the write, count non-blank/non-comment lines; above ~500, emit ~4 lines of `additionalContext` reframing size as name-accuracy — _`<file>` is now `<N>` lines; a name must be fully true: check `<basename>` still describes everything here; if it hosts multiple concerns, split into precisely-named leaves — guidance, not a block._ Silent below threshold; never `decision:block` (the catalog marks LOC a warning signal, and a Stop-level block would punish work-in-progress).

Add test coverage for both triggers in the hooks' co-located tests.

**Sequencing:** land after the file-naming hook hardening task (same files; avoids merge churn in `file_naming_validator.ts`). The 500-line threshold intentionally still fires on `extract_entry_point_diagnostics.ts` (867) and `definitions.ts` (1069) until 362.4 splits them — that is signal, not noise.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 writing a new {feature}.{lang}.ts leaf under packages/core/src with no sibling {feature}.ts marshaller injects the marshaller-placement reminder as additionalContext (never blocks)
- [x] #2 megafile_notice.ts injects a name-accuracy notice via PostToolUse when a packages/\*/src .ts file exceeds ~500 non-blank/non-comment lines (never blocks; exempts tests and builtins/)
- [x] #3 both triggers have test coverage; neither path can emit decision:block
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

Two write-time judgement nudges land as `additionalContext`-only micro-injections at the write event — never a block, honouring the enforce-vs-encourage split where a false-positive block on a judgement call is worse than a miss. Both cost zero context when idle and inject a few lines only on their rare matching events.

**Marshaller-presence nudge** (`.claude/hooks/marshaller_nudge.ts`, wired into the allow path of `file_naming_validator.ts`): when a Write creates a new `{feature}.{language}.ts` leaf under `packages/core/src/**` and no sibling `{feature}.ts` marshaller exists yet, the hook injects a PreToolUse reminder that a folder with language variants needs an in-folder marshaller owning the dispatch switch, pointing at the gold standard `resolve_references/import_resolution/import_resolution.ts`. The nudge is deduped per `(session, folder, feature)` so a burst of one feature's language variants injects once while a different feature's missing marshaller in the same folder still earns its own nudge. `index` barrels are excluded, mirroring `file_naming.ts`. The nudge code lives in its own module, isolated from the validator's block logic; a block and a nudge can never both emit.

**Megafile notice** (`.claude/hooks/megafile_notice.ts`, wired as a PostToolUse `Write|Edit` handler in `.claude/settings.json`): after a write to a `packages/*/src/**/*.ts` file (tests and `classify_entry_points/builtins/` exempt), the hook counts non-blank/non-comment ("significant") lines and, above 500, injects a PostToolUse notice reframing size as name-accuracy — the file name must stay fully true, and a file hosting multiple concerns should split into precisely-named leaves. The line counter is a char-level scanner that tracks block comments and string/template literals so comment markers inside string literals are not mistaken for comments; regex-literal delimiters are deliberately not tokenized (a documented under-count, the safe direction for a non-gating warning). There is no per-session dedup: size changes on every edit, so re-emitting is a fresh signal.

Neither hook can emit `decision:block` — each only ever prints a `hookSpecificOutput.additionalContext` payload, verified both by the `*_context_output` tests (asserting no `decision` key) and by driving both hooks end-to-end over real stdin.

### Acceptance criteria → tests

- **AC#1** — `marshaller_nudge.test.ts`: `compute_marshaller_nudge` nudges a new variant per language (`it.each` over typescript/javascript/python/rust) and stays silent when a sibling exists, when the leaf already exists (an edit), for test files, non-language dotted names, `index` barrels, plain leaves, and paths outside `packages/core`; `marshaller_context_output` asserts the no-block shape.
- **AC#2** — `megafile_notice.test.ts`: `compute_megafile_notice` emits above the threshold and is silent at/below it, exempts test files and builtins, and returns null for an absent file; `count_significant_lines` pins exact counts across blank/line-comment/block-comment/mixed cases plus string-embedded markers, `//`-before-`/*` precedence, unterminated blocks to EOF, backtick strings, and CRLF; `is_megafile_candidate` covers the positive case and both exemptions; `megafile_context_output` asserts the no-block shape.
- **AC#3** — the two `*_context_output` tests plus the end-to-end stdin drive prove neither path emits `decision:block`.

### Note for the human

The acceptance-criterion text for AC#2 originally read "~500 non-blank lines" while the Description specified "non-blank/non-comment lines". The implementation follows the Description (the more specific requirement), and the AC text above is reconciled to match. The Description's sequencing note cites `extract_entry_point_diagnostics.ts` (867) and `definitions.ts` (1069) as files the threshold should still fire on; those figures are stale (the files have since shrunk or moved), so that expectation is not a current test target.

<!-- SECTION:NOTES:END -->
