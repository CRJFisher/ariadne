---
id: TASK-362.13
title: Enforce doc-truth and full dead-code coverage at Stop
status: To Do
assignee: []
created_date: "2026-07-05 11:39"
labels:
  - information-architecture
  - claude-customisation
  - enforce
dependencies:
  - TASK-362.9
parent_task_id: TASK-362
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Source: the IA-enforcement strategy (2026-07-05 workflow over the `ia-review` drafts and task 362). Two **enforce-layer** changes to the Stop surface — one new script and one extension, no other new hooks. Net context cost: zero always-on; bounded block messages only on real staleness or dead exports.

### 1. New `doc_path_truth.ts` (wire after `detect_dead_code` in the settings.json Stop array)

Catches exactly the rot class the compiler cannot see (valid `Record` keys with deleted path values; stale module-layout tables in rules).

- Early-exit 0 unless `utils.get_changed_files` shows a change under `.claude/rules/`, `packages/types/src/ariadne_fault_area.ts`, or `packages/*/src/**/*.ts` (a `.ts` move/split is what stales a rule or map).
- (a) For each `.claude/rules/*.md`, extract candidate repo-relative `*.ts` path tokens — ONLY inside backtick spans and fenced tree blocks, only `packages/` or `.claude/` prefixes — and `fs.existsSync` each against the repo root. Support an inline `<!-- doc-path-truth:ignore -->` marker for lines deliberately citing counter-example paths (the IA review itself cites `call_resolution/python/` as a bad example).
  - **Blind spot to close (surfaced by 362.9):** the `## Module Layout` fenced trees in `trace-call-graph.md`, `resolve-references.md`, and `project-orchestration.md` list leaves as **bare filenames** (`preprocess_references.python.ts`), reconstructing the full path only from the tree's root-dir line and indentation. The prefix-only rule above skips every one of these — yet these trees are the fastest-rotting content in the corpus (a `.ts` add/split falsifies them, and they are exactly what 362.9 had to repair). Either resolve bare tree leaves against the fenced block's root-dir line before `existsSync`, or require the layout blocks to carry prefixed paths. Existence-checking alone also never catches an **addition** (a real file absent from the tree) — the inverse check is what let `test_dir_patterns.ts` go stale; consider flagging a source file under a documented folder that no tree row names.
- (b) Import `ARIADNE_FAULT_AREA_FOLDER` from `@ariadnejs/types` and `existsSync` each non-empty value (`build_stop` runs earlier in the same Stop group, so the built types package is fresh).
- On any miss emit `decision:block`: `<rule-or-map> references <path> which does not exist — update the layout/map or restore the file`.
- Co-locate `doc_path_truth.test.ts`: existing path passes, deleted path blocks, prose mention without backticks ignored, ignore-marker respected.

### 2. Extend `detect_dead_code.ts` (do NOT add a hook)

- Seed the missing `.claude/known_entrypoints/{types,mcp,skill-fs}.json` whitelists from each package's current legitimate public surface — keep seeds **minimal**, over-seeding re-hides exactly the dead code (the ~450-LOC types island, zero-consumer introspection utilities) this hook exists to catch.
- In `load_whitelist`, distinguish file-absent (log + skip package) from present-but-empty (blocks all entry points, as designed).
- Tighten `get_modified_packages` so a package is analysed only when a `packages/<pkg>/src/**/*.ts` file changed, not any `packages/<pkg>/` path — this REDUCES per-Stop cost by skipping the heaviest hook on docs-only package changes.
- Type-only dead islands stay with the manual 362.5 deletions (the call graph cannot see them).

**Sequencing:** `doc_path_truth` must land AFTER the rule-payload refresh task (else it blocks immediately on `trace-call-graph.md`'s known-stale paths). Whitelist seeding for `types` benefits from 362.5's dead-island deletion landing first (smaller honest surface to seed) but does not strictly require it.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 doc_path_truth.ts blocks when a .claude/rules/\*.md backtick/fenced .ts path or an ARIADNE_FAULT_AREA_FOLDER value does not exist; honours <\!-- doc-path-truth:ignore -->
- [ ] #2 detect_dead_code.ts has seeded (minimal) known_entrypoints whitelists for types, mcp, skill-fs and distinguishes file-absent from present-but-empty
- [ ] #3 get_modified_packages analyses a package only when a packages/<pkg>/src/\*_/_.ts file changed
- [ ] #4 must land after TASK-362.9 so it does not block on known-stale rule paths; co-located test covers pass/block/ignore-marker
<!-- AC:END -->
