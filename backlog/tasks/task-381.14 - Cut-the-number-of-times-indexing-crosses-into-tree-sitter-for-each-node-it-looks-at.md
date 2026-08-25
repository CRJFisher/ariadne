---
id: TASK-381.14
title: "Cut the number of times indexing crosses into tree-sitter for each node it looks at"
status: To Do
assignee: []
created_date: "2026-08-24 09:07"
labels:
  - performance
  - syntactic_extraction
dependencies:
  - TASK-381.8
  - TASK-381.13
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Once the quadratic terms are gone, the marshalling layer between JavaScript and the native tree-sitter binding is the floor the rest of the run sits on. Full-corpus `--cpu-prof` self-time shares on the pre-TASK-381.8 run: `get type` 6.88%, `get parent` 5.45%, `Query.captures` 3.49%, `childForFieldName` 2.25%, `unmarshalNode` 1.90%, `Parser.parse` 1.82%, plus the position and child accessors — about 29.3% of the run, 228 s of 778. Every one of those shares falls between 0.42x and 0.73x from n=927 to n=7,891, and that is what identifies them: unlike every other term in this system they shrink with corpus size, so they are linear work that the superlinear terms were hiding.

The 29.3% share does not survive TASK-381.8 and must not be used as this task's baseline. TASK-381.8 removes roughly 410 s from the denominator while leaving this term ~unchanged in absolute terms (the 603 files come back and are indexed once rather than once-then-discarded), so post-repair the same 228 s is roughly half the run. This task is judged on absolute CPU-seconds measured on the post-381.8 build, with shares recorded on both runs for context and no share threshold asserted.

The lever is fewer crossings per file, not a faster parser. Extract query captures in one batch per file instead of re-crossing per capture; read each node's type, position and children once per visit and pass them down rather than re-reading through the accessor on each use; avoid re-walking parents where the visitor already knows the parent.

## Explicitly not in scope

Parser configuration. Queries are already compiled once per dialect per process, and the per-file parser buffer sizing already present at `packages/core/src/project/project.ts:143-147` measured 0.008% of the corpus run; a fixed 32 KB buffer makes tree-sitter throw `Invalid argument` on `vs/base/browser/dom.ts`.

This is profiled and not prototyped, and the risk should be stated rather than discovered. The work is spread across the four per-file indexing passes and the language leaves, which is the opposite of the surgical registry fixes that produced every measured win so far, and the blast radius is correspondingly wide. It lands behind fingerprint diffs at three scales.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 #1 JS-to-native Node accessor calls per indexed file are counted before and after and fall by >= 30% on a 200-file size-stratified sample.
- [ ] #2 #2 A full-corpus `--cpu-prof` run on the post-TASK-381.8 build records the combined tree-sitter binding self-time in CPU-seconds; this task reduces it by >= 60 s against that recorded figure (228 s on the pre-381.8 run). The percentage share is recorded on both runs but no share threshold is asserted, because TASK-381.8 changes the denominator.
- [ ] #3 #3 The six-number fingerprint is byte-identical at n=200, n=1,200 and over the full corpus.
- [ ] #4 #4 The saving is measured on a run of every discovered file, not sampled and multiplied by file count.
- [ ] #5 #5 Query objects remain compiled once per dialect per process, and no change is made to parser buffer sizing — measured at 0.008% of the corpus run, and a fixed 32 KB buffer makes tree-sitter throw `Invalid argument` on `vs/base/browser/dom.ts`.

<!-- AC:END -->
