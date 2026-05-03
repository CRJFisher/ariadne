# TASK-190.17 — Classification of entry points: a high-level overview

This document is a plain-English map between **what TASK-190.17 changes** and **where that lives in the code**. It is meant to be read top-to-bottom by someone who has never touched this part of the codebase. Every claim is anchored to a file path and (where useful) a line number so you can verify the fundamentals at a glance.

---

## 1. The problem in one paragraph

Before this task, `Project.get_call_graph()` returned a list of "entry points" that mixed real probably-dead functions with **noise** — things that look unreachable to a static analyzer but are in fact called by frameworks (Flask routes via `@app.route`, pytest fixtures, JSX components, dynamic dispatch) or by the language runtime (`__str__`, `__repr__`, …). Knowledge of these blind spots already existed inside the `self-repair-pipeline` skill (179 rules), but it never made its way back into the library, so every fresh consumer (the MCP `list_entrypoints` tool, library users, future skills) re-received the noise. TASK-190.17 fixes that by **moving classification into `@ariadnejs/core` itself**, so a fresh `npm install @ariadnejs/core` followed by `Project.get_call_graph()` already produces a clean list.

---

## 2. The two-method shape (the user-visible API)

Two methods on `Project`, two concrete return types, no narrowing at call sites.

| Method                                  | Purpose                                        | Returns                                                                                |
| --------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Project.get_call_graph()`              | Basic. Probably-dead functions only.           | `CallGraph` whose `entry_points` is a clean `readonly SymbolId[]`.                     |
| `Project.get_classified_entry_points()` | Triage. Every candidate paired with a verdict. | `{ true_entry_points, known_false_positives }`, both arrays of `ClassifiedEntryPoint`. |

Code:

- API definitions: `packages/core/src/project/project.ts:533` (`get_call_graph`) and `packages/core/src/project/project.ts:554` (`get_classified_entry_points`).
- Both go through one private primitive `compute_enriched_call_graph` at `packages/core/src/project/project.ts:558` that runs the work once per `(registry, include_tests)` and caches the result on the `Project` instance (`enriched_cache`, `packages/core/src/project/project.ts:168`). The cache is invalidated whenever any file in the project mutates (`update_file` clears it at `packages/core/src/project/project.ts:212`).

Public types live in `@ariadnejs/types`:

- `ClassifiedEntryPoint`, `ClassifiedEntryPoints`, `EntryPointClassification`, `TraceCallGraphOptions`, `ClassifierHint` — `packages/types/src/classified_entry_point.ts`.
- `KnownIssue`, `KnownIssuesRegistry`, `KnownIssuesRegistryFile`, `KNOWN_ISSUES_REGISTRY_SCHEMA_VERSION`, `PredicateExpr`, `ClassifierSpec` — `packages/types/src/known_issues.ts`.

`EntryPointClassification` is a tagged union: `true_entry_point | framework_invoked | dunder_protocol | test_only | indirect_only`. Every non-`true_entry_point` verdict carries `group_id` (the matched registry rule), so triage tooling can always trace a verdict back to a rule.

---

## 3. The core primitive: `enrich_call_graph`

Both `get_call_graph()` and `get_classified_entry_points()` are thin wrappers over a single function:

```text
packages/core/src/classify_entry_points/enrich_call_graph.ts
```

It does three things in order:

1. **Diagnostics extraction** — `extract_entry_point_diagnostics(call_graph, project)` builds an `EnrichedEntryPoint` per candidate (decorators, definition features, grep hits, resolution-failure reason). Reads only `Project.file_contents`; never touches the filesystem itself.
2. **Rule application** — `auto_classify(enriched_entry_points, registry, read_file_lines)` walks the registry. Each rule's `classifier.kind` decides:
   - `none` → skip (known issue, no automated rule yet).
   - `predicate` → evaluate the closed DSL via `predicate_evaluator`.
   - `builtin` → look up `function_name` in the generated barrel `builtins/index.ts` and invoke it. A missing entry throws `MissingBuiltinError` (loud, not silent).
3. **Mapping to public taxonomy** — each match's registry-side `KnownIssue.classification` (e.g. `{ kind: "framework_invoked", framework: "flask" }`) is combined with per-match data (e.g. `entry_point.name` for dunder protocol) to produce the public `EntryPointClassification`.

`enrich_call_graph` returns:

```ts
interface EnrichedCallGraph {
  call_graph: CallGraph; // unchanged input
  classified_entry_points: ClassifiedEntryPoints; // {true, fps}
  entry_points_by_id: ReadonlyMap<SymbolId, EnrichedEntryPoint>;
  classifier_hints_by_id: ReadonlyMap<SymbolId, readonly ClassifierHint[]>;
}
```

The `entry_points_by_id` and `classifier_hints_by_id` maps are what the self-healing pipeline uses to build LLM-triage prompts for the residual bucket; library callers never need them.

`enrich_call_graph` accepts a second option — `unindexed_test_grep: "applied" | "skipped"` (default `"skipped"`). When `"skipped"`, the function refuses any registry that contains a rule using the `has_unindexed_test_caller` predicate, because that predicate's input is only populated by `attach_unindexed_test_grep_hits` (a filesystem pass that runs in `detect_entrypoints`). Set it to `"applied"` after running the grep pass yourself; library callers and the in-process `prepare_triage` pipeline leave the default and get a loud refusal instead of silent misclassification.

---

## 4. Where the rules come from

Rules live in **two synchronized locations** with a single source of truth:

```
.claude/skills/self-repair-pipeline/known_issues/registry.json    ← source of truth (180 rules, mix of permanent / wip / fixed)
                            │
                            │  pnpm sync-permanent-rules
                            ▼
packages/core/src/classify_entry_points/permanent_data.ts          ← bundled slice (8 permanent rules with classifier ≠ none)
```

- **Skill registry** (`.../registry.json`) is the curator's working copy. Includes `permanent`, `wip`, and `fixed` rules. The triage-curator skill mutates this file as new patterns are discovered.
- **Bundled slice** (`packages/core/src/classify_entry_points/permanent_data.ts`) is auto-generated TypeScript. Filtered to `status === "permanent" && classifier.kind !== "none"`. Ships in `dist/` because it's a `.ts` file emitted by tsc — no JSON files to thread through `package.json#files`.
- **Generator script**: `.claude/skills/self-repair-pipeline/scripts/sync_permanent_rules.ts`. Wired as `pnpm sync-permanent-rules` (root `package.json:12`). It also re-renders the builtins barrel (`packages/core/src/classify_entry_points/builtins/index.ts`) via `render_builtins_barrel` so dispatch always tracks the registry.
- **CI gate**: `pnpm check-permanent-rules` (`package.json:13`) regenerates and asserts a clean diff. Wired into `.github/workflows/test.yml:44`.

The slice loader is `packages/core/src/classify_entry_points/registry_loader.ts` — it cross-checks `schema_version`, asserts only permanent + non-none rules, deep-clones, and pre-compiles regex patterns. Fails loud (`PermanentRegistryError`) on any drift the CI gate might have missed.

---

## 5. The death of `filter_entry_points.python.ts`

Before TASK-190.17 there was a hardcoded TS list at `packages/core/src/trace_call_graph/filter_entry_points.python.ts` that hard-dropped Python dunders (`__str__`, `__repr__`, …). That file is **deleted** and replaced by a registry rule:

- The rule lives in the skill registry as `group_id: "py-dunder-protocol"`, `status: "permanent"`, `classifier.kind: "builtin"`.
- The builtin TS function lives at `packages/core/src/classify_entry_points/builtins/check_py-dunder-protocol.ts`.
- Matched entry points surface as `EntryPointClassification = { kind: "dunder_protocol", group_id, protocol: "__str__" | … }` in `known_false_positives`.

Same user-facing behavior, unified mechanism. Python dunders are no longer special — they're just one rule among many.

---

## 6. The MCP tool (`list_entrypoints`)

Default MCP output is unchanged in shape: a clean list of true positives. One server-level opt-in flag exposes the suppressed bucket:

- **CLI**: `--show-suppressed` / `--no-show-suppressed`.
- **Env**: `ARIADNE_SHOW_SUPPRESSED=1`.
- **Default**: `false`.

When enabled, every `list_entrypoints` response appends a clearly delimited "Suppressed (known false positives)" section, each entry tagged like `[group_id: framework]` (or `[dunder_protocol: __str__]`, `[test_only]`, `[indirect_only: function_reference]`).

Why server-level rather than per-call:

- Triage workflows enable it once via `.mcp.json`; everyday agents see the clean default and don't have to know the flag exists.
- The per-call schema stays minimal — the tool description doesn't grow.

Code:

- Implementation: `packages/mcp/src/tools/core/list_entrypoints.ts:415`.
- CLI parsing: `packages/mcp/src/server.ts:54`. Resolution `CLI > env > default`: `packages/mcp/src/server.ts:84` (`resolve_show_suppressed`).
- Threading into the tool factory: `packages/mcp/src/start_server.ts:84`.

---

## 7. The self-healing pipeline becomes a thin caller

Before TASK-190.17, the self-repair-pipeline skill _owned_ the orchestrator and the diagnostics extractor. After, it **calls core**:

| Skill responsibility                                              | Where                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build `AnalysisResult` from a project for a downstream triage run | `.claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts` calls `extract_entry_point_diagnostics` directly (it does not classify here — the triage pipeline re-classifies once `attach_unindexed_test_grep_hits` has populated the grep set), then runs `attach_unindexed_test_grep_hits` |
| Drive the triage loop on residuals                                | `.claude/skills/self-repair-pipeline/src/prepare_triage.ts:73` calls `enrich_call_graph` with the **full** registry — permanent + wip                        |
| Operator state (run dirs, `LATEST` pointer, TP cache)             | `.claude/skills/self-repair-pipeline/src/run_discovery.ts`, `triage_state_paths.ts`, `triage_results_store.ts`, `confirmed_unreachable_reuse.ts` (unchanged) |
| Curate new rules                                                  | `triage-curator` skill (separate; writes to `registry.json`, then `pnpm sync-permanent-rules` graduates qualifying rules into core)                          |
| Render builtins barrel                                            | `.claude/skills/self-repair-pipeline/src/auto_classify/render_builtins_barrel.ts` (the only file left in `auto_classify/`; emits to core's path)             |

Why the skill keeps a full-registry loader: the pipeline wants to see **wip** rule matches too, so it can collect classifier hints into the LLM-triage prompt. Library callers only ever see the permanent slice.

The unindexed-test guard lives in `enrich_call_graph` itself (see Section 3). Both library callers and the in-process `prepare_triage` pipeline leave `unindexed_test_grep` at its `"skipped"` default and get a loud refusal if the registry contains a rule using `has_unindexed_test_caller`. `detect_entrypoints` does not call `enrich_call_graph` at all — it builds the diagnostics with `extract_entry_point_diagnostics`, attaches grep hits via `attach_unindexed_test_grep_hits`, and writes the resulting `EnrichedEntryPoint[]` straight into the analysis JSON.

---

## 8. Caching and performance

Two layers:

1. **`Project.enriched_cache`** — single-slot LRU keyed by `(registry-identity, include_tests)`. Reused across `get_call_graph()` ↔ `get_classified_entry_points()` calls in the same session. Invalidated by any `update_file` / `remove_file` / `restore_file` / `clear`. See `packages/core/src/project/project.ts:168` and `packages/core/src/project/project.ts:212`.
2. **Persistence cache** — `packages/core/src/persistence/cache_manifest.ts:8` — `CURRENT_SCHEMA_VERSION` was bumped from `1 → 2` so the new entry-points shape auto-invalidates pre-bump caches in `~/.ariadne/cache/<slug>/manifest.json`. The mismatch-discard path is in `deserialize_manifest:47-49`.

Predicate evaluation cost on a 200-entry-point project is roughly 50–200 ms (≈7000 cheap checks plus ≈150 file reads). The `extract_entry_point_diagnostics` grep step uses an inverted index (one O(source bytes) pass, then O(1) lookups), so it is not quadratic.

---

## 9. The rename hygiene that landed under .1 and .2

Two pure-rename sub-tasks landed before any structural moves:

- `entry` / `entries` shorthand → `entry_point` / `entry_points` (190.17.1). Examples: `EnrichedFunctionEntry → EnrichedEntryPoint`, `AutoClassifiedEntry → AutoClassifiedEntryPoint`.
- `IntrospectionGap → SignalLibraryGap` in the triage-curator skill (190.17.2). The renamed concept means "the signal-library / classifier-DSL is missing an op" — distinct from `core/src/introspection/` (the facts API).

These were prerequisites: doing the renames before structural moves kept the post-move import-path updates mechanical.

---

## 10. Persisted-state policy

Important contract for upgraders: **do not** `rm -rf ~/.ariadne/self-repair-pipeline/analysis_output/`. That directory is the permanent source of truth for the TP cache (consumed by `most_recent_finalized_triage_results` in `.claude/skills/self-repair-pipeline/src/triage_results_store.ts`). Wiping it kills cross-run TP reuse and forces every previously-confirmed entry point back through the LLM investigator.

For pre-existing per-project state at upgrade time:

- Stale "active" runs: clear the `LATEST` pointer via `.claude/skills/self-repair-pipeline/scripts/abandon_run.ts` or by deleting the LATEST file.
- Pre-run-namespaced state: run `.claude/skills/self-repair-pipeline/scripts/migrate_legacy_state.ts --project <name>` (or `--purge` to drop history).

---

## 11. Verification (TASK-190.17.17, planned)

Equivalence check via `diff_runs.ts` on a fixed commit pre/post — expect zero `flipped` verdicts and only the dunder rule's group churn. Performance: `Project.get_call_graph()` on the largest fixture should be ≤25% slower. Live MCP smoke test on a Flask fixture.

---

## 12. Map of the file moves (what went where)

| Before                                                                                  | After                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `.claude/skills/self-repair-pipeline/src/extract_entry_points.ts`                       | `packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts`         |
| `.claude/skills/self-repair-pipeline/src/auto_classify/orchestrator.ts`                 | `packages/core/src/classify_entry_points/classify_entry_points.ts`                   |
| `.claude/skills/self-repair-pipeline/src/auto_classify/predicate_evaluator.ts`          | `packages/core/src/classify_entry_points/predicate_evaluator.ts`                     |
| `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/check_*.ts` (~64 files) | `packages/core/src/classify_entry_points/builtins/check_*.ts`                        |
| `.claude/skills/self-repair-pipeline/src/entry_point_types.ts`                          | `packages/types/src/entry_point.ts` + `packages/types/src/classified_entry_point.ts` |
| `.claude/skills/self-repair-pipeline/src/known_issues_types.ts`                         | `packages/types/src/known_issues.ts`                                                 |
| `packages/core/src/trace_call_graph/filter_entry_points.python.ts`                      | DELETED — replaced by the `py-dunder-protocol` registry rule                         |

The skill kept (`auto_classify/render_builtins_barrel.ts`) because it's a _generator that writes into core_ — owned by the skill, target lives in core. Same story for `scripts/sync_permanent_rules.ts`.

---

## 13. Quick verification recipes

If you want to sanity-check the migration yourself:

1. **The slice is consistent with the registry**:

   ```
   pnpm sync-permanent-rules && git status
   ```

   Should produce no diffs. (See `package.json:12`. CI runs this as `check-permanent-rules` in `.github/workflows/test.yml:44`.)

2. **Python dunders are classified, not hardcoded-filtered**:

   ```
   grep -rn "filter_entry_points" packages/core/src/
   ```

   Should match only doc-comment references (e.g. inside `permanent_data.ts` and `check_py-dunder-protocol.ts` describing what the rule replaces). The file `filter_entry_points.python.ts` itself should not exist.

3. **Skill no longer owns the orchestrator**:

   ```
   ls .claude/skills/self-repair-pipeline/src/auto_classify/
   ```

   Should show only `render_builtins_barrel.ts` and its test.

4. **Two methods on Project**:

   ```
   grep -n "get_call_graph\|get_classified_entry_points" packages/core/src/project/project.ts
   ```

   Should show declarations of both methods plus the private `compute_enriched_call_graph`.

5. **MCP server-level flag**:

   ```
   grep -n "show_suppressed" packages/mcp/src/server.ts packages/mcp/src/start_server.ts
   ```

   Should show CLI parsing, env-var fallback, and the threading into the tool factory.

6. **Generated builtins import the canonical `detect_language`** (no inline copies):

   ```
   grep -l "function detect_language" packages/core/src/classify_entry_points/builtins/check_*.ts | wc -l
   ```

   Should print `0`. Each generated `check_*.ts` that needs the helper imports it from `../extract_entry_point_diagnostics`. Any future spec that requires `detect_language` produces an `import` line in the rendered output, not a duplicated function definition.

7. **The unindexed-test guard refuses misuse**:

   ```ts
   // Without `unindexed_test_grep: "applied"` and a registry that uses
   // `has_unindexed_test_caller`, this throws at the call site.
   enrich_call_graph(call_graph, project, { registry });
   ```

   Library callers should leave the option at its `"skipped"` default; `detect_entrypoints` does not call `enrich_call_graph` at all and so doesn't need the option. See `packages/core/src/classify_entry_points/enrich_call_graph.test.ts` ("refuses runs whose registry uses has_unindexed_test_caller…") for the regression coverage.
