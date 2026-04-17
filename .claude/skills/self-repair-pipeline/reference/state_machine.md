# Triage Pipeline: Explicit Loop and Aggregation Convention

The pipeline is orchestrated explicitly by the main agent following SKILL.md instructions. There is no implicit stop hook or automatic phase transition — every step is a direct script call or agent launch.

## Triage State

The triage state file (`triage_state/{project}_triage.json`) tracks all entries through their lifecycle. The state has two phases:

```
triage → complete
```

- **`triage`**: Set by `prepare_triage.ts`. Entries are pending, completed, or failed.
- **`complete`**: Set by `finalize_aggregation.ts` after all group investigations finish.

`finalize_triage.ts` guards on `phase === "complete"` before writing output.

## Triage Loop

`get_next_triage_entry.ts` dispenses one pending entry (or up to `--count N`) per call to drive the main agent's continuous worker pool:

1. Merges any completed investigator result files from `triage_state/results/` into the state.
2. Picks up to `count` entries with `status === "pending"` that are NOT listed in `--active`, and returns their indices.
3. Transitions `phase` to `"complete"` only when no entries are pending **and** `--active` is empty.

The main agent keeps `N` investigators in flight: one initial `--count N` call to fill the pool, then one `--count 1` call per completion to launch a replacement. The main agent tracks in-flight indices locally and passes them as `--active 7,12,18,23` so the script never hands the same index to two workers.

## Aggregation Filesystem Convention

Aggregation state is fully implicit in the filesystem. No aggregation fields exist in the triage state file. All files live under `triage_state/aggregation/`:

```
aggregation/
  slices/        slice_{n}.json            — pass 1 input
  pass1/         slice_{n}.output.json     — rough groupings
  pass3/         input.json                — canonical group list
                 {group_id}_investigation.json  — per-group member verification
```

### Pass 1 — Rough grouping

`prepare_aggregation_slices.ts` splits `ariadne_correct === false` entries into slices of ~50. One `rough-aggregator` agent processes each slice and writes group assignments to `pass1/slice_{n}.output.json`.

### Pass 2 — Merge rough groups

`merge_rough_groups.ts` unions all pass1 outputs into a single canonical group list and writes `pass3/input.json`.

### Pass 3 — Member verification

One `group-investigator` (Opus) agent runs per group in parallel. Each reads investigator result files, re-fetches context for ambiguous members, and classifies each member as confirmed or rejected. Outputs `pass3/{group_id}_investigation.json`.

`finalize_aggregation.ts` reads all investigation results, writes canonical `group_id`/`root_cause` back to state entries, reallocates rejected members (to `suggested_group_id` if valid, else `"residual-fp"`), and sets `state.phase = "complete"`.

## Edge Cases

| Condition               | Behavior                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------- |
| No triage state file    | `get_next_triage_entry.ts` exits 1 with error on stderr                               |
| State file unparsable   | `get_next_triage_entry.ts` exits 1 with error on stderr                               |
| `phase === "complete"`  | `finalize_triage.ts` proceeds normally                                                |
| Failed entries          | Skipped by `get_next_triage_entry.ts`; not re-dispensed                               |
| Crashed investigator    | Entry stays `pending` (no result file written); picked up on a later call             |
| Interrupted run resumed | `prepare_triage.ts` rewrites state from scratch; stale in-flight workers are orphaned |
| Rejected group member   | Assigned to `suggested_group_id` or `"residual-fp"` by `finalize_aggregation.ts`      |
