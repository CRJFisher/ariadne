---
name: self-repair-pipeline
description: Runs the full entry point self-repair pipeline. Detects entry points in Ariadne packages or external codebases, triages false positives via per-entry investigators, and consolidates novel issues inline via a coordinator.
argument-hint: "[config-name | /path/to/repo | owner/repo (GitHub)]"
disable-model-invocation: true
allowed-tools: Bash(node --import tsx:*), Bash(ls:*), Read, Write, Glob, Task(triage-investigator, triage-coordinator)
---

# Self-Repair Pipeline

Triage pipeline for entry point analysis: detect false positives and classify root causes. Supports both self-analysis (Ariadne packages) and external codebase analysis.

Each invocation produces a self-contained run under `triage_state/<project>/runs/<run-id>/`. Run-id format is `<short-commit>-<iso-ts>` (e.g. `deadbee-2026-04-28T13-42-07.812Z`); `nogit-...` for non-git projects. Re-running at the same target commit reuses prior `confirmed_unreachable` verdicts via the TP cache (skip with `--no-reuse-tp`). A new commit on the target busts the cache: every entry re-investigates.

**Script invocation:** Always use `node --import tsx` to run scripts. Never use `pnpm exec tsx` or `npx tsx` — these create IPC Unix sockets that the sandbox blocks.

## Pipeline Overview

| Phase          | Script / Agent                         | Purpose                                                                                |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. Detect      | `scripts/detect_entrypoints.ts`        | Run entry point detection                                                              |
| 2. Prepare     | `scripts/prepare_triage.ts`            | Classify against the known-issues registry via `enrich_call_graph`, build triage state |
| 3. Triage Loop | triage-investigator, triage-coordinator | Investigate residual entries; coordinator dedupes novel issues inline on each absorb   |
| 4. Finalize    | `scripts/finalize_triage.ts`           | Publish the v4 triage-results JSON from `novel_issues.json`, classifier regressions, and per-entry verdicts |

## Analysis Target

**User input:** `$ARGUMENTS`

Before routing, extract any pipeline flags from the arguments:

| Flag              | Variable     | Default |
| ----------------- | ------------ | ------- |
| `--max-count <n>` | `$MAX_COUNT` | `150`   |

Strip extracted flags from the input before applying the routing table below.

Resolve the analysis target from the remaining input using this routing table:

| Input pattern                       | Example                                                  | Action                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Empty or blank                      | `/self-repair-pipeline`                                  | List available configs below, ask user what to analyze                                                                           |
| Config name                         | `core`, `mcp`, `types`, `projections`                    | Use `--config ~/.ariadne/self-repair-pipeline/project_configs/{name}.json`                                                       |
| Absolute or relative directory path | `/Users/chuck/workspace/some-repo`, `../other-repo`      | If a project config exists for this path, use `--config <config-path>`; otherwise follow **Creating a New Project Config** below |
| `owner/repo` or GitHub URL          | `anthropics/sdk-python`, `https://github.com/owner/repo` | Use `--github <value>`                                                                                                           |
| Natural language                    | "analyze the core package"                               | Interpret intent and map to one of the above                                                                                     |

### Creating a New Project Config

When the input is a directory path and a project config already exists for that path, skip this section and proceed to Phase 1 using `--config <path>`. Otherwise, follow these steps:

1. Resolve the path and verify it exists.
2. Run the folder preview to see what would be indexed:

   ```bash
   node --import tsx .claude/skills/self-repair-pipeline/scripts/preview_folders.ts \
     --path <abs_path>
   ```

3. Pick directories to exclude from indexing. Common candidates: vendored / third-party / generated trees, directories whose contents are not first-party source, or any single directory whose file count dominates the rest of the project. A high `file_count_recursive` with a low `file_count_direct` means the directory is a container for sub-packages, not a leaf vendor blob — do not exclude it on count alone.
4. Present the **full** preview list in your message text (relative path + `file_count_recursive` per line), with your pre-selected exclusions marked and a short reason for each pick. Then use AskUserQuestion with three options: "Accept these exclusions", "Modify — I'll describe changes in my reply", "Exclude nothing". If the user chooses Modify, read their follow-up message, apply the changes, and confirm the final list before continuing. The user's final answer is authoritative.
5. Propose a config with:
   - `project_path`: absolute path (required)
   - `folders`: relevant source directories (omit if analyzing everything)
   - `exclude`: the list the user confirmed in step 4
   - `project_name` is auto-derived for external projects via `path_to_project_id(project_path)` — do not include it in the config. Only internal projects (`project_path: "."`) require an explicit `project_name`.
6. Show the proposed config and ask for final confirmation.
7. Save to `~/.ariadne/self-repair-pipeline/project_configs/{name}.json`.
8. Continue the pipeline with `--config ~/.ariadne/self-repair-pipeline/project_configs/{name}.json`.

Available project configs:

| Config name   | Config path                                                        |
| ------------- | ------------------------------------------------------------------ |
| `core`        | `~/.ariadne/self-repair-pipeline/project_configs/core.json`        |
| `mcp`         | `~/.ariadne/self-repair-pipeline/project_configs/mcp.json`         |
| `types`       | `~/.ariadne/self-repair-pipeline/project_configs/types.json`       |
| `projections` | `~/.ariadne/self-repair-pipeline/project_configs/projections.json` |

If no arguments are provided or the input is ambiguous, **ask the user** before proceeding.

## Current State

!`node --import tsx .claude/skills/self-repair-pipeline/scripts/get_triage_summary.ts 2>/dev/null || echo "No active triage"`

## State and Output Locations

Scripts that operate on existing triage state take `--project <name>` (`prepare_triage` uses `--project` at creation time; `get_triage_summary` enumerates every project and takes no flags). Each pipeline invocation operates on exactly one project, and different projects can run in parallel against the same `triage_state/` dir — the project name is the isolation boundary.

| File                                                                | Purpose                                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `project_configs/{name}.json`                                       | Per-project detection config (folders, excludes)                                                                                                 |
| `triage_state/{project}/LATEST`                                     | Pointer to the active run-id; absent when no run is in progress                                                                                  |
| `triage_state/{project}/runs/{run-id}/manifest.json`                | Per-run metadata (status, commit_hash, tp_cache record)                                                                                          |
| `triage_state/{project}/runs/{run-id}/triage.json`                  | Per-run triage state (entries, per-entry results)                                                                                                |
| `triage_state/{project}/runs/{run-id}/results/{entry_index}.json`   | Per-entry investigator verdict files (one `TriageVerdict` JSON per entry)                                                                        |
| `triage_state/{project}/runs/{run-id}/novel_issues.json`            | Consolidated novel-issue registry for this run, written by the dispatcher's coordinator path                                                     |
| `triage_state/{project}/runs/{run-id}/classifier_regressions.jsonl` | Append-only log of `fp-classifier-regression` verdicts the investigator emitted; aggregated at finalize time                                     |
| `triage_state/{project}/runs/{run-id}/coordinator_log.jsonl`        | Append-only audit trail of every coordinator decision (merge / register / flag) keyed by entry_index                                             |
| `analysis_output/{project}/detect_entrypoints/{ts}.json`            | Detection output (kept project-scoped; one detection feeds many triage runs)                                                                     |
| `analysis_output/{project}/triage_results/{run-id}.json`            | Published triage results (schema v4: `novel_issues`, `classifier_regressions`, `confirmed_unreachable`, `uncertain`, with relative file paths) |

All paths above are relative to `~/.ariadne/self-repair-pipeline/`. Run-ids have the form `<short-commit>-<iso-ts>` (e.g. `deadbee-2026-04-28T13-42-07.812Z`); `nogit-<iso-ts>` when the target is not a git repo.

**Classifier registry write boundary**: this skill reads `known_issues/registry.json` but **never writes to it**. All registry mutations go through the triage-curator (`wip` lifecycle) and the fix-sequencer reconciler (`wip → fixed`). See `.claude/rules/classifier-lifecycle.md` for the canonical writer matrix.

Phase 3-4 scripts default to the run pointed at by `LATEST`; pass `--run-id <id>` to operate on a specific run. `prepare_triage` writes `LATEST` and `finalize_triage` clears it.

The dead-code whitelist at `known_entrypoints/<package>.json` (also under `~/.ariadne/self-repair-pipeline/`) is owned by the `detect_dead_code` Stop hook and is never read or written by this pipeline. See **Dead-code guardrail** below.

## Phase 1: Detect

Use the target resolved from the **Analysis Target** section above to construct the detect command.

```bash
# From project config (preferred for Ariadne packages)
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts \
  --config ~/.ariadne/self-repair-pipeline/project_configs/core.json

# Local repository
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts --path /path/to/repo

# GitHub repository
node --import tsx .claude/skills/self-repair-pipeline/scripts/detect_entrypoints.ts --github owner/repo
```

Options: `--config <file>`, `--path <dir>`, `--github <repo>`, `--branch <name>`, `--depth <n>`. Folder filters, exclusions, and test inclusion are declared in the project config file, not as CLI flags.

Tracked project configs for Ariadne packages: `~/.ariadne/self-repair-pipeline/project_configs/{core,mcp,types}.json`

Output: `analysis_output/<project>/detect_entrypoints/<timestamp>.json`

## Phase 2: Prepare

Build triage state from the latest analysis output:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/prepare_triage.ts \
  --analysis ~/.ariadne/self-repair-pipeline/analysis_output/<project>/detect_entrypoints/<timestamp>.json \
  --project <name> \
  [--max-count $MAX_COUNT]   # omit to use default of 150
```

Options:

- `--analysis <path>` (required)
- `--project <name>` (optional — falls back to the analysis file's `project_name`)
- `--max-count <n>` (optional, default `150`)
- `--no-reuse-tp` (optional) — disable the TP cache for this run; every `llm-triage` entry will re-investigate even if a prior run at the same commit confirmed it unreachable
- `--tp-source-run <run-id>` (optional) — pin a specific source run for the TP cache. Must be at the current HEAD commit; the script throws otherwise.

`--max-count` caps how many `llm-triage` entries are kept (and thus the total number of triage-investigator agents Phase 3 dispatches — distinct from the `N = 5` concurrency setting in Phase 3). The script keeps the top `<n>` residual entries by `tree_size`. Auto-classified entries are always kept in full and do not count toward this cap. Override the default for a smaller probe or larger sweep.

The script captures the target's HEAD short-commit, generates run-id `<short-commit>-<iso-ts>`, and creates `triage_state/<project>/runs/<run-id>/`. It partitions entries into three buckets:

- **known-unreachable (registry)**: A predicate classifier from `known_issues/registry.json` matched at or above its `min_confidence` — marked completed immediately with the matched `group_id`.
- **known-unreachable (previously-confirmed-tp)**: Reused from the most recent finalized run at the same commit. Skipped via `--no-reuse-tp`. Distinguished by `known_source: "previously-confirmed-tp"` and `tp_source_run_id`.
- **llm-triage**: No classifier matched — marked pending for investigation.

`prepare_triage` prints `{ "run_id": "...", "stats": { ... } }` to stdout. Capture the `run_id` if you need to pin Phase 3-4 to a specific run; otherwise the project's `LATEST` pointer makes that automatic.

Output: `triage_state/<project>/runs/<run-id>/triage.json` and `manifest.json`.

## Phase 3: Triage Loop

Run investigators as a **continuous worker pool**: keep `N` triage-investigator agents in flight at all times, launching a replacement the moment any one of them completes. This keeps concurrency close to `N` for the whole phase instead of averaging `N/2` as a batch loop would.

**Default concurrency:** `N = 5`.

Every script takes `--project <name>` — use the project captured in Phase 2. The main agent tracks in-flight indices locally and passes them via `--active` so the script never hands the same index to two workers.

**Crash recovery is automatic.** Entries stay `pending` until an investigator writes a result file, which the dispatcher absorbs on the next script call (transitioning the entry to `completed`). If an investigator crashes before writing a result, its entry remains `pending` and is redispensed naturally on a later call. The `--active` set tells the script which `pending` entries are currently assigned to live workers so they are skipped when picking replacements.

### Step 1: Initial fill

Run once to pick up to `N` pending entries:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/get_next_triage_entry.ts \
  --project <name> --count 5
```

Output: `{ "entries": [N, ...] }`. If the script exits non-zero, stop and report stderr to the user. If `entries` is empty, skip to Phase 4.

Launch one **triage-investigator** agent per returned index in a **single message with multiple Agent calls** (parallel), all `run_in_background: true`. Prompt each with:

```
project: <name>
entry_index: N
```

The triage-investigator runs `get_entry_context.ts --project <name> --entry <index>` itself to fetch the full investigation context (entry + in-scope registry slice + current `novel_issues.json` snapshot) and writes its verdict to `results/{entry_index}.json`.

Track the set of in-flight entry indices locally — it seeds `--active` on the next call.

### Step 2: Steady-state worker pool

Whenever any background investigator completes, remove its entry index from the in-flight set, then run the script once with the remaining in-flight indices:

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/get_next_triage_entry.ts \
  --project <name> --active 7,12,18,23
```

- If `entries` has one index, launch one replacement `triage-investigator` agent (`run_in_background: true`) for that index and add it to the in-flight set.
- If `entries` is empty and the in-flight set is empty, proceed to Phase 4.
- If `entries` is empty but the in-flight set is non-empty, wait for the next completion and call the script again.

Call the script **sequentially** (not in parallel) for replacements — each call needs a fresh absorb pass to see the just-completed entry before picking the next pending one. Pass an empty `--active` (omit the flag) if every worker has finished and you're doing a final drain check.

### Verdict schema

Each `results/{entry_index}.json` is a strict `TriageVerdict` discriminated union. The dispatcher re-parses every file via `parse_triage_verdict`; malformed shapes halt the absorb path with an explicit error.

| `kind`                        | Required payload                                                            | Absorbed by dispatcher to …                                            |
| ----------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `tp`                          | `member_evidence`                                                           | nothing (in-memory only; surfaced at finalize)                         |
| `fp-novel-new`                | `proposed_root_cause`, `evidence_excerpt`, `member_evidence`                | `triage-coordinator` → register / merge / flag → `novel_issues.json`   |
| `fp-novel-cited`              | `novel_issue_id`, `evidence_excerpt`                                        | `triage-coordinator` → citation / flag → `novel_issues.json`           |
| `fp-classifier-regression`    | `should_have_matched_rule_id`, `evidence_excerpt`, `member_evidence`        | append one record to `classifier_regressions.jsonl`                    |
| `uncertain`                   | `reason`, `member_evidence`                                                 | nothing (in-memory only; surfaced at finalize for human review)        |

The dispatcher serializes absorbs per file via a process-local mutex, and every persistent write goes through `atomic_write_file` (temp+rename). Replay is safe: re-absorbing the same entry_index is a no-op because the novel-issues registry indexes existing citations by `entry_index`.

### Coordinator path

`fp-novel-new` and `fp-novel-cited` verdicts route through a `triage-coordinator` sub-agent synchronously before the next dispense. The coordinator sees the run's current `novel_issues.json` snapshot plus the just-absorbed proposal and emits one of:

- `merge_into: <existing_id>` — proposal duplicates an existing issue under a different name; the dispatcher records it as a citation.
- `register_new: { canonical_name, root_cause }` — proposal is genuinely new; the dispatcher assigns an id (slugified canonical_name with numeric suffix on collision) and writes the issue.
- `flag: { reason }` — proposal is ambiguous; the dispatcher records it under `flagged[]` for human review at curator promotion time.

Every coordinator decision is appended to `coordinator_log.jsonl` *before* the registry write, so a crash between the two leaves the audit trail intact and the replay guard short-circuits re-absorbs cleanly.

`tp`, `fp-classifier-regression`, and `uncertain` verdicts are absorbed directly without a coordinator call.

### `novel_issues.json` lifecycle

Per-run, the dispatcher is the **single writer** of `novel_issues.json`. Each issue is `{ id, canonical_name, root_cause, citations: [{ entry_index, evidence_excerpt }] }`. The file is read into every dispense payload so investigators can early-exit with `fp-novel-cited` when they recognize a match — saving an entire round-trip's worth of source reads and MCP calls. The file is never mutated by sub-agents directly; the `triage-investigator` and `triage-coordinator` agent specs forbid writes via tool-grant allowlists.

`novel_issues.json` is also the canonical source of the published `novel_issues[]` slice at finalize time — Phase 4 reads it verbatim.

## Phase 4: Finalize

Run after Phase 3 sets `phase = "complete"`.

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/finalize_triage.ts \
  --project <name>
```

Finalization reads three per-run sources and publishes the v4 `triage_results/<run-id>.json`:

| Source                                          | Drives                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `novel_issues.json` (issues + flagged verdicts) | `novel_issues[]`, `flagged_novel_verdicts[]`                                            |
| `classifier_regressions.jsonl`                  | `classifier_regressions[]` (records aggregated by `should_have_matched_rule_id`)        |
| `results/<entry_index>.json` + `triage.json`    | `confirmed_unreachable[]` (auto-classified + TP cache + `kind: "tp"`), `uncertain[]`    |

Each `confirmed_unreachable` row carries the identifiers needed for the cross-run TP cache (`name`, `file_path` relative to `project_path`, `kind`, `start_line`, optional `signature`) plus `source` (`"llm-tp"` for LLM-confirmed entries, `"registry:<group_id>"` for predicate hits, `"previously-confirmed-tp"` for TP-cache reuse) and the verdict's `member_evidence` when one exists. `uncertain` rows carry the same identifiers plus the verdict's `reason` and `member_evidence`.

Finalization also:

- Sets `manifest.status = "finalized"`, `finalized_at = now`.
- Clears the project's `LATEST` pointer.

The run directory is preserved for diffing and audit. Use `prune_runs.ts` to garbage-collect old run dirs (the published `triage_results/<run-id>.json` is kept forever — `diff_runs` and the curator depend on it).

## Reusing Prior TP Verdicts

When you re-run the pipeline at the same target HEAD commit, `prepare_triage` reuses entries that the most recent finalized run classified as `confirmed_unreachable` — they skip Phase 3 and ship straight to the new run's `confirmed_unreachable[]` with `known_source: "previously-confirmed-tp"` and a `tp_source_run_id` that records the source.

The cache validity gate is **the run-id's `<short-commit>-` prefix**:

- Same prefix → cache reuses prior TP verdicts.
- Different prefix (any commit on the target) → cache misses; every entry re-investigates.

Two known leaks (accepted; document for users):

- **Uncommitted target-repo changes don't bust the cache.** HEAD is the only signal. To force a clean pass after a dirty edit, either `git commit` first or pass `--no-reuse-tp`.
- **Ariadne core changes don't bust the cache.** If you tighten Ariadne's call resolution and want to validate that prior TPs still hold, run once with `--no-reuse-tp`.

`--tp-source-run <run-id>` pins a specific source (must be at the current commit).

## Comparing Runs

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/diff_runs.ts \
  --project <name> --from <run-id> --to <run-id> [--format text|json]
```

Output highlights TP↔FP flips (regression candidates), entries that appeared/disappeared, group-id changes, and group membership deltas. Reads the published `triage_results/<run-id>.json` files; works even when the underlying run dirs have been pruned.

## Run Retention

```bash
node --import tsx .claude/skills/self-repair-pipeline/scripts/prune_runs.ts \
  --project <name> [--keep <n>] [--dry-run]
```

Default keep-count is `5` (override with `--keep` or `ARIADNE_RETAIN_RUNS`). Runs whose run-id is referenced by another run's `tp_cache.source_run_id` are protected. Active and abandoned runs are never pruned. Published `triage_results/<run-id>.json` files are kept forever.

`list_runs.ts --project <name> [--status active|finalized|abandoned] [--last <n>]` enumerates the run history with status (JSON to stdout). `abandon_run.ts --project <name> [--run-id <id>]` marks a run abandoned and clears `LATEST` if it pointed there.

## Typical Iteration Loop

The user's iteration cycle when tuning the classifier registry or Ariadne core resolution against a fixed target commit:

```bash
# 1. Detect once (entry-point set is stable for a given target HEAD)
node --import tsx scripts/detect_entrypoints.ts --config <config> > /dev/null
# capture the analysis JSON path (or use Glob to find it)

# 2. Initial run
node --import tsx scripts/prepare_triage.ts --analysis <analysis.json> --project <name>
#   ... walk through Phase 3-4 ...

# 3. Edit registry / Ariadne core. (No commit needed; the cache gates on target HEAD.)

# 4. Re-run at the same commit. Cache reuses prior TPs; LLM re-investigates only the residual.
node --import tsx scripts/prepare_triage.ts --analysis <analysis.json> --project <name>
#   ... walk through Phase 3-4 again ...

# 5. Diff to spot regressions
node --import tsx scripts/diff_runs.ts --project <name> --from <run-1> --to <run-2>
```

Two known leaks during this loop (escape hatch: `--no-reuse-tp`):

- **Uncommitted target-repo edits** don't bust the cache (`git commit` first, or pass `--no-reuse-tp`).
- **Ariadne core changes** don't bust it either (run once with `--no-reuse-tp` after substantive resolution improvements).

## Migrating from a Pre-Run-Namespaced Pipeline

If you upgraded from a version that wrote `triage_state/<project>/<project>_triage.json` directly:

```bash
# Wrap the legacy state into runs/legacy-<ts>/ with status=abandoned (default)
node --import tsx scripts/migrate_legacy_state.ts --project <name>

# OR: delete the legacy artifacts
node --import tsx scripts/migrate_legacy_state.ts --project <name> --purge
```

`prepare_triage` emits a one-line stderr warning when it detects unmigrated legacy state.

## Persisted-State Preservation Policy

The pipeline writes three kinds of persisted state under `~/.ariadne/self-repair-pipeline/`. Each has a different preservation contract — wiping the wrong one silently destroys cross-run TP reuse.

| State                                                                      | Status               | Action on upgrade                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analysis_output/<project>/triage_results/`                                | **Preserve**         | Never `rm -rf`. These finalized triage-results JSON files are the permanent source of truth for the TP cache (read by `confirmed_unreachable_reuse.derive_tp_cache` via `triage_results_store.most_recent_finalized_triage_results`). Wiping them forces every prior-confirmed entry back through the LLM investigator. |
| `triage_state/<project>/runs/`                                             | **Preserve**         | Active and abandoned runs never auto-prune. `prune_runs.ts` keeps the last `--keep <n>` finalized runs and protects any run referenced as another run's `tp_cache.source_run_id`.                                                                                                                                       |
| `triage_state/<project>/<project>_triage.json` (legacy single-file layout) | **Migrate**          | Run `migrate_legacy_state.ts --project <name>` to wrap into `runs/legacy-<ts>/` (default `status=abandoned`), or `--purge` to drop history.                                                                                                                                                                             |
| `~/.ariadne/cache/<slug>/manifest.json` (core's persistence cache)         | **Auto-invalidates** | The cache schema version is checked on load; mismatched manifests are dropped via `deserialize_manifest` and the cache rebuilds on next run. No user action required.                                                                                                                                                   |

**Stale-LATEST handling.** If a `LATEST` pointer remains from an in-flight run at upgrade time, clear it via `abandon_run.ts --project <name>` or by deleting the file. The run dir stays visible to `list_runs.ts`. `abandon_run.ts` also marks the manifest abandoned.

**Published schema:** `FINALIZATION_OUTPUT_SCHEMA_VERSION` is `4`. Readers (`triage_results_store`, `confirmed_unreachable_reuse`, `diff_runs`, the curator) hard-reject any `triage_results/<run-id>.json` whose `schema_version` does not match — there are no migration shims. Pre-v4 files age out naturally as new runs land; the persisted-state policy still forbids `rm -rf` of the whole `analysis_output/` tree.

## Dead-code guardrail

Orthogonal to the self-repair pipeline. The `detect_dead_code` Stop hook (`.claude/hooks/detect_dead_code.ts`, registered in `.claude/settings.json`) runs Ariadne against git-modified packages after each Claude Code session and cross-checks flagged entry points against a per-package whitelist at `~/.ariadne/self-repair-pipeline/known_entrypoints/<package>.json`. Exported-but-uncalled entry points not on the whitelist block the session.

The whitelist is **human-owned**. Add a legitimate entry point by editing the package's JSON file and committing:

```json
[
  {
    "source": "project",
    "description": "Confirmed legitimate entry points",
    "entrypoints": [
      { "name": "handle_request", "file_path": "src/handlers.ts" }
    ]
  }
]
```

The self-repair pipeline does not read or write this whitelist. If you previously ran the pipeline under an older version that auto-appended `confirmed-unreachable` entries, audit each `known_entrypoints/<package>.json` once and delete any entries you do not actually want gated as legitimate entry points.

## Architecture: Key Modules

The skill is a thin caller of `@ariadnejs/core`. Classification (`enrich_call_graph`, `extract_entry_point_diagnostics`, the predicate evaluator, builtins, and the bundled permanent registry slice) lives in `packages/core/src/classify_entry_points/`. Entry-point and known-issues types live in `@ariadnejs/types`. The skill modules under `src/` orchestrate the run lifecycle on top of that core API.

| Module                                | Purpose                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `known_issues_registry.ts`            | Full-registry loader (skill-side) — reads the canonical `known_issues/registry.json`, including `wip` rules, and hands it to `enrich_call_graph` as a registry override |
| `prepare_triage.ts`                   | Run-namespaced orchestration: call core's `enrich_call_graph` with the full registry, partition into known-unreachable / TP-cache / llm-triage                          |
| `build_triage_entries.ts`             | Assemble `TriageEntry` records from prepared buckets                                                                                                                    |
| `build_finalization_output.ts`        | Build the published v4 envelope from per-run sources; loads per-entry verdict files via `parse_triage_verdict`                                                          |
| `merge_results.ts`                    | Merge investigator result files into triage state                                                                                                                       |
| `triage_verdict.ts`                   | `TriageVerdict` discriminated union + strict runtime parser                                                                                                             |
| `novel_issues.ts`                     | Per-run `novel_issues.json` schema, reader, atomic writer, and pure-function mutators (register / cite / flag)                                                          |
| `absorb_verdict.ts`                   | Dispatcher absorb path: routes each verdict, persists writes (atomic + per-path mutex), serializes coordinator calls                                                    |
| `coordinator/`                        | Sub-modules for the `triage-coordinator` agent: prompt rendering, decision parser, apply-decision mutator, log appender                                                 |
| `classifier_regressions.ts`           | Per-run `classifier_regressions.jsonl` appender + finalize-time aggregator                                                                                              |
| `dispense_payload.ts`                 | Build the per-entry dispense payload (entry context + in-scope registry slice + novel-issues snapshot)                                                                  |
| `triage_state_types.ts`               | Triage state types (`TriageState`, `TriageEntry`, `TriageEntryResult`)                                                                                                  |
| `triage_state_paths.ts`               | Triage state file locations + required-flag CLI helpers                                                                                                                 |
| `confirmed_unreachable_reuse.ts`      | TP cache derivation — short-circuits the LLM investigator across runs at the same commit                                                                                |
| `run_discovery.ts`                    | Run-id enumeration, manifest reading, prune protection                                                                                                                  |
| `analysis_output.ts`                  | Timestamped analysis output JSON I/O                                                                                                                                    |
| `project_id.ts`                       | Project-identifier derivation (`path_to_project_id`, `project_id_from_config`)                                                                                          |
| `guard_tsx_invocation.ts`             | Enforce `node --import tsx` invocation (sandbox-compatible)                                                                                                             |

## Reference

- [Diagnosis Routes: Routing Table and Classification Guide](reference/diagnosis_routes.md)

## Sub-Agents

| Agent               | Model  | Purpose                                                                                                          |
| ------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| triage-investigator | sonnet | Investigate a single residual entry; emit one `TriageVerdict` (tp / fp-novel-new / fp-novel-cited / fp-classifier-regression / uncertain) |
| triage-coordinator  | sonnet | Sense-check each novel verdict against the run's current `novel_issues.json`; decide merge / register / flag      |
