---
paths: packages/core/src/**
---

# Stage Boundaries

The pipeline order under `packages/core/src` is: `index_single_file` (stage 1) → `resolve_references` (stage 2) → `trace_call_graph` and `classify_entry_points` (stage 3). `project/` is the orchestrator above all stages, and `benchmark_corpus_load/` is the measurement harness over the whole pipeline, also above all stages. `logging/`, `persistence/`, and root files carry no stage.

## Value-import direction

- `project/` and `benchmark_corpus_load/` may value-import any stage; no stage value-imports either of them, or a later stage.
- `resolve_references/registries/**` never imports `resolve_references/call_resolution/**` — a store never depends on the lookup logic built over it.
- `import type` and inline `import { type X }` are exempt: type-only edges carry no runtime coupling.
- Only relative imports within `packages/core/src` are in scope; `@ariadnejs/*` package imports are governed by package boundaries, not stages.
- Test files are exempt from the direction rule.
- Only static `import` / `export … from` statements are checked; dynamic `import()` is out of scope.
- Two back-edges (`trace_call_graph` → `project/detect_test_file`, `classify_entry_points` → `project/file_loading`) are listed in the hook's `GRANDFATHERED_EDGES` and do not block; removing an edge's entry is part of lifting its shared primitive out of `project/`.

## Barrel contract

- An `index.ts` re-exports only its own directory subtree — never another module's surface, types included. The hook checks direct `export … from` statements.
- A barrel with zero exports and zero importers is dead: delete it. The package entry `packages/core/src/index.ts` is exempt — package.json references it, not imports.

## What ships

`packages/core/tsconfig.build.json` excludes `src/benchmark_corpus_load/**`. The harness measures the pipeline and is run from `packages/core/scripts/run_load_benchmark.ts` under `tsx`; it is not part of the published surface, so it is compiled by `tsc --noEmit` and by the test run but never emitted into `dist/`.

The Stop hook `.claude/hooks/stage_boundary_stop.ts` enforces this contract deterministically on changed files; its `STAGE_ORDER` in `.claude/hooks/stage_boundary.ts` is the source of truth this rule restates.
