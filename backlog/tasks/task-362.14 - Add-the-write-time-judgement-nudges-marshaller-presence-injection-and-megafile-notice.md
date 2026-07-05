---
id: TASK-362.14
title: >-
  Add the write-time judgement nudges: marshaller-presence injection and
  megafile notice
status: To Do
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

- [ ] #1 writing a new {feature}.{lang}.ts leaf under packages/core/src with no sibling {feature}.ts marshaller injects the marshaller-placement reminder as additionalContext (never blocks)
- [ ] #2 megafile_notice.ts injects a name-accuracy notice via PostToolUse when a packages/\*/src .ts file exceeds ~500 non-blank lines (never blocks; exempts tests and builtins/)
- [ ] #3 both triggers have test coverage; neither path can emit decision:block
<!-- AC:END -->
