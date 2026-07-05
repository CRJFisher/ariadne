---
id: TASK-362.11
title: Add the detect_language singleton Stop guard (warn-only until 362.1 lands)
status: To Do
assignee: []
created_date: "2026-07-05 11:39"
labels:
  - information-architecture
  - claude-customisation
  - enforce
dependencies:
  - TASK-362.1
parent_task_id: TASK-362
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Source: the IA-enforcement strategy (2026-07-05 workflow over the `ia-review` drafts and task 362). This is an **enforce-layer** task — a new Stop hook. Zero always-on context; one cheap grep-scale scan only on turns that changed package `.ts` source.

Create `.claude/hooks/detect_language_singleton_stop.ts` and wire it into the existing Stop array in `.claude/settings.json`, guarding the single-`detect_language` invariant after 362.1 consolidates today's three forks (`extract_entry_point_diagnostics.ts` ~L718 returns `Language|null`; `trace_call_graph.ts` ~L22 defaults unknown to `typescript` — the latent mislabel bug; `project.ts` ~L60 throws).

### Behavior

- Early-exit 0 unless `utils.get_changed_files` contains a `packages/**/*.ts` path.
- Scan `packages/**/*.ts` (excluding `*.test.ts`) for DEFINITION sites only — anchor the regex on `function detect_language(` and `const detect_language =`, never import lines or call sites.
- If more than one definition exists, or any definition is not at `packages/core/src/detect_language.ts`, emit a violation listing each offending `file:line` with the instruction: _exactly one `detect_language(path): Language|null` lives at `packages/core/src/detect_language.ts`; import it, never re-define; unknown extensions return `null`, never default to a language._

### Sequencing

Land in **warn-only** mode (`hookSpecificOutput.additionalContext`) immediately, so agents touching the forks get the consolidation instruction; flip to `decision:block` in the same commit that closes 362.1, so a blocking hook never wedges turns against pre-existing violations.

### Tests

Co-locate a test with fixture strings for the canonical definition (passes), a second definition (blocks), and an import line (ignored).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 detect_language_singleton_stop.ts is wired into the settings.json Stop array and early-exits unless a packages/\*_/_.ts file changed
- [ ] #2 more than one detect_language definition, or any definition outside packages/core/src/detect_language.ts, is flagged with file:line
- [ ] #3 ships warn-only; flips to decision:block in the same commit that closes 362.1; co-located test covers pass/block/import-ignored
<!-- AC:END -->
