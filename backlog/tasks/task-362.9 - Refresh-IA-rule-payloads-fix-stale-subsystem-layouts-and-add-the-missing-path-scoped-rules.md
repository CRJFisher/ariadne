---
id: TASK-362.9
title: >-
  Refresh IA rule payloads: fix stale subsystem layouts and add the missing
  path-scoped rules
status: To Do
assignee: []
created_date: "2026-07-05 11:38"
labels:
  - information-architecture
  - claude-customisation
  - encourage
dependencies: []
parent_task_id: TASK-362
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Source: the IA-enforcement strategy (2026-07-05 workflow over the `ia-review` drafts and task 362). This is an **encourage-layer** task — path-scoped rule payloads that load just-in-time. Its teeth live in the hooks it cites; it carries zero always-on context.

The just-in-time rule delivery is correctly path-scoped (rules auto-load via `paths:` frontmatter when a matching file is touched) but several payloads are wrong or missing. Fix accuracy and close the coverage gaps.

### Fix stale layouts (verify every cited path with `ls` against the live tree first; canonical present tense, no "previously/folded" framing)

1. `.claude/rules/trace-call-graph.md` — remove the `filter_entry_points.ts` / `filter_entry_points.python.ts` rows (neither file exists; deleted); document the real behavior, which lives in `classify_entry_points/` (e.g. runner/framework suppression).
2. `.claude/rules/resolve-references.md` — drop the phantom `registries/index.ts`; add the real leaves that exist today.
3. `.claude/rules/project-orchestration.md` — add `load_project.ts` and `file_loading.ts`; compress each Module Layout to one line per file.

### Add the missing path-scoped rules (terse; each names the enforcing hook that backs it)

4. Extend the EXISTING `.claude/rules/language-patterns.md` (already `paths: packages/core/src/**`) with a ~8-line **"Dispatch lives in an in-folder marshaller"** section: a folder owning `{feature}.{language}.ts` leaves MUST have a sibling `{feature}.ts` marshaller owning the language switch; never displace dispatch into a stage orchestrator; gold standard `import_resolution/import_resolution.ts`.
5. NEW `.claude/rules/classify-entry-points.md` (`paths: packages/core/src/classify_entry_points/**`) — the one subsystem with no rule: stage face is `enrich_call_graph.ts` and `classify_entry_points.ts` is the auto-classify sub-step (folder-ts is not the orchestrator here); `builtins/check_<group_id>.ts` filename must equal the registry `group_id` exactly (the bijection drives `reconcile_registry` row↔file mapping; the file-naming hook rejects otherwise); import `detect_language` from `packages/core/src/detect_language.ts`, never raw `.endsWith(".py")`; a new classifier = one `check_` file + one `BUILTIN_CHECKS` barrel entry; cross-reference `classifier-lifecycle.md`.
6. NEW `.claude/rules/types-language-annotations.md` (`paths: packages/types/src/**/*.ts`, ~7 lines) — the types package expresses the language axis as embedded annotated unions: every union member/field applying to a subset of the four languages carries a JSDoc `@language` tag (e.g. `type_cast`=typescript, `dunder_protocol`=python, `path_prefix`=rust); an unannotated language-specific member makes the add-a-language audit un-enumerable.
7. NEW `.claude/rules/surplus-code.md` (`paths: packages/**/*.ts`, ~8 lines) — every exported symbol needs at least one non-test consumer outside its own file, else delete it; a barrel re-exports only its own folder's surface; a barrel with zero exports or importers is deleted; the `detect_dead_code` Stop hook blocks unreachable exports — do not silence a genuinely-dead symbol via `known_entrypoints`.
8. NEW `.claude/rules/fault-area-map.md` (`paths: packages/core/src/**/*.ts` + `packages/types/src/ariadne_fault_area.ts`, ~5 lines) — when moving/splitting a file whose path is an `ARIADNE_FAULT_AREA_FOLDER` value, re-point the value to the surviving owner in the same change; the compiler catches a missing key and the `doc_path_truth` hook catches a deleted path, but only a human can judge wrong-owner-after-split.

Keep every addition terse. These are encourage-layer texts whose teeth live in the hooks they cite.

**Sequencing:** fixes reflect the CURRENT tree, so they can start now, but this task must land BEFORE or WITH the `doc_path_truth` hook (TASK for doc-truth), which would otherwise block on the known-stale `trace-call-graph.md` paths. Re-verify layouts after the 362.2–362.4 splits land. Overlaps 362.8's doc-truth scope — coordinate to avoid double-editing.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 trace-call-graph.md, resolve-references.md, project-orchestration.md cite only paths that exist in the live tree (verified by ls)
- [ ] #2 language-patterns.md carries the in-folder-marshaller section; new path-scoped rules exist for classify_entry_points, packages/types @language annotations, surplus-code, and the fault-area map
- [ ] #3 every new/edited rule names the enforcing hook that backs it and carries paths: frontmatter (zero always-on context)
<!-- AC:END -->
