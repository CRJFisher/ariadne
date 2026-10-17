---
id: TASK-405
title: "Patch the call graph where Ariadne misses a caller, and measure what each repair costs"
status: To Do
assignee: []
created_date: "2026-10-12 11:00"
labels:
  - call-graph
  - entry-points
  - triage
  - skills
  - measurement
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Functionality at stake

A user who points Ariadne at a repository gets an entry-point list with false positives in it: callables that are called, through a mechanism the resolver did not follow. Today the only remedy is the self-healing pipeline, which turns each false positive into a resolver fix that lands weeks later. This task gives the user a second remedy that works the same day: a repair agent reads the evidence, writes a **call-graph patch** that supplies the missing edge or declares the callable a boundary, and Ariadne applies the patch file on every subsequent load. The entry-point list, `list_entrypoints`, and `show_call_graph_neighborhood` all read the patched graph, so the user sees the repaired answer immediately, and the triage pipeline sees only the residual.

The same agent is a measuring instrument. Triage measures how much Ariadne gets wrong; the repair run measures **how much work it takes to put it right**, in tokens, tool calls, turns and wall time per repaired entry. That cost, rolled up by fault area, is a prioritisation signal the plan skill does not have today: a fault area that is cheap to patch by hand but common is a different kind of problem from one that is rare but takes an agent forty tool calls. When a resolver fix lands, the patches it makes redundant are detected mechanically, which closes the loop the same way a registry rule flips from `wip` to `fixed`.

## What the repair starts from

Every input already exists. The latest finalized triage run on each of the 39 corpora under `~/.ariadne/triage-entrypoints/` holds 4,995 `novel_issues[]` rows. Each row carries the member symbol `(file_path, name, kind, start_line)`, a `member_evidence { file, line, why }` that in most rows is the location of the caller the resolver missed, a `proposed_root_cause`, the deterministic `diagnosis`, and the resolver's `resolution_failure`. A repair is one step past a triage verdict: the verdict says "a real caller exists at `routing.py:2939`"; the patch says "the unresolved call reference at `routing.py:2939` resolves to `APIRoute.__init__`", in a form the graph can apply and a script can check.

The diagnosis distribution over those 4,995 rows decides the patch catalogue:

| Diagnosis                          |  Rows | Patch kind | Why                                                                                  |
| ---------------------------------- | ----: | ---------- | ------------------------------------------------------------------------------------ |
| `callers-in-registry-unresolved`   | 3,015 | `edge`     | A `CallReference` exists at the caller with empty `resolutions`; the patch binds it  |
| `callers-not-in-registry`          |   620 | `edge`     | No `CallReference` exists; the patch supplies a synthetic call site, flagged as such |
| `callers-in-registry-wrong-target` |   195 | `edge`     | The reference resolved elsewhere; the patch adds the missing target to `resolutions` |
| `references-without-call-syntax`   |   165 | `edge`     | A reference passed as a value; the patch records a `function_reference` reachability |
| `no-textual-callers`               |   967 | `root`     | Invoked by a framework, a CLI parser, a config file or a runtime protocol            |
| `callers-outside-indexed-corpus`   |    33 | `root`     | Invoked from code outside the indexed corpus                                         |

Eighty percent of the population is an edge the graph should hold; the rest is a boundary the user declares. Both are one record in one file.

## Design

### The patch file

Patches are committed in the target repository at `.ariadne/call_graph_patches.json`, beside the `analysability.json` declarations the simplification prototype defines, so they travel with the code they describe and a re-run never repeats a repair. The schema lives in `@ariadnejs/skill-protocol` beside the declarations schema:

```jsonc
{
  "schema_version": 1,
  "patches": [
    {
      "kind": "edge",
      "callee": {
        "file_path": "fastapi/routing.py",
        "name": "__init__",
        "kind": "constructor",
        "start_line": 1161
      },
      "caller_site": {
        "file_path": "fastapi/routing.py",
        "line": 2939,
        "anchor": "route = route_class("
      },
      "binds": "existing_reference", // or "synthetic_call_site" | "function_reference"
      "reason": "route_class defaults to APIRoute through APIRouter.__init__'s parameter default",
      "source": {
        "project": "fastapi--fastapi",
        "run_id": "c3f316b-2026-08-22T18-38-07.046Z",
        "entry_index": 69
      },
      "declared_at": "2026-10-12T11:00:00Z"
    },
    {
      "kind": "root",
      "callee": {
        "file_path": "scripts/translate.py",
        "name": "update_and_add",
        "kind": "function",
        "start_line": 411
      },
      "invoked_by": "framework", // or "external" | "dynamic"
      "reason": "Typer command dispatched from .github/workflows/translate.yml by subcommand string",
      "source": {
        "project": "fastapi--fastapi",
        "run_id": "...",
        "entry_index": 71
      },
      "declared_at": "..."
    }
  ]
}
```

The `callee` is the `MemberSymbol` tuple the whole pipeline already keys on. The `caller_site.anchor` is the text of the call on that line, so a patch whose line moved is re-anchored by searching the file for the anchor, and a patch whose anchor is gone is reported **stale** rather than silently applied to the wrong line. A `root` patch is the `DeclaredBoundary` of the simplification prototype with one more `invoked_by` value, `external`, for callers in unindexed code; the two files share the schema module so a boundary declared by either skill is read by both.

### Applying patches is a pure function in core

`trace_call_graph/apply_patches/` adds `apply_call_graph_patches(call_graph, patches): PatchedCallGraph`. It is pure over the graph the same way `measure_structure` is, and it reports every patch in exactly one state:

- **applied**: an `edge` patch found the caller's `CallableNode` by location, found or synthesised the `CallReference`, and appended a `Resolution` to the callee's `SymbolId`, recorded with `resolution_source: "patch"` so a consumer can tell a supplied edge from a resolved one; a `root` patch removed the callee from `entry_points` and recorded it under `indirect_reachability` with a new reason `{ type: "declared_root", invoked_by, reason }`.
- **stale**: the callee symbol no longer exists at that tuple, the caller file has no callable enclosing the line, or the anchor is not on the line and not found elsewhere in the file.
- **absorbed**: an `edge` patch whose `CallReference` already resolves to the callee without the patch. Ariadne now does this one itself; the patch is redundant and the report names it so the user deletes it. This is the loop-closure signal.
- **rejected**: the callee's `kind` does not match the call site's `call_type`, or the callee is a test callable, or the patch would make a node its own sole caller.

`Project.get_call_graph()` applies the patch file when the project root holds one, so the MCP tools, the CLI and `detect_entrypoints` all read the patched graph, and the patch report is attached to the detection output. `trace_call_graph(...)` as a free function stays unpatched, the same way it stays unfiltered.

### The repair skill and its sub-agent

`.claude/skills/repair-call-graph/` mirrors the triage skill's shape and reuses its stores: project configs, the clone at a pinned commit, `detect_entrypoints`, and the pending pool that `prepare_triage` builds after registry auto-classification and the TP cache have removed what needs no repair. A run lives at `~/.ariadne/repair-call-graph/<project>/runs/<run-id>/` with the same `manifest.json` / `results/<entry_index>.json` layout.

| Phase          | Actor                         | Output                                                                                                                                                                                                                                |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Detect      | triage's `detect_entrypoints` | the unpatched entry-point list at the run commit, plus the report of patches already on disk                                                                                                                                          |
| 2. Prepare     | `prepare_repair.ts`           | the pending pool: residual entries after auto-classify and the TP cache, **minus entries a committed patch already removes**, optionally seeded from a finalized triage run's `novel_issues[]` so repair starts from verdicts in hand |
| 3. Repair loop | `call-graph-repairer`         | one `RepairProposal` per entry: a patch plus evidence, or `cannot_patch` with a reason                                                                                                                                                |
| 4. Validate    | `validate_patches.ts`         | every proposal applied to the run's graph through `apply_call_graph_patches`; a proposal that lands as `stale`, `rejected` or `absorbed` is returned to the pool once with the state as feedback, then terminalised                   |
| 5. Apply       | `apply_repairs.ts`            | validated patches appended to the target's `.ariadne/call_graph_patches.json`; detection re-run; the entries removed by set difference against Phase 1 recorded per patch                                                             |
| 6. Report      | `finalize_repair.ts`          | the run report: every patch with its state, its yield, and its cost                                                                                                                                                                   |

The `call-graph-repairer` agent is the triage investigator with a different output contract. It receives the same dispense payload (`get_entry_context.ts`: the member, the diagnosis, the pre-gathered grep and Ariadne call references, the classifier hints) plus the triage verdict when one exists, and it writes one `RepairProposal`:

- `patch`: an `edge` or `root` patch as above, with `evidence_excerpt` and `confidence`.
- `cannot_patch`: with `reason` in a closed set: `genuinely_unreachable` (the agent disagrees with the verdict; it is a true positive), `caller_ambiguous` (several callers, none provable), `needs_human`.

The agent writes only its own proposal file and never edits the target repository or `packages/core`; Phase 5 is the single writer of the patch file, the same way `finalize_triage` is the single writer of the published results. The patch file is a user-owned surface in the user's repository, so the skill prints the diff and the user commits it.

### Measuring the work

The triage store records no cost today. Every sub-agent the harness runs leaves a transcript at `~/.claude/projects/<project-slug>/<session-id>/subagents/agent-<id>.jsonl` whose assistant messages each carry `usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) and whose `tool_use` blocks are countable. A repairer's first user message contains the run id and entry index, so `measure_repair_cost.ts` matches each transcript to its entry by that prompt and records, per entry:

| Measure      | Definition                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `tokens`     | output plus uncached input plus cache-creation tokens; cache reads reported separately          |
| `tool_calls` | count of `tool_use` blocks                                                                      |
| `turns`      | count of assistant messages                                                                     |
| `wall_ms`    | last message timestamp minus first                                                              |
| `yield`      | entry points removed by this patch alone, by set difference; a patch can rescue a whole subtree |
| `outcome`    | `applied`, `stale`, `rejected`, `absorbed`, or the `cannot_patch` reason                        |

The run report rolls these up by `AriadneFaultArea` (the plan skill's bucket, derived from `diagnosis` and `resolution_failure`): median and total cost, patch rate, and cost per rescued entry point. Across runs at different Ariadne commits the report adds the **absorption rate**: the share of committed patches that `apply_call_graph_patches` now reports absorbed. A fault area whose patches are being absorbed has a fix landing; one whose cost per rescued entry is high and whose count is high is where the next resolver task pays most.

### How it relates to the pipeline

```text
detect ──► triage (how much is wrong) ──► plan ──► prioritize ──► resolver fix
   │                                                                   │
   └──────► repair (what it costs to put right) ──► patch file ◄── absorbed when the fix lands
```

Repair does not replace triage and does not write the registry. A `root` patch and a permanent-limitation classifier describe the same fact at different scopes: the classifier hides every instance of a pattern on every corpus, the patch records one decision for one callable in one repository. A `cannot_patch: genuinely_unreachable` proposal on an entry triage called `fp-novel` is a disagreement worth surfacing, and the report lists those.

### Reuse from the `call-graph-simplification` worktree

The worktree at `.claude/worktrees/call-graph-simplification` holds uncommitted work that stays parked. Two pieces are taken from it, by hand, into this task: the declarations schema and store conventions in `packages/skill-protocol/src/analysability.ts` (`DeclaredBoundary`, `declarations_path`, the strict parser shape), which the patch schema extends, and the run-store layout of `.claude/skills/analysability/`. The structural metrics, the rewrite proposer and the resolver's `receiver_type_not_indexed` reason are not part of this task.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A repository holding `.ariadne/call_graph_patches.json` reports a patched entry-point list from `Project.get_call_graph()`, `list_entrypoints`, `show_call_graph_neighborhood` and `detect_entrypoints`, and every patch is reported in exactly one of `applied`, `stale`, `absorbed`, `rejected`. A patch whose anchor moved is re-anchored; one whose anchor is gone is `stale` and changes nothing. Each state has a test in `apply_patches.test.ts` asserting the exact `CallReference` or `indirect_reachability` entry it produces.
- [ ] #2 The `repair-call-graph` skill runs headlessly end to end on a config the triage skill already has, dispatching one `call-graph-repairer` per pending entry, and finishes with a run report under `~/.ariadne/repair-call-graph/<project>/runs/<run-id>/`. The agent writes only its proposal file; the patch file is written only by the apply phase, and the skill prints the diff for the user to commit.
- [ ] #3 Measured on the four corpora of the simplification evaluation — `packages/core` (TypeScript), fastapi (Python), express (JavaScript), axum (Rust) — at pinned commits, with `--max-count 30` each: the report states, per corpus and per fault area, the patch rate, the median tokens / tool calls / turns per patch, and the yield per patch; and the re-detected entry-point list after applying equals the list before minus the recorded yields, by literal set difference.
- [ ] #4 Every patch in those runs that the repairer proposed from a triage `fp-novel` verdict names the verdict in `source`, and the report lists every `cannot_patch: genuinely_unreachable` disagreement with triage.
- [ ] #5 Re-running `apply_call_graph_patches` over fastapi's committed patches at two Ariadne commits that differ by one resolver fix reports the patches that fix makes redundant as `absorbed`, and the report's absorption rate moves by exactly that count.
- [ ] #6 `measure_repair_cost.ts` sums usage from the sub-agent transcripts of a run and refuses to report a cost for an entry whose transcript it cannot match, naming the entry; it never estimates.
- [ ] #7 The patch schema is owned by `@ariadnejs/skill-protocol`, a `root` patch and the `analysability` `DeclaredBoundary` are one type, and `docs/ARCHITECTURE.md` plus `.claude/rules/trace-call-graph.md` describe patch application as part of stage 3.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

Each step lands on its own and is measured on its own; the order is by dependency.

1. **Schema and parser** in `packages/skill-protocol/src/call_graph_patches.ts`: the two patch kinds, the strict parser in the `strict_parse.ts` style, `patches_path(project_path)`, `read_patches`, and a writer that goes through `atomic_write_file`. Bring the `DeclaredBoundary` type and `declarations_path` convention across from the parked worktree so a `root` patch and a boundary are one type.
2. **`apply_call_graph_patches`** in `packages/core/src/trace_call_graph/apply_patches/`: pure over `CallGraph`, four states, re-anchoring, the `resolution_source: "patch"` marker on `Resolution`, and the `declared_root` reachability reason. Tests per state with exact literal expectations.
3. **Wire it into `Project.get_call_graph()`** and attach the patch report to the detection output; confirm both MCP tools and `detect_entrypoints` read the patched graph; extend the fingerprint of `benchmark_corpus_load` so a patched and an unpatched load are distinguishable.
4. **`call-graph-repairer` agent** (`.claude/agents/`): the investigator's prompt with the `RepairProposal` output contract and the closed `cannot_patch` set; sonnet, the same tool allowlist, plus read access to the triage verdict for its entry.
5. **The skill's scripts**: `prepare_repair.ts` (pool from `prepare_triage`'s partition minus already-patched entries, optional `--from-triage-run`), `get_next_repair_entry.ts` (the triage dispenser with the proposal path), `validate_patches.ts`, `apply_repairs.ts`, `finalize_repair.ts`. Reuse the triage store modules rather than copying them; where a module is triage-specific, lift the shared part into `@ariadnejs/skill-fs`.
6. **`measure_repair_cost.ts`**: transcript matching by prompt, the per-entry measures, the fault-area roll-up, the absorption rate across runs. Land with a fixture transcript.
7. **The evaluation**: run the four corpora at `--max-count 30`, record the table in the task, and write the two rules the numbers teach into `docs/` beside the architecture doc. Then re-run fastapi after one landed resolver fix to measure absorption for criterion #5.
8. **Documentation**: `.claude/rules/trace-call-graph.md`, `docs/ARCHITECTURE.md`, the skill's `SKILL.md`, and a row in the pipeline overview of `CLAUDE.md` naming repair as the second consumer of the triage pool.

<!-- SECTION:PLAN:END -->

## Open Questions

<!-- SECTION:NOTES:BEGIN -->

- **Patch scope on a shared corpus.** A patch file is committed in the target repository. For the 39 `repos/` clones the pipeline owns, the file is written into the clone and never pushed; the run report is the durable record. Whether patch files for those clones should also be mirrored under `~/.ariadne/repair-call-graph/<project>/patches.json` so a re-clone keeps them is decided in step 5.
- **Trust level of an applied edge.** An `edge` patch is as trustworthy as the agent's evidence, the same level as a triage `fp-novel` verdict. The `resolution_source: "patch"` marker lets a consumer that wants only resolver-proven edges filter them out; whether `list_entrypoints` should show a patched entry with its reason rather than hide it is a product decision for step 3.
- **Synthetic call sites.** The 620 `callers-not-in-registry` rows need a `CallReference` the indexer never produced. The patch supplies location, name and `call_type` only; `scope_id` is the enclosing callable's body scope. Whether that is enough for `count_tree_size` and the neighbourhood tool, or whether those rows should be limited to `function_reference` reachability, is settled by the step-2 tests.

<!-- SECTION:NOTES:END -->
