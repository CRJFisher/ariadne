# triage-curator

Offline sweep over completed `triage-entrypoints` runs. Consumes the v4
`triage_results/<run-id>.json` published by triage-entrypoints —
specifically `novel_issues[]` (issues named by the per-entry investigator
and run-time coordinator) and `classifier_regressions[]` (in-flight
drift flags the per-entry investigator raised when a wip classifier
failed to match an entry it should have caught).

For each novel issue with no registry row yet, the curator dispatches a
single `triage-curator-investigator` (opus) to author a
`BuiltinClassifierSpec` plus an Ariadne-bug backlog task. For each
classifier-regression flag, the curator stamps `drift_evidence` onto
the existing wip row through the finalize step's drift-absorb path.
Already-registered novel issues only bump observed-stats. The sweep
ends by filing backlog tasks and committing.

## Pipeline Flow

(For where this skill fits in the broader chain see [triage-entrypoints → Self-healing pipeline](../triage-entrypoints/README.md#self-healing-pipeline).)

### Where this lands

The curator is the middle link in the self-healing chain. The touch-point
diagram below shows where the **primary trigger flow** attaches to
neighbouring skills — internals are folded.

<!-- mermaid source: README.where-this-lands.mmd -->
![Triage-curator touch-points (sense → classify → actuate)](./README.where-this-lands.svg)

**Where this lands**: three skills in a row (sense → classify → actuate);
the curator's two **primary triggers** are the `novel_issues[]` and
`classifier_regressions[]` slices of the latest `triage_results`, and its
primary outputs (wip row + classifier source + backlog task + drift
evidence) are exactly what `fix-sequencer` reads on the next run; one
durable surface (`registry.json`) sits below the chain and anchors the
loop-closure red dotted edge that fires on the _next_ triage-entrypoints
invocation.

**Primary trigger**: a `novel_issues[]` entry in a freshly published
`triage_results/<run-id>.json` whose `id` does not match a registry row.
The diagram below traces that flow from entry through to the `wip` row
in `registry.json`, the `check_<id>.ts` written to core builtins, and
the backlog task filed for the underlying signal/bug. Already-registered
novel issues skip the investigator wave and only contribute to
observed-stat bumps; `classifier_regressions[]` flow through the
drift-absorb path inside finalize. Validation is folded into the
investigator's own propose → validate → iterate loop, scoped to a
single response at a time.

<!-- mermaid source: README.primary-trigger.mmd -->
![Triage-curator primary-trigger flow (novel_issue → wip row + classifier + backlog task)](./README.primary-trigger.svg)


**What to look for**: the registry-status branch in Phase 1 has three
labelled exits — `no · new` is the only arm that dispatches an
investigator; `yes · wip/permanent` short-circuits to finalize as an
observed-stat bump; `yes · fixed` short-circuits to finalize as a
resurfacing surfaced for human review (the curator never re-flips a
fixed row — that's the fix-sequencer reconciler's write boundary).
`classifier_regressions[]` enters Phase 1 as a parallel input and
flows directly to finalize's drift-absorb path; no investigator
dispatch. Promote-novel entries thread Phases 3 → 5 into a new
`check_<id>.ts`, a `wip` row, and a backlog task; three phase bands
stacked top-to-bottom; two read-only inputs (`triage_results` +
`registry.json`) sit above the phase bands and only feed the steps
that touch them; one sub-agent on the primary path
(`triage-curator-investigator`, opus, ≤5 concurrent) which owns its
own propose → validate → iterate loop (the self-edge on `AG_INV`); one
contained back-edge inside Phase 3 (the puller re-pull when
investigation output remains). Cross-response coherence (two responses
targeting the same classifier file) is enforced once at the top of
Phase 5 by `finalize_run.ts` before any registry mutation, since the
per-response validator inside Phase 3 is scoped to a single response.
The `rejected_members` field on `INV_OUT` is the investigator's audit
trail for citations the chosen classifier cannot cover — those
citations re-surface as new novel-issue candidates on the next
triage-entrypoints run. The bottom-row stores make the curator's write
surface explicit: it is the **single autonomous writer of `wip` rows**;
`permanent` (human-edited, via `find-promotion-candidates`) and
`fixed` (`fix-sequencer` reconciler) are owned by other writers. The
`wip → permanent` human promotion entry lives in its own H2 below.

## Maintenance entries

### `wip → permanent` human promotion

Maintenance entry: the operator runs `pnpm find-promotion-candidates`,
hand-edits the `status` field of qualifying rows in `registry.json`,
then runs `pnpm sync-permanent-rules` to rebuild the bundled core
slice. This runs out-of-band of any curator sweep — there is no
`curate_all` invocation that produces it. The `REG_W ↔ HUMAN` dotted
cycle in the primary diagram visualizes the data flow this loop
participates in; the loop itself is invoked separately.

## Authored classifiers

Builtin classifiers live at
`packages/core/src/classify_entry_points/builtins/check_<id>.ts`. The
finalize step writes them across the package boundary into core; the CI
gate `pnpm check-permanent-rules` keeps the bundled permanent slice
(`packages/core/src/classify_entry_points/permanent_data.ts`) and the
builtins barrel in sync with the curator's working registry at
`.claude/skills/triage-entrypoints/known_issues/registry.json`.

Each `check_*.ts` file is a **pure function of its
`BuiltinClassifierSpec`** — the investigator emits the spec, and
`finalize_run` renders it via `src/render_classifier.ts`, writes the
source to disk, and AST-parses it before upserting the registry.
Never hand-edit a generated classifier; change the spec (or flip the
registry entry to `status: "permanent"` to lock it) and re-run the
sweep.

Sub-agents:

- `.claude/agents/triage-curator-investigator.md` — opus, 200 turns,
  primary path (promote-novel)

## Run the sweep

```bash
# From the repo root
node --import tsx .claude/skills/triage-curator/scripts/curate_all.ts --dry-run
```

Or via Claude: `/triage-curator [--project <name>] [--dry-run]`.

## Tests

```bash
cd .claude/skills/triage-curator
pnpm test
```

## State files

- `~/.ariadne/triage-curator/runs/<run_id>/investigate/*.json` —
  per-novel-issue investigator output (inputs to `finalize_run.ts`).
- `~/.ariadne/triage-curator/runs/<run_id>/investigate/<novel_issue_id>.session.json` —
  investigator session log, one per dispatch.
- `~/.ariadne/triage-curator/runs/<run_id>/finalized.json` — written by
  finalize; its presence marks the run as curated and makes scan skip
  it.
