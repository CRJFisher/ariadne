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

`get_next_triage_batch.ts` drives the triage loop:

1. Merges any completed investigator result files from `triage_state/results/` into the state.
2. Returns the next batch of pending entry indices (up to `state.batch_size`).
3. If no pending entries remain, sets `phase = "complete"` and returns an empty batch.

The main agent loops: call `get_next_triage_batch.ts` → launch investigators → repeat until batch is empty.

## Aggregation Filesystem Convention

Aggregation state is fully implicit in the filesystem. No aggregation fields exist in the triage state file. All files live under `triage_state/aggregation/`:

```
aggregation/
  slices/        slice_{n}.json            — pass 1 input
  pass1/         slice_{n}.output.json     — rough groupings
  pass2/         batch_{n}.input.json      — consolidation input (>15 groups only)
                 batch_{n}.output.json     — consolidated groups
  pass3/         input.json                — canonical group list
                 {group_id}_investigation.json  — per-group member verification
```

### Pass 1 — Rough grouping

`prepare_aggregation_slices.ts` splits `ariadne_correct === false` entries into slices of ~50. One `rough-aggregator` agent processes each slice and writes group assignments to `pass1/slice_{n}.output.json`.

### Pass 2 — Cross-slice consolidation (conditional)

`merge_rough_groups.ts` counts distinct group names across all pass1 outputs:

- **≤15 groups**: writes `pass3/input.json` directly and sets `skip_pass2: true`.
- **>15 groups**: writes `pass2/batch_{n}.input.json` bundles of ~20 groups. One `group-consolidator` agent processes each batch. `merge_consolidated_groups.ts` then traces group chains back through pass1 to resolve entry indices and writes `pass3/input.json`.

### Pass 3 — Member verification

One `group-investigator` (Opus) agent runs per group in parallel. Each reads investigator result files, re-fetches context for ambiguous members, and classifies each member as confirmed or rejected. Outputs `pass3/{group_id}_investigation.json`.

`finalize_aggregation.ts` reads all investigation results, writes canonical `group_id`/`root_cause` back to state entries, reallocates rejected members (to `suggested_group_id` if valid, else `"residual-fp"`), and sets `state.phase = "complete"`.

## Edge Cases

| Condition              | Behavior                                                                         |
| ---------------------- | -------------------------------------------------------------------------------- |
| No triage state file   | `get_next_triage_batch.ts` exits 1 with error on stderr                          |
| State file unparsable  | `get_next_triage_batch.ts` exits 1 with error on stderr                          |
| `phase === "complete"` | `finalize_triage.ts` proceeds normally                                           |
| Failed entries         | Skipped by `get_next_triage_batch.ts`; not re-batched                            |
| Rejected group member  | Assigned to `suggested_group_id` or `"residual-fp"` by `finalize_aggregation.ts` |
