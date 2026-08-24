# TASK-381 build order

Run these in this order, one at a time. The order already respects both the dependency graph and the
file collisions between sub-tasks, so following it top to bottom is enough — there is nothing to decide.

Every mechanism here was built and measured once as a throwaway prototype. Those patches are on this
machine under `~/.ariadne/perf-investigation-2026-08-23/patches/`, and each step names the one that
implements it, so no sub-task starts from a blank page.

Before starting:

```bash
git branch epic/381
```

Each step gets its own worktree branched from `epic/381` as it stands at that moment, and merges back
when it lands. `/build-and-review` creates the worktree itself.

## Rules that apply to every step

**The task doc is the spec; the patch is a reference.** Four prototype claims were refuted by independent
verification — the 2.202× that is 1.570× composed, the ≤5.1 GB that is 5.4–6.5 GB, the corpus-specific
"`dropped_files` is empty", and a misattributed 3-entry-point regression. The docs carry the corrected
version; the patches do not know they were refuted. Where they disagree, the doc wins.

**The patches are composed, not per-task.** `decisive-stack.patch` carries five sub-tasks' worth of
change; `eviction-reverse-index.patch` carries four. Take only the hunks for the surface each step names.
A patch applying cleanly is not evidence you landed the right subset.

**Never judge a budget against a number quoted in a doc.** Identical computation with byte-identical
output measured 777.6 s, 801.3 s and 1,019.4 s across three sessions on this hardware. Build a control
arm in the same session — the unpatched tree — and judge the change as a *ratio* against it. Two separate
power-law extrapolations from slices under-predicted the truth by 2.19× and 16.8×, so if a criterion is
about the corpus, run the corpus.

**One at a time.** This is a 4-core box and most steps carry a measured acceptance criterion. Two
concurrent benchmark runs corrupt each other's timings — that is what made the first two days of this
investigation unreliable, with `cpu/wall` down to 0.06 and identical work swinging 8.9×.

**Corpus.** microsoft/vscode @ `f3fa55c3` at `~/.ariadne/triage-entrypoints/repos/microsoft--vscode`,
`src/` only → 8,494 files by Ariadne's walk. The repo root discovers 12,654 and takes 27.6 min; every
criterion in this epic refers to the `src/` figure. Runs need `--max-old-space-size=6144` — the corpus
OOMs at node's ~4 GB default.

---

## 1 — `task-381.1` · benchmark and fingerprint

Nothing downstream is judgeable without it: it defines the benchmark every later criterion is measured
against, and the seven-number fingerprint that proves no change altered the reported graph.

Reference: the probe toolkit at `~/.ariadne/perf-investigation-2026-08-23/probe/` — `lib/corpus.ts`,
`lib/phase_timer.ts`, `lib/mem.ts`, `run.ts`. Read `probe/README.md` first; its caveats list the traps,
including that module-level exports are not monkey-patchable under tsx and fail **silently**.

## 2 — `task-381.3` · DefinitionRegistry reverse indices

Reference: `patches/wf_654630da-88d-16.patch`, **only** the `registries/definition.ts` hunks
(`owner_members`, `subtype_parents` and their maintenance). The rest of that patch is step 5's.
Measured 14,923× → 89,689× fewer scanned entries as the corpus grows — the benefit *grows* with `n`, so a
small-`n` measurement understates it by ~2.3×.

## 3 — `task-381.2` · deterministic diagnostics

Reference: `patches/phase2/eviction-reverse-index.patch`, **only** the
`classify_entry_points/extract_entry_point_diagnostics.ts` hunks. Two distinct root causes:
`build_lines_by_file` iterating an insertion-ordered map, and — the one that actually mattered —
`build_call_refs_by_name` pushing call sites in load order before `find_matching_call_refs` truncates
each list to `MAX_DIAGNOSTICS_PER_ENTRY = 50`, so order decided which evidence survived.

## 4 — `task-381.9` · self-describing cache blobs

Comes before the driver because it owns the same three files. Reference:
`patches/wf_654630da-88d-18.patch` (complete — not composed). Deletes `CacheManifest` in favour of
self-describing blobs. **Reconcile with open TASK-378**, which adds indexer-versioning to the file this
deletes; the task doc records how.

## 5 — `task-381.4` · two-phase bulk driver

Reference: `patches/wf_654630da-88d-16.patch`, the `project.ts`, `load_project.ts` and
`project_cache_strategy.ts` hunks (`Project.ingest_file` + `resolve_corpus`). Step 4 touched the same
three files, so expect a real merge rather than a clean apply. Passes all 3,643 core tests in the
prototype. Measured 1.17× CPU at n=200 but **2.31× lower peak heap** — the memory result is the bigger
half of the win.

## 6 — `task-381.5` · set-wise resolution-state eviction

Reference: `patches/phase2/resolution-state-eviction.patch`. `remove_file` becomes
`remove_files(state, ReadonlySet<FilePath>)` — one pass per batch instead of one whole-project scan and
four map clones per file, which `resolution_registry.ts:67-69` was doing in a loop. Settles a judge's
claim that these were clones of *empty* maps: measured 325,069 / 3,828,722 / 45,246,708 cloned entries at
n=200/600/1200.

## 7 — `task-381.6` · ScopeResolutions parent chain

Owns `resolution_state.ts`, which step 6 just changed — branch from `epic/381` after it merges. Their
prototypes conflicted on `git apply`. Reference: `patches/phase2/memory-name-table.patch`. Replaces the
flattened per-scope symbol table, of whose 296,061 entries 97.48% were byte-identical to an ancestor
binding. Watch the lookup cost: this trades memory for scope-chain walks.

## 8 — `task-381.7` · full-corpus measurement checkpoint

No reference patch and no production code. This is the measurement that replaces every projection in the
epic with a number from a run of every discovered file, plus an in-checkout control arm.

## 9 — `task-381.8` · export gate — **the capability lands here**

Reference: `patches/phase3/export-gate-repair.patch` (complete, built on top of everything above).
`value_exports` / `type_exports` keyed on (declaration space, name); both throws deleted rather than
flagged off; `get_export` returns the member-declaring binding over one that does not. Readmits 603
files, 12,069 nodes and 293,111 resolved call edges **while costing less CPU** — the gate's real cost was
never the dropped files but the 603 project-wide rollback cascades their removal triggered after they had
already been fully indexed.

This changes the reported set **by design**, so prove improvement rather than identity:
`nodes(before) \ nodes(after) = 0`, and account for every entry point that moved. Two open decisions are
recorded in the doc — Rust `#[cfg]`-gated duplicates, and the `byKind` same-space collision that turns
out to be an indexing bug the gate was masking.

## 10 — `task-381.11` · order-independent call graph

Reference: `patches/phase3/order-determinism.patch`. `fix_import_locations.ts:66` rewrites every
`ImportDefinition.location` onto the declaration it names, and `definition.ts:116-117` then keys
`location_to_symbol` on that location for *every* definition including imports — so one declaration's
location is claimed by the declaration and by every importer, and the last writer wins. Fixing it makes
the fingerprint byte-identical across forward, reversed and two seeded-shuffle ingests, and converges on
the *correct* answer: 73 fewer false entry points, 1,217 more resolved edges.

## 11 — `task-381.15` · flatten call-resolution growth

Owns `call_resolver.ts`, which step 10 just changed. No reference patch — profiled only.
`resolve_calls_for_files` was 5.72% of CPU with its share growing 5.9×, and it is genuinely superlinear
rather than a `ResolutionState` artefact.

## 12 — `task-381.14` · fewer tree-sitter crossings

No reference patch — profiled only. Tree-sitter is 42–47% of all CPU while `Parser.parse` is 3–4%; the
rest is Ariadne's own JS walking the tree one property at a time, marshalling each native node access.

## 13 — `task-381.16` · memory contract

No reference patch and no production code. Already answered by measurement: the corpus **OOMs at node's
4,144 MB default** after 666 s, and completes at `--max-old-space-size=6144` with a 3,563.8 MB settled
heap. This step writes that contract down and enforces it.

## 14 — `task-381.12` · cap the post-load grep index

Owns `extract_entry_point_diagnostics.ts`, which step 3 changed. No reference patch. Measured 1,083,422
retained hits of which 863,681 (80%) can never be read.

## 15 — `task-381.13` · stop re-deriving scope containment

No reference patch — profiled only. Owns `index_single_file.ts`, which step 12 changed.

## 16 — `task-381.10` · self-keywords via Map lookup

Reference: `patches/wf_654630da-88d-19.patch`, **only** the
`metadata_extractors/metadata_extractors.javascript.ts` hunks; the `parallel_index.ts` /
`index_worker.cjs` files in that patch belong to step 17.

## 17 — `task-381.17` · parallel indexing across worker threads

Last, and only now worth doing. Reference: `patches/wf_654630da-88d-19.patch`, the
`project/parallel_index.ts` and `project/index_worker.cjs` files. The spike measured 1.10× wall at n=200
for +33% CPU, projecting to ~1.05× at corpus scale because the parallelisable share falls from 57% to
~9% — and on a contended box *every* pooled arm was slower than serial. After the eviction quadratics
land it projects to ~1.9×. Its budget is stated in **wall-seconds on an idle box**, not CPU-seconds;
that unit confusion was a fabricated metric the first review caught. Run on an idle machine only.
