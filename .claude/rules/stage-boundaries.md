---
paths: packages/core/src/**
---

# Stage Boundaries

The pipeline order under `packages/core/src` is: `index_single_file` (stage 1) → `resolve_references` (stage 2) → `trace_call_graph` and `classify_entry_points` (stage 3). `project/` is the orchestrator above all stages. `logging/`, `persistence/`, and root files carry no stage.

## Value-import direction

- `project/` may value-import any stage; no stage value-imports `project/` or a later stage.
- `resolve_references/registries/**` never imports `resolve_references/call_resolution/**` — a store never depends on the lookup logic built over it.
- `import type` and inline `import { type X }` are exempt: type-only edges carry no runtime coupling.
- Only relative imports within `packages/core/src` are in scope; `@ariadnejs/*` package imports are governed by package boundaries, not stages.
- Test files are exempt from the direction rule.
- Two documented back-edges (`trace_call_graph` → `project/detect_test_file`, `classify_entry_points` → `project/file_loading`) are grandfathered in the hook's `GRANDFATHERED_EDGES` until the follow-up that lifts those shared primitives out of the orchestrator folder lands.

## Barrel contract

- An `index.ts` re-exports only its own directory subtree — never another module's surface, types included.
- A barrel with zero exports and zero importers is dead: delete it.

The Stop hook `.claude/hooks/stage_boundary_stop.ts` enforces this contract deterministically on changed files; its `STAGE_ORDER` in `.claude/hooks/stage_boundary.ts` is the source of truth this rule restates.
