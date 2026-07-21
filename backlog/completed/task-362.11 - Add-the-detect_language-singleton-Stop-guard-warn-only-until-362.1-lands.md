---
id: TASK-362.11
title: Add the detect_language singleton Stop guard (warn-only until 362.1 lands)
status: Done
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

- [x] #1 detect_language_singleton_stop.ts is wired into the settings.json Stop array and early-exits unless a packages/\*_/_.ts file changed
- [x] #2 more than one detect_language definition, or any definition outside packages/core/src/detect_language.ts, is flagged with file:line
- [x] #3 ships warn-only; flips to decision:block in the same commit that closes 362.1; co-located test covers pass/block/import-ignored
<!-- AC:END -->

## Implementation Notes

## High-level summary

The guard exists because the language-identity invariant that TASK-362.1 established — one `detect_language(path): Language|null`, living at `packages/core/src/detect_language.ts`, returning `null` for unknown extensions — is exactly the kind of consolidation that erodes silently: a second definition anywhere in `packages/` re-opens the fork in which unknown extensions defaulted to a language and call graphs mislabeled files. This Stop hook makes the invariant self-enforcing.

The hook ships in `decision:block` mode, not the warn-only mode this task originally sequenced. The warn phase existed solely to avoid wedging turns while 362.1's consolidation was in flight; 362.1 landed with the tree clean (exactly one canonical definition), so a block cannot fire on pre-existing state, and warn-only would have left the guard permanently non-enforcing with no flip event remaining. The wedge risks a blocking Stop hook carries are neutralized directly: a `stop_hook_active` guard prevents block loops, a fail-open try/catch (plus a per-file guard in the walk) keeps a crash or unreadable file from blocking unrelated turns, and diagnostics go to `hook_log.txt` so stdout carries nothing but the violation JSON.

`detect_language_singleton.ts` owns the pure logic — the two line-anchored definition regexes (free `function`/`default function`/`const|let|var` forms; imports, re-exports, call sites, `declare` lines, and longer names never match), the scannable-path filter (`packages/**/*.ts` minus `.test.ts`, `.d.ts`, `dist/`, `node_modules/`), offender selection (zero definitions is deliberately allowed — deletion is a build failure, not a fork), and the violation message. `detect_language_singleton_stop.ts` is the untested seam: stdin parse, the changed-files trigger (mirroring the scan filter, and scanning anyway when git detection failed), the full-tree walk, and the block emit. The trigger gates on a scannable change; the scan then covers the whole tree so the pre-existing half of a fork is always listed. `detect_language_singleton.test.ts` (25 fixture-string tests) is discovered because `vitest.config.mjs` promotes `.claude/hooks/` into a test root for `scripts/run_all_tests.sh`.

Known non-goals, documented in the code: class/object-method and multi-line definition forms, `.tsx`/`.mts`/`.cts` files, and generic signatures are out of scope (the canonical export is a free, non-generic function). A TypeScript overload signature added to the canonical file would be flagged as a duplicate — acceptable, since the canonical contract is a single non-overloaded function.
