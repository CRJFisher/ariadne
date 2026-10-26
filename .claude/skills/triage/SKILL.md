---
name: triage
description: Triage stage for entry-point candidates. Detects entry points in Ariadne packages or external codebases and triages false positives via per-entry investigators, publishing each false positive raw and self-contained.
argument-hint: "[config-name | /path/to/repo | owner/repo (GitHub)]"
disable-model-invocation: true
allowed-tools: Bash(bash .claude/skills/triage/scripts/ensure_environment.sh), Bash(node --import tsx:*), Read, Write, Glob
---

# Triage Entrypoints

Triage pipeline for entry point analysis: detect false positives and classify root causes. Supports both self-analysis (Ariadne packages) and external codebase analysis.

**This pipeline runs headlessly, end to end, in a single turn.** Every phase — config creation, file-count checks, investigating, finalizing — proceeds on sensible defaults without pausing for confirmation. Never call `AskUserQuestion` anywhere in this skill; it is not in this skill's `allowed-tools`. When a step below says "ask" or "confirm," that describes an interactive fallback this skill does not use — resolve it autonomously instead, per the guidance at that step, and log the decision in your reply text rather than pausing for input.

Each invocation produces a self-contained run under `triage_state/<project>/runs/<run-id>/`. Run-id format is `<short-commit>-<iso-ts>` (e.g. `deadbee-2026-04-28T13-42-07.812Z`); `nogit-...` for non-git projects. Re-running at the same target commit reuses prior `confirmed_unreachable` verdicts via the TP cache (skip with `--no-reuse-tp`). Moving the target to a new commit (`--commit <sha>`, see **Phase 1**) busts the cache: every entry re-investigates.

**Script invocation:** Always use `node --import tsx` to run the TypeScript scripts. Never use `pnpm exec tsx` or `npx tsx` — these create IPC Unix sockets that the sandbox blocks.

## Pipeline Overview

| Phase                         | Script                                | Purpose                                                                                                    |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0. Environment                | `scripts/ensure_environment.sh`       | Install dependencies and build the workspace packages the scripts import, where needed                     |
| 1. Detect                     | `scripts/detect_entrypoints.ts`       | Run entry point detection                                                                                  |
| 2. Prepare                    | `scripts/prepare_triage.ts`           | Classify against the known-issues registry via `enrich_call_graph`, build triage state                     |
| 3–4. Investigate and finalize | `scripts/investigate_and_finalize.ts` | Investigate every residual entry (one verdict each in `results/`), then publish the v5 triage-results JSON |

Phases 3 and 4 are one deterministic script: no agent dispatches or coordinates investigations. The skill agent's own judgement is needed only for authoring a new project config.

## Phase 0: Environment

Run this first, before any other script in this skill — the folder preview included:

```bash
bash .claude/skills/triage/scripts/ensure_environment.sh
```

The pipeline runs the Ariadne in the checkout this skill lives in. The script installs that checkout's dependencies when `tsx` or any of the skill's `@ariadnejs/*` workspace links is missing — the state of a fresh git worktree — and builds those workspace packages when any has no `dist/` or has source newer than its build. A ready checkout is left untouched and prints `environment: ready`; otherwise it prints what it installed and built. Concurrent triages in one checkout wait on each other here rather than building into the same tree.

If it exits non-zero, report its stderr and stop: every later script imports the packages it could not prepare.

## Analysis Target

**User input:** `$ARGUMENTS`

Before routing, extract any pipeline flags from the arguments:

| Flag              | Variable     | Default |
| ----------------- | ------------ | ------- |
| `--max-count <n>` | `$MAX_COUNT` | `250`   |
| `--commit <sha>`  | `$COMMIT`    | unset   |

Strip extracted flags from the input before applying the routing table below. `$COMMIT` is the full sha Phase 1 puts a `repos/` clone at; unset, the clone goes to the commit of the project's newest run, or to upstream HEAD for a project with no run on record.

Resolve the analysis target from the remaining input using this routing table:

| Input pattern                       | Example                                                  | Action                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Empty or blank                      | `/triage`                                                | Stop and print an error naming a target (path, `owner/repo`, or saved config name) — do not guess and do not ask                 |
| Config name                         | a name with a saved config                               | Use `--config ~/.ariadne/triage-entrypoints/project_configs/{name}.json`                                                         |
| Absolute or relative directory path | `/Users/chuck/workspace/some-repo`, `../other-repo`      | If a project config exists for this path, use `--config <config-path>`; otherwise follow **Creating a New Project Config** below |
| `owner/repo` or GitHub URL          | `anthropics/sdk-python`, `https://github.com/owner/repo` | Use `--github <value>`                                                                                                           |
| Natural language                    | "analyze the core package"                               | Interpret intent and map to one of the above                                                                                     |

A config whose `project_path` is a clone under `~/.ariadne/triage-entrypoints/repos/` names a corpus Phase 1 creates or moves itself, so that directory need not exist before the pipeline starts.

### Creating a New Project Config

When the input is a directory path and a project config already exists for that path, skip this section and proceed to Phase 1 using `--config <path>`. Otherwise, follow these steps:

1. Resolve the path and verify it exists.
2. Run the folder preview to see what would be indexed:

   ```bash
   node --import tsx .claude/skills/triage/scripts/preview_folders.ts \
     --path <abs_path>
   ```

3. Pick directories to exclude from indexing, with the goal of keeping the total indexed file count at **≤ ~4,000 files**. Common candidates: vendored / third-party / generated trees, directories whose contents are not first-party source, or any single directory whose file count dominates the rest of the project. **Never exclude a test directory.** `exclude` is a corpus exclusion — it deletes every call edge those files hold, so their callees surface as false entry points — while `include_tests: false` already suppresses test callables as candidates. Detection warns at startup when an `exclude` entry names a test tree. A high `file_count_recursive` with a low `file_count_direct` means the directory is a container for sub-packages, not a leaf vendor blob — do not exclude it on count alone.

   Estimate the post-exclusion count: subtract the `file_count_recursive` of each directory you plan to exclude from `total_source_files`. The **Pre-flight: File Count Check** below owns the ~4,000-file threshold and the action when a project exceeds it.

4. Decide the exclusion list yourself from the criteria in step 3 and apply it — no confirmation step. State the **full** preview list in your reply text (relative path + `file_count_recursive` per line) with the excluded directories marked and a short reason for each, purely as a record of the decision.
5. Build a config with:
   - `project_path`: absolute path (required)
   - `folders`: relevant source directories (omit if analyzing everything)
   - `exclude`: the list decided in step 4
   - `include_tests`: optional, default `false`. Admits test callables as entry-point _candidates_; it never changes which files are indexed.
   - `max_files`: optional, default 20,000. Detection refuses a corpus larger than this rather than indexing part of one.
   - `project_name` is auto-derived for external projects — a `repos/<owner>--<repo>` clone takes that slug, any other directory `path_to_project_id(project_path)` — do not include it in the config. Only internal projects (`project_path: "."`) require an explicit `project_name`.
6. Save it directly to `~/.ariadne/triage-entrypoints/project_configs/{name}.json` — state the saved config in your reply text as a record, not a request for approval.
7. Continue the pipeline with `--config ~/.ariadne/triage-entrypoints/project_configs/{name}.json`.

No project configs ship pre-authored — author one with the steps above. A saved config lives at `~/.ariadne/triage-entrypoints/project_configs/<name>.json` and is passed to every phase via `--config <path>`. The file is a JSON object with `project_path` (required; a `repos/<owner>--<repo>` clone is created on demand), optional `folders` (source directories to index), optional `exclude` (directories to skip), optional `include_tests` (default `false`; a candidate-side gate that never changes the corpus), optional `max_files` (default 20,000; detection refuses a larger corpus), and `project_name` (only for internal `project_path: "."` projects). Pass the same `--config` to every phase: `prepare_triage` re-indexes, and without it that phase indexes a different corpus than detection analysed.

If no arguments are provided or the input is ambiguous, stop and print an error describing what is missing — do not ask the user and do not guess a target.

## State and Output Locations

Scripts that operate on existing triage state take `--project <name>` (`prepare_triage` uses `--project` at creation time; `get_triage_summary` enumerates every project and takes no flags). Each pipeline invocation operates on exactly one project, and different projects can run in parallel against the same `triage_state/` dir — the project name is the isolation boundary.

The name is derived from the target: a GitHub target takes its owner-qualified slug (`vuejs/core` → `vuejs--core`), a directory target its resolved path, and a saved config the same rule applied to its `project_path` — the slug when that path is a `repos/` clone, the resolved path otherwise. Both halves of a slug are load-bearing — `vuejs/core` and `home-assistant/core` are unrelated codebases, and a shared name would merge their run histories behind one LATEST pointer.

A project runs **one triage at a time**. `prepare_triage` refuses while another run for the project is `status: "active"`, naming each live run, the commit it was prepared at, and both remedies: continue it by passing its id to `investigate_and_finalize.ts`, or `abandon_run.ts` to discard it. To triage two targets concurrently, give them distinct `--project` names.

The refusal is a fail-loud check, not a lock. It reads the run set before the re-index and again immediately before claiming the run, which leaves a narrow window where two launches started at the same moment both pass. Every later call names the run by its `--run-id`, so a fork that slips through that window investigates only its own run.

| File                                                              | Purpose                                                                                                                                            |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project_configs/{name}.json`                                     | Per-project detection config (folders, excludes)                                                                                                   |
| `triage_state/{project}/LATEST`                                   | Convenience pointer to the current run-id, written by `prepare_triage` and cleared when the run finalizes; run liveness lives in `manifest.status` |
| `triage_state/{project}/runs/{run-id}/manifest.json`              | Per-run metadata (status, commit_hash, tp_cache record)                                                                                            |
| `triage_state/{project}/runs/{run-id}/triage.json`                | Per-run triage state (entries, per-entry results)                                                                                                  |
| `triage_state/{project}/runs/{run-id}/results/{entry_index}.json` | Per-entry investigator verdict files (one `TriageVerdict` JSON per entry)                                                                          |
| `analysis_output/{project}/detect_entrypoints/{ts}.json`          | Detection output (kept project-scoped; one detection feeds many triage runs)                                                                       |
| `analysis_output/{project}/triage_results/{run-id}.json`          | Published triage results (schema v5: `novel_issues`, `classifier_regressions`, `confirmed_unreachable`, `uncertain`, with relative file paths)     |

All paths above are relative to `~/.ariadne/triage-entrypoints/`. Run-ids have the form `<short-commit>-<iso-ts>` (e.g. `deadbee-2026-04-28T13-42-07.812Z`); `nogit-<iso-ts>` when the target is not a git repo.

**Classifier registry write boundary**: this skill reads `known_issues/registry.json` but **never writes to it**. The registry is human-maintained — every status transition (`wip`, `permanent`, `fixed`) is a human decision through `atomic_update_registry`, applied via the `reconcile-registry` skill (`.claude/skills/reconcile-registry/SKILL.md`), which reads this skill's published `classifier_regressions[]` and the repo's git log to propose the mechanical flips. See `.claude/rules/classifier-lifecycle.md` for the canonical writer matrix.

Every run-scoped script takes `--run-id <id>`; this pipeline passes the run-id Phase 2 prints to every later call. Omitted, a script resolves the project's `LATEST` pointer, which `prepare_triage` writes and finalizing clears.

The dead-code whitelist at `known_entrypoints/<package>.json` (also under `~/.ariadne/triage-entrypoints/`) is owned by the `detect_dead_code` Stop hook and is never read or written by this pipeline. See **Dead-code guardrail** below.

## Pre-flight: File Count Check

Before running detection, verify the project's effective file count is within acceptable limits. This applies whether you are using an existing config or a newly created one.

For a **new config**, the exclusion selection in **Creating a New Project Config** already produced an estimate. Confirm it is ≤ ~4,000 files.

For an **existing config**, re-run the folder preview against the config's `project_path` and subtract the `file_count_recursive` of each directory listed in `exclude`:

```bash
node --import tsx .claude/skills/triage/scripts/preview_folders.ts \
  --path <project_path>
```

If the estimated post-exclusion count exceeds ~4,000 files, note it in your reply text as a record — indexing at that scale takes significantly longer than a typical run — and proceed into Phase 1 regardless. Do not pause for confirmation; revise the config's `exclude` list yourself only if a further reduction is clearly warranted by the criteria in **Creating a New Project Config** step 3.

When the config names a `repos/` clone that is not on disk yet, skip the preview: Phase 1 creates the clone at the run commit, and the config's `exclude` list was decided when it was authored.

## Phase 1: Detect

Use the target resolved from the **Analysis Target** section above to construct the detect command.

```bash
# From a project config (preferred when one has been authored); add --commit $COMMIT when set
node --import tsx .claude/skills/triage/scripts/detect_entrypoints.ts \
  --config ~/.ariadne/triage-entrypoints/project_configs/<name>.json

# Local repository
node --import tsx .claude/skills/triage/scripts/detect_entrypoints.ts --path /path/to/repo

# GitHub repository; add --commit $COMMIT when set
node --import tsx .claude/skills/triage/scripts/detect_entrypoints.ts --github owner/repo
```

Options: `--config <file>`, `--path <dir>`, `--github <repo>`, `--commit <sha>`, `--depth <n>`. Folder filters, exclusions, and test inclusion are declared in the project config file, not as CLI flags.

**Corpus commit.** A GitHub target, and a config whose `project_path` is under `~/.ariadne/triage-entrypoints/repos/`, is a clone detection owns. Before indexing, the clone is put at one commit: `$COMMIT` when set, else the commit of the project's newest run (`triage_state/<project>/runs/<run-id>/manifest.json` → `commit_hash`), else upstream HEAD for a project with no run on record. A clone already at that commit is left untouched; one at another commit has the sha fetched and checked out. Detection exits non-zero and writes no dump when the commit cannot be reached — report its error and stop. To triage a target at its current upstream tip after earlier runs, name the tip: `git ls-remote https://github.com/<owner>/<repo> HEAD | cut -f1`. A `--path` target, or a config naming a directory outside `repos/`, is the user's own working tree and is analysed as it stands; `--commit` is refused for it.

Author a config with **Creating a New Project Config** above; it lives at `~/.ariadne/triage-entrypoints/project_configs/<name>.json`.

Output: `analysis_output/<project>/detect_entrypoints/<timestamp>.json`

## Phase 2: Prepare

Build triage state from the latest analysis output. Use `$MAX_COUNT` (250 unless the user's arguments set `--max-count`) without checking in — proceed straight through Phase 3 over however many `llm-triage` entries that produces, however large. Do not ask whether to run the full count or a smaller sample.

```bash
node --import tsx .claude/skills/triage/scripts/prepare_triage.ts \
  --analysis ~/.ariadne/triage-entrypoints/analysis_output/<project>/detect_entrypoints/<timestamp>.json \
  --project <name> \
  [--max-count $MAX_COUNT]   # omit to use default of 250
```

Options:

- `--analysis <path>` (required)
- `--project <name>` (optional — falls back to the analysis file's `project_name`)
- `--config <path>` (optional) — the project config whose `folders`/`exclude` scope re-indexing. Omitting it re-indexes the full tree, a different classification input than detect saw; pass the same config used in Phase 1.
- `--max-count <n>` (optional, default `250`)
- `--no-reuse-tp` (optional) — disable the TP cache for this run; every `llm-triage` entry will re-investigate even if a prior run at the same commit confirmed it unreachable
- `--tp-source-run <run-id>` (optional) — pin a specific source run for the TP cache. Must be at the current HEAD commit; the script throws otherwise.

`--max-count` caps how many `llm-triage` entries are kept, and thus how many entries Phase 3 investigates. The script keeps the top `<n>` residual entries by `tree_size`. Auto-classified entries are always kept in full and do not count toward this cap. Override the default for a smaller probe or larger sweep.

The script captures the target's HEAD short-commit, generates run-id `<short-commit>-<iso-ts>`, and creates `triage_state/<project>/runs/<run-id>/`. It partitions entries into three buckets:

- **known-unreachable (registry)**: A builtin classifier from `known_issues/registry.json` matched at or above its `min_confidence` — marked completed immediately with the matched `group_id`.
- **known-unreachable (previously-confirmed-tp)**: Reused from prior finalized runs at the same commit (accumulated across all runs, newest first). Skipped via `--no-reuse-tp`. Distinguished by `known_source: "previously-confirmed-tp"` and `tp_source_run_id`.
- **llm-triage**: No classifier matched — marked pending for investigation.

`prepare_triage` prints `{ "run_id": "...", "stats": { ... } }` to stdout. **Capture the `run_id`; Phase 3 passes it as `--run-id <run-id>`.**

If `prepare_triage` exits non-zero reporting that the project already has an active run, report its message to the user verbatim and stop. Choosing between continuing that run and abandoning it is theirs to make — it turns on whether the run's commit is still the one they care about.

Output: `triage_state/<project>/runs/<run-id>/triage.json` and `manifest.json`.

## Phase 3: Investigate and Finalize

Run after Phase 2, with the `run_id` it printed:

```bash
node --import tsx .claude/skills/triage/scripts/investigate_and_finalize.ts \
  --project <name> --run-id <run-id>
```

Run it through Bash with `timeout: 600000` and the network access the Anthropic API needs (`api.anthropic.com`): each investigation is an Agent SDK call. One call stops starting investigations after `--time-budget-s` (default 420) and aborts any still running two minutes later, so it always returns inside the 10-minute shell limit.

It prints one JSON summary. Act on its `status`:

| `status`    | Meaning                                                                                          | Next step                                                   |
| ----------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `finalized` | Every entry has a verdict or a recorded failure, and `triage_results/<run-id>.json` is published | Report the summary and stop                                 |
| `continue`  | The time budget ran out with entries still pending                                               | Run the same command again; repeat until `finalized`        |
| `stopped`   | The `--max-usd` cap, or an account error (spend limit, rate limit, auth), halted dispatch        | Report `stopped` verbatim and stop; the run stays resumable |

Options: `--concurrency <n>` (default 8), `--max-usd <n>` (no cap by default), `--time-budget-s <n>`.

Emit no interim status report while the calls repeat; the pipeline produces exactly one terminal report after the run is finalized. Reserve a `failed` report for a genuine crash or a `stopped` status.

### What one call does

1. **Claims** every entry still to investigate: it absorbs any verdict files already in `results/`, and resets a `failed` entry with retry budget left (a malformed verdict file) to `pending`.
2. **Investigates** them in a continuous pool of `--concurrency` investigations with no batch barrier: a freed slot refills at once. The pool starts one lead investigation and releases the other slots when the lead's first response arrives, so the shared prompt prefix is written to cache once and read by every later investigation.
3. **Writes** each verdict to `results/<entry_index>.json`. An investigation that ends without a verdict is retried once; an entry whose second attempt also ends without one is recorded `failed` and counted in the published results.
4. **Records** every investigation's usage in `runs/<run-id>/investigations.json`: USD, turns, input, output and cache tokens, and the first turn's cache read and write. The summary reports the run's spend and its `prefix_miss` count: investigations that started into a warm cache yet read under 90% of the shared prefix. A nonzero `prefix_miss` means something broke the cached prefix.
5. **Finalizes** the run once nothing is left to investigate (the Phase 4 table below).

**Crash recovery is automatic.** An entry stays `pending` until its verdict file is written, so an investigation cut short by a crash, the time budget, or a `stopped` status is picked up by the next call. Run one call at a time per run: a call claims every pending entry up front.

### The investigation

Each investigation is an Agent SDK `query()` on the pinned investigator model (`src/investigate/investigator_model.ts`). Its prompt is:

- **System prompt:** one constant string (`src/investigate/investigator_system_prompt.ts`) holding the verdict definitions, the meaning of each evidence list, the tool rules, the output contract, and every diagnosis route's guide. It names no entry, so every investigation shares it from the prompt cache.
- **First user message:** the entry's bounded context (`src/dispense/render_entry_context.ts`), the same text `get_entry_context.ts` prints: the entry, its pre-gathered evidence, its sub-threshold classifier hints, and the in-scope classifier rules one line each. Each evidence list shows at most 40 rows and names how many it left out, with a grep pattern that lists them. Paths are relative to the project root.

It has three tools, served in-process (`src/investigate/investigation_tools.ts`): `read` (at most 200 lines per call), `grep` (at most 100 matches), and `submit_verdict`, which validates the verdict against the strict `TriageVerdict` shape, checks that `member_evidence` names a real line of the repository and that a regression cites an in-scope rule, and rejects anything else with the reason. `read` and `grep` resolve every path inside the project root and refuse anything outside it. The investigation loads no Claude Code preset, settings, CLAUDE.md, hooks or other MCP servers, runs at most 20 turns, writes 5-minute cache entries, and sets a fixed session title so no extra title call is made.

### Verdict schema

Each `results/{entry_index}.json` is a strict `TriageVerdict` discriminated union — one of `tp`, `fp-novel`, `fp-classifier-regression`, `uncertain`, enforced by `parse_triage_verdict` when `submit_verdict` accepts it and again at finalize. The fields per kind are the output contract in the investigator's system prompt. Every false-positive verdict is **self-contained** — it carries its own evidence, with `member_evidence` naming the real caller's call site, so there is no in-run consolidation; offline grouping of false positives happens downstream in the `plan` skill. How each kind maps into the published envelope is the **Phase 4** table below.

## Phase 4: Finalize

`investigate_and_finalize.ts` finalizes the run in the call that drains it. Finalization builds the v5 `triage_results/<run-id>.json` entirely from the per-entry verdict files in `results/` and the triage state:

| Source                                                    | Drives                                                                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `results/<entry_index>.json` (`fp-novel`)                 | `novel_issues[]` (one-per-verdict, enriched with the entry's deterministic `diagnosis` / `resolution_failure` / `receiver_kind`) |
| `results/<entry_index>.json` (`fp-classifier-regression`) | `classifier_regressions[]` (rolled up by `should_have_matched_rule_id`)                                                          |
| `results/<entry_index>.json` + `triage.json`              | `confirmed_unreachable[]` (auto-classified + TP cache + `kind: "tp"`), `uncertain[]`                                             |

Each `confirmed_unreachable` row carries the identifiers needed for the cross-run TP cache (`name`, `file_path` relative to `project_path`, `kind`, `start_line`, optional `signature`) plus `source` (`"llm-tp"` for LLM-confirmed entries, `"registry:<group_id>"` for builtin-classifier hits, `"previously-confirmed-tp"` for TP-cache reuse) and the verdict's `member_evidence` when one exists. `uncertain` rows carry the same identifiers plus the verdict's `reason` and `member_evidence`.

Finalization also:

- Sets `manifest.status = "finalized"`, `finalized_at = now`.
- Clears the project's `LATEST` pointer.

The run directory is preserved for diffing and audit. Use `prune_runs.ts` to garbage-collect old run dirs (the published `triage_results/<run-id>.json` is kept forever — `diff_runs` and the plan skill depend on it).

## Reusing Prior TP Verdicts

When you re-run the pipeline at the same target HEAD commit, `prepare_triage` reuses entries that any prior finalized run classified as `confirmed_unreachable` with `source.kind === "llm-tp"`. The cache accumulates across all finalized runs at the commit (newest first, newer run wins on collision), so entries investigated in any earlier run remain reusable even when a newer run mixed `llm-tp` and `previously-confirmed-tp` rows. Reused entries skip Phase 3 and ship straight to the new run's `confirmed_unreachable[]` with `known_source: "previously-confirmed-tp"` and a `tp_source_run_id` that records the primary source run.

The cache validity gate is **the run-id's `<short-commit>-` prefix**:

- Same prefix → cache reuses prior TP verdicts.
- Different prefix (any commit on the target) → cache misses; every entry re-investigates.

Two known leaks (accepted; document for users):

- **Uncommitted target-repo changes don't bust the cache.** HEAD is the only signal. To force a clean pass after a dirty edit, either `git commit` first or pass `--no-reuse-tp`.
- **Ariadne core changes don't bust the cache.** If you tighten Ariadne's call resolution and want to validate that prior TPs still hold, run once with `--no-reuse-tp`.

`--tp-source-run <run-id>` pins a specific source (must be at the current commit).

## Comparing Runs

```bash
node --import tsx .claude/skills/triage/scripts/diff_runs.ts \
  --project <name> --from <run-id> --to <run-id> [--format text|json]
```

Output highlights TP↔FP flips (regression candidates), entries that appeared/disappeared, group-id changes, and group membership deltas. Reads the published `triage_results/<run-id>.json` files; works even when the underlying run dirs have been pruned.

## Run Retention

```bash
node --import tsx .claude/skills/triage/scripts/prune_runs.ts \
  --project <name> [--keep <n>] [--dry-run]
```

Default keep-count is `5` (override with `--keep` or `ARIADNE_RETAIN_RUNS`). Runs whose run-id is referenced by another run's `tp_cache.source_run_id` are protected. Active and abandoned runs are never pruned. Published `triage_results/<run-id>.json` files are kept forever.

`list_runs.ts --project <name> [--status active|finalized|abandoned] [--last <n>]` enumerates the run history with status (JSON to stdout). `abandon_run.ts --project <name> [--run-id <id>]` marks a run abandoned and clears `LATEST` if it pointed there.

## Typical Iteration Loop

The user's iteration cycle when tuning the classifier registry or Ariadne core resolution against a fixed target commit:

```bash
# 1. Detect once (the clone stays at the run commit until Phase 1 is given --commit)
node --import tsx scripts/detect_entrypoints.ts --config <config> > /dev/null
# capture the analysis JSON path (or use Glob to find it)

# 2. Initial run
node --import tsx scripts/prepare_triage.ts --analysis <analysis.json> --project <name>
#   ... then investigate_and_finalize.ts --project <name> --run-id <run-1> ...

# 3. Edit registry / Ariadne core. (No commit needed; the cache gates on target HEAD.)

# 4. Re-run at the same commit. Cache reuses prior TPs; LLM re-investigates only the residual.
node --import tsx scripts/prepare_triage.ts --analysis <analysis.json> --project <name>
#   ... then investigate_and_finalize.ts --project <name> --run-id <run-2> ...

# 5. Diff to spot regressions
node --import tsx scripts/diff_runs.ts --project <name> --from <run-1> --to <run-2>
```

Step 4 requires step 2's run to be finalized or abandoned — see **State and Output Locations**.

The two known cache leaks apply during this loop — uncommitted target-repo edits and Ariadne core changes don't bust the cache; the escape hatch is `--no-reuse-tp`. See **Reusing Prior TP Verdicts** above for the full statement.

## Persisted-State Preservation Policy

The pipeline persists state in three places — two under `~/.ariadne/triage-entrypoints/` plus core's cache under `~/.ariadne/cache/`. Each has a different preservation contract — wiping the wrong one silently destroys cross-run TP reuse.

| State                                                              | Status               | Action on upgrade                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analysis_output/<project>/triage_results/`                        | **Preserve**         | Never `rm -rf`. These finalized triage-results JSON files are the permanent source of truth for the TP cache (read by `confirmed_unreachable_reuse.derive_tp_cache` via `triage_results_store.all_finalized_runs_at_commit`). Wiping them forces every prior-confirmed entry back through the LLM investigator. |
| `triage_state/<project>/runs/`                                     | **Preserve**         | Active and abandoned runs never auto-prune. `prune_runs.ts` keeps the last `--keep <n>` finalized runs and protects any run referenced as another run's `tp_cache.source_run_id`.                                                                                                                               |
| `~/.ariadne/cache/<slug>/manifest.json` (core's persistence cache) | **Auto-invalidates** | The cache schema version is checked on load; mismatched manifests are dropped via `deserialize_manifest` and the cache rebuilds on next run. No user action required.                                                                                                                                           |

**Clearing a run left in flight.** `abandon_run.ts --project <name> [--run-id <id>]` marks the manifest abandoned and drops the `LATEST` pointer; the run dir stays visible to `list_runs.ts`. Run liveness lives in `manifest.status`, so this is the only way to release a project — deleting the `LATEST` file alone leaves the manifest `active` and the next `prepare_triage` refuses. `list_runs.ts --project <name> --status active` names what is holding a project, and `abandon_run.ts` resolves on the manifest alone, so it also clears a run interrupted before its `triage.json` was written.

**Published schema:** `TRIAGE_RESULTS_SCHEMA_VERSION` is `5`. Readers (`triage_results_store`, `confirmed_unreachable_reuse`, `diff_runs`) hard-reject any `triage_results/<run-id>.json` whose `schema_version` does not match — there are no migration shims. Pre-v5 files age out naturally as new runs land; the persisted-state policy still forbids `rm -rf` of the whole `analysis_output/` tree.

## Dead-code guardrail

Orthogonal to this skill. The `detect_dead_code` Stop hook (`.claude/hooks/detect_dead_code.ts`, registered in `.claude/settings.json`) runs Ariadne after each Claude Code session against every package whose `src/**.ts` changed since the last commit the hook cleared — committed, staged, unstaged, or untracked — and cross-checks flagged entry points against a per-package whitelist at `.claude/known_entrypoints/<package>.json` (repo-committed, not in `~/.ariadne`). Exported-but-uncalled entry points not on the whitelist block the session.

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

This skill does not read or write this whitelist.

## Architecture: Key Modules

The skill is a thin caller of `@ariadnejs/core`. Classification (`enrich_call_graph`, `extract_entry_point_diagnostics`, the builtin classifiers, and the bundled permanent registry slice) lives in `packages/core/src/classify_entry_points/`. Entry-point and known-issues types live in `@ariadnejs/types`. The skill modules under `src/` orchestrate the run lifecycle on top of that core API.

| Module                                        | Purpose                                                                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `known_issues_registry.ts`                    | Full-registry loader (skill-side) — reads the canonical `known_issues/registry.json`, including `wip` rules, and hands it to `enrich_call_graph` as a registry override |
| `prepare_triage.ts`                           | Run-namespaced orchestration: call core's `enrich_call_graph` with the full registry, partition into known-unreachable / TP-cache / llm-triage                          |
| `build_triage_entries.ts`                     | Assemble `TriageEntry` records from prepared buckets                                                                                                                    |
| `finalize/output.ts`                          | Build the published v5 envelope from the per-entry verdict files (pure); attaches the deterministic core fault diagnostics to each `novel_issues[]` row                 |
| `finalize/verdict_ledger.ts`                  | Shared per-entry verdict loader (`results/<entry_index>.json`); used by both `finalize/merge_results.ts` and `finalize/finalize_run.ts`                                 |
| `finalize/merge_results.ts`                   | Merge investigator result files into triage state                                                                                                                       |
| `finalize/finalize_run.ts`                    | Publish a drained run's v5 results, seal its manifest, clear `LATEST`                                                                                                   |
| `verdict/triage_verdict.ts`                   | `TriageVerdict` discriminated union + strict runtime parser; the published `NovelIssue` row type                                                                        |
| `finalize/classifier_regressions.ts`          | `aggregate_classifier_regressions` — finalize-time per-rule rollup of `fp-classifier-regression` verdicts (used only by triage's finalize)                              |
| `dispense/dispense_payload.ts`                | Build the per-entry dispense payload (entry context + in-scope registry slice)                                                                                          |
| `dispense/render_entry_context.ts`            | Render a payload as the investigation's bounded first message (capped evidence lists, one line per rule)                                                                |
| `dispense/diagnosis_hints.ts`                 | Per-diagnosis investigation guides, rendered into the investigator's system prompt                                                                                      |
| `dispense/claim_pending_entries.ts`           | Absorb verdict files and claim the entries still to investigate; terminalize an entry that never yields a verdict                                                       |
| `investigate/investigate_run.ts`              | Phases 3–4: claim, investigate through the pool, write verdicts and usage, finalize a drained run                                                                       |
| `investigate/investigation_pool.ts`           | Continuous concurrent pool with one lead investigation to warm the prompt cache; `prefix_miss` count                                                                    |
| `investigate/run_investigation.ts`            | One investigation as an Agent SDK `query()`; its usage and why it has no verdict                                                                                        |
| `investigate/investigator_system_prompt.ts`   | The constant system prompt every investigation shares                                                                                                                   |
| `investigate/investigation_tools.ts`          | The in-process `read`, `grep` and `submit_verdict` tools, confined to the project root                                                                                  |
| `investigate/investigator_model.ts`           | The pinned investigator model and its effort                                                                                                                            |
| `triage_state_types.ts`                       | Triage state types (`TriageState`, `TriageEntry`, `TriageEntryResult`)                                                                                                  |
| `store/paths.ts`                              | Triage state file locations; run resolution against the state file (`require_run`) or the manifest alone (`require_run_manifest`)                                       |
| `store/latest_pointer.ts`                     | Single-slot LATEST pointer I/O naming the project's current run                                                                                                         |
| `cli_args.ts`                                 | Required-flag CLI helpers (`parse_project_arg`, `parse_run_id_arg`)                                                                                                     |
| `finalize/confirmed_unreachable_reuse.ts`     | TP cache derivation — short-circuits the LLM investigator across runs at the same commit                                                                                |
| `store/run_discovery.ts`                      | Run enumeration, manifest reading, active-run detection (`find_active_runs`), prune protection                                                                          |
| `store/analysis_output.ts`                    | Timestamped analysis output JSON I/O                                                                                                                                    |
| `project_id.ts`                               | Project-identifier derivation (`path_to_project_id`, `project_id_from_config`)                                                                                          |
| `@ariadnejs/skill-fs/require-node-import-tsx` | Side-effect guard shared with `plan`: aborts if invoked via `tsx` CLI instead of `node --import tsx`                                                                    |

## Reference

- [Diagnosis Routes: Routing Table and Classification Guide](reference/diagnosis_routes.md)

## Investigator

| Model                               | Runs                                       | Purpose                                                                                                  |
| ----------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `claude-haiku-5-5`, effort `medium` | one Agent SDK `query()` per residual entry | Investigate one entry; submit one `TriageVerdict` (tp / fp-novel / fp-classifier-regression / uncertain) |

The skill dispatches no sub-agents.

## Current State

To see active triage runs and their live counts, run on demand:

```bash
node --import tsx .claude/skills/triage/scripts/get_triage_summary.ts
```
