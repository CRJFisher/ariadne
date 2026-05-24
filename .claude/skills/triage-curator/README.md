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

```mermaid
flowchart LR
  classDef step      fill:#fff8e1,stroke:#b58900,stroke-width:1.8px,color:#5d4037
  classDef artifact  fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.5px,color:#1b5e20
  classDef store     fill:#ede7f6,stroke:#4527a0,stroke-width:1.8px,color:#311b92

  SRP(["triage-entrypoints · <i>sense</i><br/>publish v4 triage_results"]):::step
  TR_IN[/"novel_issues[]<br/>+ classifier_regressions[]"/]:::artifact
  CUR(["triage-curator · <i>classify</i><br/>novel_issue → classifier + wip<br/>regression → drift_evidence"]):::step
  HANDOFF[/"wip rows · check_*.ts<br/>· backlog task"/]:::artifact
  FS(["fix-sequencer · <i>actuate</i><br/>cluster · sign off · ship fix"]):::step

  REG[("registry.json<br/><b>what we learned</b>")]:::store

  SRP --> TR_IN --> CUR --> HANDOFF --> FS
  CUR -- "writes wip · drift_evidence" --> REG
  REG -. "next run: filter known issues" .-> SRP

  linkStyle default stroke:#cbd5e1,stroke-width:1.6px
  linkStyle 5 stroke:#ef5350,stroke-width:2.4px,stroke-dasharray:6 4
```

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

```mermaid
flowchart TD
  classDef ext        fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px,color:#0d47a1
  classDef store      fill:#ede7f6,stroke:#4527a0,stroke-width:1.5px,color:#311b92
  classDef artifact   fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.2px,color:#1b5e20
  classDef step       fill:#fff8e1,stroke:#b58900,stroke-width:1.5px,color:#5d4037
  classDef agent      fill:#ffe5ec,stroke:#c2185b,stroke-width:1.5px,color:#5a0922
  classDef inter      fill:#f5f5f5,stroke:#616161,stroke-width:1px,color:#212121,stroke-dasharray:3 3
  classDef branch     fill:#ffe0b2,stroke:#e65100,stroke-width:1.5px,color:#bf360c
  classDef downstream fill:#e5e7eb,stroke:#374151,stroke-width:1px,color:#111827
  classDef human      fill:#fce7f3,stroke:#9d174d,stroke-width:1px,color:#500724

  TR[/"triage_results/&lt;run-id&gt;.json<br/>novel_issues[] · classifier_regressions[]"/]:::ext
  REG_R[("known_issues/registry.json<br/><i>read-only here</i><br/>filter · investigator context")]:::ext

  subgraph P1["Phase 1 · Plan sweep"]
    direction TB
    S1("curate_all.ts<br/>route novel_issues by registry status<br/>+ aggregate classifier_regressions"):::step
    BR1{novel_issue id in registry?}:::branch
    BUMP(["already registered<br/>(wip / permanent)<br/>observed-stat bump only"]):::inter
    FIX_SURF(["fixed-row resurfacing<br/>surface for human review"]):::inter
    REG_FLAGS(["classifier_regressions[]<br/>routed to drift-absorb<br/>via finalize"]):::inter
  end

  subgraph P3["Phase 3 · Investigate promote-novel (puller loop · ≤5 concurrent · self-validating)"]
    direction TB
    DLIST[/"dispatch list<br/>promote-novel entries"/]:::artifact
    PULL("next_investigate_tasks.ts<br/>puller · drift-priority sort"):::step
    AG_INV[["triage-curator-investigator<br/>opus · 200t · promote-novel<br/>propose → validate → iterate"]]:::agent
    INV_OUT[/"investigate/&lt;novel_issue_id&gt;.json<br/>classifier_spec · signal_gap · ariadne_bug<br/>· rejected_members"/]:::artifact
  end

  subgraph P4["Phase 4 · Render classifier source"]
    direction TB
    REND("render_classifier.ts<br/>spec → check_&lt;id&gt;.ts"):::step
    AUTH[/"authored-files.json<br/>{ novel_issue_id → check_*.ts path }"/]:::artifact
  end

  subgraph P5["Phase 5 · Finalize + ship"]
    direction TB
    FIN("finalize_run.ts<br/>validate_run_coherence · apply_proposals<br/>+ absorb_classifier_regressions · bump_observed_stats<br/>· AST-parse · sync_permanent_rules"):::step
    SENT[/"finalized.json (sentinel)"/]:::artifact
    BLOG("backlog flight<br/>task_create + link_ariadne_bug_tasks"):::step
    COMM("git commit<br/>AskUserQuestion · current/new/pr/skip"):::step
  end

  REG_W[("registry.json<br/><b>wip writes</b><br/>classifier.kind · drift_evidence<br/>· observed_count · backlog_task")]:::store
  CORE[("packages/core/.../builtins/<br/>check_&lt;id&gt;.ts + permanent_data")]:::store
  BL[("backlog<br/>signal-gap + Ariadne-bug tasks")]:::store
  FX[["fix-sequencer reconciler<br/>(reads wip + backlog_task)"]]:::downstream
  HUMAN[/"human review<br/>find-promotion-candidates"/]:::human

  TR --> S1
  REG_R -. read .-> S1
  S1 --> BR1
  BR1 -- "no · new" --> DLIST
  BR1 -- "yes · wip/permanent" --> BUMP
  BR1 -- "yes · fixed" --> FIX_SURF
  S1 --> REG_FLAGS

  REG_R -. read · investigator context .-> AG_INV
  DLIST --> PULL
  PULL -- "pending ≤ 5" --> AG_INV
  AG_INV -- "validate · iterate" --> AG_INV
  AG_INV --> INV_OUT
  INV_OUT -. "remaining &gt; 0 · re-pull" .-> PULL

  INV_OUT --> REND
  REND --> AUTH
  REND --> CORE
  AUTH --> FIN
  INV_OUT --> FIN
  BUMP --> FIN
  FIX_SURF --> FIN
  REG_FLAGS --> FIN

  FIN --> SENT
  FIN --> REG_W
  FIN --> CORE
  SENT --> BLOG
  BLOG --> BL
  BLOG -- "{ novel_issue_id → TASK-N }" --> REG_W
  BLOG --> COMM
  COMM --> FX
  REG_W --> FX
  REG_W -. candidates .-> HUMAN
  HUMAN -. "manual wip → permanent" .-> REG_W

  linkStyle default stroke:#cbd5e1,stroke-width:1.5px
```

**What to look for**: the registry-status branch in Phase 1 has three
labelled exits — `no · new` is the only arm that dispatches an
investigator; `yes · wip/permanent` short-circuits to finalize as an
observed-stat bump; `yes · fixed` short-circuits to finalize as a
resurfacing surfaced for human review (the curator never re-flips a
fixed row — that's the fix-sequencer reconciler's write boundary).
`classifier_regressions[]` enters Phase 1 as a parallel input and
flows directly to finalize's drift-absorb path; no investigator
dispatch. Promote-novel entries thread Phases 3 → 4 → 5 into a new
`check_<id>.ts`, a `wip` row, and a backlog task; four phase bands
stacked top-to-bottom (Phase 2 is reserved for the on-demand
maintenance flow below); two read-only inputs (`triage_results` +
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
on-demand QA maintenance flow and the `wip → permanent` human
promotion entry live in their own H2s below.

## Maintenance flow: on-demand QA of already-classified groups

On-demand QA pass against entries the upstream triage-entrypoints
classified via a registry rule (`confirmed_unreachable[]` rows with
`source.kind === "registry"`). Invoked manually via
`scripts/get_qa_context.ts --group <id> --run <triage_results.json>`;
the puller does not dispatch it from `curate_all`. The sub-agent
samples up to ten entries, decides which look like outliers, and any
drift it confirms lands in `drift_evidence` with `source: "qa-sample"`
through the same finalize path the in-flight regressions use.

```mermaid
flowchart TD
  classDef ext        fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px,color:#0d47a1
  classDef artifact   fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.2px,color:#1b5e20
  classDef agent      fill:#ffe5ec,stroke:#c2185b,stroke-width:1.5px,color:#5a0922
  classDef inter      fill:#f5f5f5,stroke:#616161,stroke-width:1px,color:#212121,stroke-dasharray:3 3
  classDef branch     fill:#ffe0b2,stroke:#e65100,stroke-width:1.5px,color:#bf360c
  classDef step       fill:#fff8e1,stroke:#b58900,stroke-width:1.5px,color:#5d4037

  TR_M[/"triage_results entries<br/>confirmed_unreachable<br/>source.kind = registry"/]:::ext
  REG_R_M[("registry.json<br/><i>read-only · QA context</i>")]:::ext
  CTX("get_qa_context.ts<br/>sample ≤10 members + source excerpts"):::step

  subgraph P2["Phase 2 · QA classified group (on-demand)"]
    direction TB
    AG_QA[["triage-curator-qa<br/>sonnet · 50t · per group"]]:::agent
    QA_OUT[/"qa/&lt;group_id&gt;.json<br/>outliers · drift notes"/]:::artifact
    BR2{QA outlier rate?}:::branch
  end

  FIN_P(["finalize step in primary flow<br/>(stamps drift_evidence<br/>source: qa-sample)"]):::inter
  NONE(["no-op when outlier rate<br/>below threshold"]):::inter

  TR_M --> CTX
  REG_R_M -. read · QA context .-> CTX
  CTX --> AG_QA
  AG_QA --> QA_OUT
  QA_OUT --> BR2
  BR2 -- "outliers ≥ threshold · drift tag" --> FIN_P
  BR2 -- "below threshold" --> NONE

  linkStyle default stroke:#cbd5e1,stroke-width:1.5px
```

**What to look for (maintenance)**: this flow is **on-demand** — no
puller dispatch, no inclusion in the `curate_all` plan. The sub-agent
samples members of one already-classified group via
`get_qa_context.ts`; the lone branch decision is "QA outlier rate?"
with two labelled exits. Above threshold, the run re-enters the
primary diagram at its finalize step (Phase 5) with a `drift_evidence`
row stamped `source: "qa-sample"` on the existing `wip` row — the same
shape the in-flight `classifier_regressions[]` path produces,
distinguished by `source`. Below threshold the QA result is a no-op.
This flow writes only `drift_evidence` rows and observed-stat
counters.

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
`BuiltinClassifierSpec`** — the investigator emits the spec, the main
agent runs `render_classifier.ts`, and the rendered source is written
to disk. Finalize AST-parses each file before upserting the registry.
Never hand-edit a generated classifier; change the spec (or flip the
registry entry to `status: "permanent"` to lock it) and re-run the
sweep.

Sub-agents:

- `.claude/agents/triage-curator-investigator.md` — opus, 200 turns,
  primary path (promote-novel)
- `.claude/agents/triage-curator-qa.md` — sonnet, 50 turns, on-demand
  maintenance only

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

- `~/.ariadne/triage-curator/runs/<run_id>/{qa,investigate}/*.json` —
  per-group sub-agent output (inputs to `finalize_run.ts`).
- `~/.ariadne/triage-curator/runs/<run_id>/investigate/<novel_issue_id>.session.json` —
  investigator session log, one per dispatch.
- `~/.ariadne/triage-curator/runs/<run_id>/finalized.json` — written by
  finalize; its presence marks the run as curated and makes scan skip
  it.
