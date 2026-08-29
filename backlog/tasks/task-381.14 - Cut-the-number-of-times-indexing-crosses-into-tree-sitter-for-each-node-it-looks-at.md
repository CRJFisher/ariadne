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

## What the crossings turned out to be

The largest term is a read the binding intends to be free. `node-tree-sitter`
mints one JavaScript class per node type id and then assigns the type name onto
that class, but the assignment travels through `SyntaxNode`'s getter-only
accessor in sloppy mode and is a silent no-op — so every `node.type` in the
pipeline marshalled the node and called the addon. Measured over 200
size-stratified files: **14,328 crossings per indexed file, 45.7% of all of
them, 42.91 CPU-seconds of the corpus run.** Holding the name where the binding
meant to hold it takes that to one crossing per type id per process. The
anonymous tokens all share the base class, which cannot hold one name, so each
type id is given a class of its own; pinning per class instead is REFUTED by
its own oracle, 251,206 disagreements over 601,005 nodes.

Captures were already extracted in one batch per file — one `Query.captures`
call per file, one compiled query per dialect per process — so the crossing
there was not the extraction but the normalisation: a capture asked for its
text and its location separately, four crossings where two would do. Slicing
the text out of the parsed source between the two Points its location already
read is exact over every capture of the sample, 212,870 of 212,870.

The rest is walks re-asking what they already held: the construct-target chain
answered once per ancestor rather than once per call beneath it, the JSDoc
comment reached as the declaration's previous sibling rather than by
enumerating its parent's children, and three child-index loops reading the
child list once.

## Explicitly not in scope

Parser configuration. Queries are already compiled once per dialect per process, and the per-file parser buffer sizing already present at `packages/core/src/project/project.ts:143-147` measured 0.008% of the corpus run; a fixed 32 KB buffer makes tree-sitter throw `Invalid argument` on `vs/base/browser/dom.ts`.

This is profiled and not prototyped, and the risk should be stated rather than discovered. The work is spread across the four per-file indexing passes and the language leaves, which is the opposite of the surgical registry fixes that produced every measured win so far, and the blast radius is correspondingly wide. It lands behind fingerprint diffs at three scales.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 #1 JS-to-native Node accessor calls per indexed file are counted before and after and fall by >= 30% on a 200-file size-stratified sample. MEASURED **31,346.5 -> 11,096.8, a 64.60% fall** (65.50% counting only the accessors that reach the addon; `text` is a Node accessor the code reads, but `tree.getText` is JavaScript and the two crossings it makes are its `startIndex` and `endIndex` reads). Both arms run the same probe file, which installs its counters on `SyntaxNode.prototype` BEFORE importing the checkout under test, and counts only across `build_index_single_file`. The sample yields the same 160,785 references and 8,338 scopes under both trees. `type` 2,865,539 -> 156, `childCount` 205,497 -> 0, `child` 175,344 -> 626, `startIndex`/`endIndex` 411,185 -> 198,395 each, `parent` 601,035 -> 405,109, against `children` 59,692 -> 84,716 and `previousSibling` 0 -> 14,645 added. Recorded in `RECORDED_TREE_SITTER_CROSSINGS`.
- [x] #2 #2 A full-corpus `--cpu-prof` run on the post-TASK-381.8 build records the combined tree-sitter binding self-time in CPU-seconds; this task reduces it by >= 60 s against that recorded figure (228 s on the pre-381.8 run). The percentage share is recorded on both runs but no share threshold is asserted, because TASK-381.8 changes the denominator. MEASURED on ariadne@4be67581 (the epic's stack through TASK-381.13): **184.87 s**, mean of two full-corpus profiled arms (183.78, 185.95), against **121.45 s** on ariadne@87d94d30 (120.60, 122.29) — a saving of **63.42 s**, and 61.49 s at the worst pairing, so the gap does not rest on two means overlapping. The four arms interleaved control,candidate,control,candidate in one session. Share 45.84% -> 36.48%, recorded and not asserted. Frame by frame: `get type` 42.91 -> 0.00 s, `get parent` 34.91 -> 26.83, `unmarshalNode` 11.26 -> 8.88, `startIndex`+`endIndex` 11.29 -> 5.24, `child`+`childCount` 6.53 -> 0.03, `marshalNode` 4.02 -> 1.39, against `children` 4.25 -> 6.44, `unmarshalNodes` 6.03 -> 7.82 and `previousSibling` 0.00 -> 1.32 added. The 228 s pre-381.8 figure is prior record and is not this criterion's baseline.
- [x] #3 #3 The six-number fingerprint is byte-identical at n=200, n=1,200 and over the full corpus. MEASURED at all three, on the seven-number fingerprint that superseded the six — plus both diagnostics hashes. Over all 8,494 files, eight arms (four unprofiled, four profiled) report nodes 201595/1dee6f73bd6b19b3, resolved 1077986/1ddc158820141bce, unresolved 420958/4783fb8da9030c81, entry points 17563/81190da4a3cade3d, indirect keys 29378/bd658514f967310e, dropped 0/e3b0c44298fc1c14, indirect evidence 29378/0d66eb1473576544, `diag_hash` d08f8e814597b4bb and `canonical_hash` 834cc16d32aef077 — the values `RECORDED_ORDER_INDEPENDENCE` already holds for this corpus in forward order.
- [x] #4 #4 The saving is measured on a run of every discovered file, not sampled and multiplied by file count. MEASURED: every corpus figure comes from arms that offered all 8,494 discovered files and indexed 8,494 with an empty dropped set, cpu/wall 1.04 on all four unprofiled arms. Unprofiled whole-run CPU **299.90 s -> 226.24 s** (73.66 s, 1.33x, 8.672 ms/file), spreads 0.39% and 0.66%. The 200-file sample under-predicts it — 6.756 ms/file against 8.672 — which is the same direction TASK-381.13 recorded and the reason the corpus figure is the one quoted.
- [x] #5 #5 Query objects remain compiled once per dialect per process, and no change is made to parser buffer sizing — measured at 0.008% of the corpus run, and a fixed 32 KB buffer makes tree-sitter throw `Invalid argument` on `vs/base/browser/dom.ts`. MEASURED: over 1,200 files both trees compile **2 queries for 2 dialects** (`typescript`, `javascript`) and call `Query.captures` once per file, so captures are already extracted in one batch. `project.ts`, `query_code_tree.ts` and `native.ts` are byte-identical to the control commit, so the per-project buffer still grows to twice the longest file's length and query compilation still routes through `COMPILED_QUERY_CACHE`.

<!-- AC:END -->
