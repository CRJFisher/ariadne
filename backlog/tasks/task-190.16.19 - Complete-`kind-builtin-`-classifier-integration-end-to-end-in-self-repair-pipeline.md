---
id: TASK-190.16.19
title: >-
  Complete `kind:"builtin"` classifier integration end-to-end in
  self-repair-pipeline
status: Done
assignee: []
created_date: "2026-04-24 13:09"
labels:
  - self-repair-pipeline
  - auto-classifier
  - curator
  - bug
  - systemic-gap
dependencies: []
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Problem

The triage-curator emits `classifier.kind === "builtin"` proposals — its validator enforces the shape, its renderer drops a matching `check_<group_id>.ts` into `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/`, and `apply_proposals` writes registry entries with `classifier: { kind: "builtin", function_name, min_confidence }`.

The downstream `self-repair-pipeline` only knows `"none"` and `"predicate"`, so the refactor that introduced builtins is incomplete. Any registry mutation that lands a builtin entry crashes the post-commit test suite and the downstream renderer, and even when those pass the classifier never actually runs.

Concrete failure sites (all observed during the 2026-04-24 five-project sweep, artifacts preserved under `~/.ariadne/triage-curator/runs/`):

1. **Type gap** — `known_issues_types.ts:42` declares `ClassifierSpec = {kind:"none"} | {kind:"predicate"; ...}`. No `"builtin"` variant. Any TypeScript consumer narrowing on `kind` is non-exhaustive and silently ignores builtins at compile time.
2. **Validator rejects the kind** — `known_issues_registry.ts:189` throws `RegistryValidationError: .classifier.kind: must be "none" | "predicate" (got "builtin")` when registry.json contains a builtin entry. `load_registry` fails, every test that loads the registry fails, and the Stop hook blocks the commit.
3. **Test fails** — `known_issues_registry.test.ts:77` asserts `expect(["none", "predicate"]).toContain(e.classifier.kind)`.
4. **Renderer crashes** — `render_unsupported_features.ts:135` `render_classifier_short` switch has no `"builtin"` case; returns `undefined`, which then flows to `escape_table_cell(cell: string)` → `.replace` on undefined crash. This aborts derived-markdown regeneration inside `finalize_run.ts:303`.
5. **Orchestrator silently skips** — `auto_classify/orchestrator.ts:46` reads `if (spec.kind !== "predicate") continue;`. Builtin classifiers never run; `classifier_hint`s are never emitted from them; auto-classify rate stays at "predicate-only" ceiling.

## Scope

Complete the builtin integration so an investigator-authored `check_<group_id>.ts` actually classifies entries on the next pipeline run.

### Type / validator / test

- Extend `ClassifierSpec` in `.claude/skills/self-repair-pipeline/src/known_issues_types.ts` with `{ kind: "builtin"; function_name: string; min_confidence: number }`.
- Update `validate_classifier_spec` in `.claude/skills/self-repair-pipeline/src/known_issues_registry.ts` to accept `"builtin"` and validate `function_name` is non-empty + `min_confidence ∈ [0, 1]`.
- Update the kind assertion in `.claude/skills/self-repair-pipeline/src/known_issues_registry.test.ts:77` to include `"builtin"`.

### Derived-markdown renderer

- Add a `"builtin"` case to `render_classifier_short` in `.claude/skills/self-repair-pipeline/scripts/render_unsupported_features.ts:135` (e.g. `` `builtin, \`${classifier.function_name}\` (min_confidence ${classifier.min_confidence})` ``).
- Audit `render_entry` at line 99 — the `if (entry.classifier.kind === "predicate")` branch rendering the "Predicate" block must stay unchanged; builtins have no DSL predicate to render.

### Orchestrator dispatch

Given the rendered shape:

```ts
export function check_<function_name>(
  entry: EnrichedFunctionEntry,
  read_file_lines: FileLinesReader
): boolean;
```

Extend `classify_one` in `.claude/skills/self-repair-pipeline/src/auto_classify/orchestrator.ts` so that when `spec.kind === "builtin"`, it loads and invokes the rendered function.

Design decision to make: static registration vs dynamic lookup. Options:

- **Generated barrel** — finalize regenerates `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/index.ts` exporting a `Record<string, CheckFn>` keyed on `function_name`. Orchestrator imports the map at module load and looks up by `spec.function_name`. Static + type-checked + test-friendly.
- **Dynamic import** — orchestrator does `await import(`./builtins/check\_${target_group_id}.js`)` on match. Defers loading; breaks ESM sync semantics of `classify_one`.

Prefer the barrel approach — it keeps `classify_one` synchronous and the dispatch map greppable. Finalize already regenerates derived markdown on registry mutation; adding the barrel to that list is natural.

### Finalize barrel regeneration

Have `finalize_run.ts` regenerate `auto_classify/builtins/index.ts` whenever the registry mutates (alongside the four `unsupported_features.<lang>.md` files). The barrel content is deterministic over the registry's builtin entries.

### End-to-end verification

Resume the in-flight sweep (artifacts preserved under `~/.ariadne/triage-curator/runs/`) — re-render the 23 builtin classifier files, partition the authored-files map per-run (blocked on TASK-190.16.20), and run `finalize_run.ts` for each run. Confirm:

- All 5 runs' finalize exits 0.
- Registry contains builtin entries without breaking `pnpm test` in `.claude/skills/self-repair-pipeline`.
- A follow-up `auto_classify` run against one of the five corpora shows builtin-classifier hits contributing to the auto-classified count.

## References

- Rendered exports: `.claude/skills/triage-curator/src/render_classifier.ts:86-109`
- BuiltinClassifierSpec: `.claude/skills/triage-curator/src/types.ts`
- Partial mutation from the halted sweep: preserved responses under `~/.ariadne/triage-curator/runs/2026-04-16T18-10-16.855Z/`, `/2026-04-23T16-01-17.205Z/`, `/2026-04-23T20-22-56.592Z/`, `/2026-04-23T20-41-21.302Z/`, `/2026-04-23T22-12-28.705Z/`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 ClassifierSpec in known_issues_types.ts includes the builtin variant with function_name and min_confidence fields
- [x] #2 known_issues_registry validator accepts kind='builtin' with a shape check on function_name and min_confidence
- [x] #3 known_issues_registry.test.ts allows kind='builtin' in its registry load assertion and covers a builtin fixture
- [x] #4 render_classifier_short handles kind='builtin' with a concise printed form; derived markdown tests cover it
- [x] #5 auto_classify orchestrator dispatches kind='builtin' classifiers via a regenerated builtins/index.ts barrel and an in-process function call
- [x] #6 finalize_run regenerates builtins/index.ts whenever the registry mutates, and leaves it consistent with the registry entries
- [ ] #7 All five triage-curator runs preserved under ~/.ariadne/triage-curator/runs/ finalize successfully with no crash; .claude/skills/self-repair-pipeline pnpm test passes — depends on TASK-190.16.20; deferred to a future sweep run.
<!-- AC:END -->

## Implementation notes

- `BUILTIN_CHECKS` barrel (`auto_classify/builtins/index.ts`) is fully generated by `render_builtins_barrel.ts`. Initial empty barrel committed; finalize regenerates it whenever `registry_upserts.length > 0 || drift_tagged_groups.length > 0`.
- Orchestrator accepts an `AutoClassifyOptions.builtin_checks` override so tests can inject fake checks without touching the generated barrel.

## Reviewer follow-ups (applied)

- **Loud failure on stale barrel**: orchestrator now throws `MissingBuiltinError` when a registry entry references a builtin `function_name` not present in `BUILTIN_CHECKS`. Symmetric with `UnknownSignalCheckOpError` in the renderer. The previous behaviour (silent `continue`) hid stale-barrel bugs.
- **Function-name uniqueness check**: `validate_registry` now rejects two builtin entries that share `function_name`, since the generated barrel imports them as identifiers and a duplicate would surface only as a cryptic TS compile error.
