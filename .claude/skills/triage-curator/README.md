# triage-curator

Offline sweep over completed `self-repair-pipeline` runs. Audits
auto-classified false-positive groups, investigates residuals, produces
classifier + backlog + signal proposals, and commits the result.

## Pipeline Flow

(For where this skill fits in the broader chain see [self-repair-pipeline → Self-healing pipeline](../self-repair-pipeline/README.md#self-healing-pipeline).)

### Where this lands

The curator is the middle link in the self-healing chain. The touch-point diagram below shows where the **primary trigger flow** attaches to neighbouring skills — internals are folded.

```mermaid
flowchart LR
  classDef step      fill:#fff8e1,stroke:#b58900,stroke-width:1.8px,color:#5d4037
  classDef artifact  fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.5px,color:#1b5e20
  classDef store     fill:#ede7f6,stroke:#4527a0,stroke-width:1.8px,color:#311b92

  SRP(["self-repair-pipeline · <i>sense</i><br/>publish triage_results"]):::step
  TR_IN[/"triage_results<br/>residual groups"/]:::artifact
  CUR(["triage-curator · <i>primary</i><br/>residual → classifier + wip"]):::step
  HANDOFF[/"wip rows · check_*.ts<br/>· backlog task"/]:::artifact
  FS(["fix-sequencer · <i>actuate</i><br/>cluster · sign off · ship fix"]):::step

  REG[("registry.json<br/><b>what we learned</b>")]:::store

  SRP --> TR_IN --> CUR --> HANDOFF --> FS
  CUR -- "writes wip" --> REG
  REG -. "next run: filter known issues" .-> SRP

  linkStyle default stroke:#cbd5e1,stroke-width:1.6px
  linkStyle 5 stroke:#ef5350,stroke-width:2.4px,stroke-dasharray:6 4
```

**Where this lands**: three skills in a row (sense → classify → actuate); the curator's **primary trigger** is a residual group from the latest `triage_results`, and its primary outputs (wip row + classifier source + backlog task) are exactly what `fix-sequencer` reads on the next run; one durable surface (`registry.json`) sits below the chain and anchors the loop-closure red dotted edge that fires on the _next_ SRP invocation. Internals deferred to the per-step diagram below — the QA-of-classified-groups flow is a maintenance sibling diagrammed in its own H2.

**Primary trigger**: a residual group in a freshly published `triage_results/<run-id>.json` that has no matching registry entry; this diagram traces that flow from entry through to the `wip` row in `registry.json`, the `check_<id>.ts` written to core builtins, and the backlog task filed for the underlying signal/bug. Validation is folded into the investigator's own propose → validate → iterate loop; there is no separate post-investigation validation phase. Maintenance flows live below.

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

  TR[/"triage_results/&lt;run-id&gt;.json<br/>(residual groups)"/]:::ext
  REG_R[("known_issues/registry.json<br/><i>read-only here</i><br/>filter · investigator context")]:::ext

  subgraph P1["Phase 1 · Plan sweep"]
    direction TB
    S1("curate_all.ts<br/>partition entries by registry hit"):::step
    BR1{has registry entry?}:::branch
    MX(["see Maintenance flow:<br/>QA classified groups"]):::inter
  end

  subgraph P3["Phase 3 · Investigate residual (puller loop · ≤5 concurrent · self-validating)"]
    direction TB
    DLIST[/"dispatch list<br/>residual + promoted entries"/]:::artifact
    PULL("next_investigate_tasks.ts<br/>puller · drift-priority sort"):::step
    AG_INV[["triage-curator-investigator<br/>opus · 200t · residual | promoted<br/>propose → validate → iterate"]]:::agent
    INV_OUT[/"investigate/&lt;gid&gt;.json<br/>proposed_classifier · signal_gap · ariadne_bug<br/>· rejected_members"/]:::artifact
  end

  subgraph P4["Phase 4 · Render classifier source"]
    direction TB
    REND("render_classifier.ts<br/>spec → check_&lt;id&gt;.ts"):::step
    AUTH[/"authored-files.json<br/>{ gid → check_*.ts path }"/]:::artifact
  end

  subgraph P5["Phase 5 · Finalize + ship"]
    direction TB
    FIN("finalize_run.ts<br/>validate_run_coherence · apply_proposals<br/>· AST-parse · sync_permanent_rules"):::step
    SENT[/"finalized.json (sentinel)"/]:::artifact
    BLOG("backlog flight<br/>task_create + link_ariadne_bug_tasks"):::step
    COMM("git commit<br/>AskUserQuestion · current/new/pr/skip"):::step
  end

  REG_W[("registry.json<br/><b>wip writes</b><br/>classifier.kind · observed_count · backlog_task")]:::store
  CORE[("packages/core/.../builtins/<br/>check_&lt;id&gt;.ts + permanent_data")]:::store
  BL[("backlog<br/>signal-gap + Ariadne-bug tasks")]:::store
  FX[["fix-sequencer reconciler<br/>(reads wip + backlog_task)"]]:::downstream
  HUMAN[/"human review<br/>find-promotion-candidates"/]:::human

  TR --> S1
  REG_R -. read .-> S1
  S1 --> BR1
  BR1 -- "no · residual" --> DLIST
  BR1 -- "yes · classified" --> MX

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

  FIN --> SENT
  FIN --> REG_W
  FIN --> CORE
  SENT --> BLOG
  BLOG --> BL
  BLOG -- "{ gid → TASK-N }" --> REG_W
  BLOG --> COMM
  COMM --> FX
  REG_W --> FX
  REG_W -. candidates .-> HUMAN
  HUMAN -. "manual wip → permanent" .-> REG_W

  linkStyle default stroke:#cbd5e1,stroke-width:1.5px
```

**What to look for**: residual groups (the "no · residual" arm of the registry-hit branch in Phase 1) thread Phases 3 → 4 → 5 into a new `check_<id>.ts`, a `wip` row, and a backlog task; four phase bands stacked top-to-bottom (Phase 2's QA loop is omitted — see [_Maintenance flow_](#maintenance-flow-qa-of-already-classified-groups) below); two read-only inputs (`triage_results` + `registry.json`) sit above the phase bands and only feed the steps that touch them; one sub-agent on the primary path (`triage-curator-investigator`, opus, ≤5 concurrent) which owns its own propose → validate → iterate loop (the self-edge on `AG_INV`); one contained back-edge inside Phase 3 (the puller re-pull when investigation output remains); one branch decision gates the forward flow ("has registry entry?" in Phase 1, with the "yes" arm stubbed to the maintenance flow). Cross-response coherence (two responses targeting the same classifier file) is enforced once at the top of Phase 5 by `finalize_run.ts` before any registry mutation; the per-response validator inside Phase 3 cannot see sibling responses. The `rejected_members` field on `INV_OUT` is the investigator's audit trail for entries the chosen classifier cannot cover — a non-empty list signals that the upstream rough-aggregator over-grouped, and those entries naturally re-surface as residuals on the next sweep. The bottom-row stores make the curator's write surface explicit: it is the **single autonomous writer of `wip` rows** — `permanent` (human-edited, via `find-promotion-candidates`) and `fixed` (`fix-sequencer` reconciler) are owned by other writers. Maintenance flow ("QA of already-classified groups" below) and `wip → permanent` human promotion are noted separately so the primary stays a clean top-down flow.

## Maintenance flow: QA of already-classified groups

Maintenance flow: drift detection over groups that already match a registry entry. Fires when `curate_all.ts` finds entries whose `gid` already has a classifier hit — the "yes · classified" arm of the registry-hit branch in the primary flow's Phase 1. Reuses Phase 1's partition step and branch, Phase 3's dispatch list, and Phase 5's finalize step from the primary diagram (not redrawn). The surface this flow exposes that the primary does not is the `triage-curator-qa` sub-agent and its drift signal — outliers above threshold are _promoted back_ into the investigator queue; everything below threshold short-circuits to finalize with a `drift_detected` tag.

```mermaid
flowchart TD
  classDef ext        fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px,color:#0d47a1
  classDef artifact   fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.2px,color:#1b5e20
  classDef agent      fill:#ffe5ec,stroke:#c2185b,stroke-width:1.5px,color:#5a0922
  classDef inter      fill:#f5f5f5,stroke:#616161,stroke-width:1px,color:#212121,stroke-dasharray:3 3
  classDef branch     fill:#ffe0b2,stroke:#e65100,stroke-width:1.5px,color:#bf360c

  TR_M[/"triage_results entries<br/>with registry hit"/]:::ext
  REG_R_M[("registry.json<br/><i>read-only · QA context</i>")]:::ext

  BR1_yes(["registry-hit branch · yes arm<br/>(Phase 1 of primary flow)"]):::inter

  subgraph P2["Phase 2 · QA classified groups (parallel)"]
    direction TB
    AG_QA[["triage-curator-qa<br/>sonnet · 50t · per classified group"]]:::agent
    QA_OUT[/"qa/&lt;gid&gt;.json<br/>outliers · drift notes"/]:::artifact
    BR2{QA outlier rate?}:::branch
  end

  DLIST_P(["dispatch list in primary flow<br/>(promoted entries join residuals)"]):::inter
  FIN_P(["finalize step in primary flow<br/>(writes drift_detected tag)"]):::inter

  TR_M --> BR1_yes
  BR1_yes -- "yes · classified" --> AG_QA
  REG_R_M -. read · QA context .-> AG_QA
  AG_QA --> QA_OUT
  QA_OUT --> BR2
  BR2 -- "outlier ≥ threshold · promote" --> DLIST_P
  BR2 -- "below threshold · drift tag" --> FIN_P

  linkStyle default stroke:#cbd5e1,stroke-width:1.5px
```

**What to look for (maintenance)**: classified groups (the "yes" arm of the registry-hit branch in the primary's Phase 1) get parallel QA from `triage-curator-qa` (sonnet, 50t, per group); the lone branch decision is "QA outlier rate?" with two labelled exits — outliers above threshold re-enter the primary diagram at its dispatch list in Phase 3 (promoting the group back into investigation as if it were residual); everything below threshold re-enters the primary diagram at its finalize step in Phase 5 with a `drift_detected` tag on the existing `wip` row. This flow never authors a new classifier; it only mutates `drift_detected` and `observed_count` on rows the primary flow already wrote. Re-enters the primary diagram at the dispatch list (Phase 3) and the finalize step (Phase 5).

## Maintenance entries

### `wip → permanent` human promotion

Maintenance entry: the operator runs `pnpm find-promotion-candidates`, hand-edits the `status` field of qualifying rows in `registry.json`, then runs `pnpm sync-permanent-rules` to rebuild the bundled core slice. This runs out-of-band of any curator sweep — there is no `curate_all` invocation that produces it. The `REG_W ↔ HUMAN` dotted cycle in the primary diagram visualizes the data flow this loop participates in; the loop itself is invoked separately.

## Authored classifiers

Builtin classifiers live at
`packages/core/src/classify_entry_points/builtins/check_<group_id>.ts`. The
finalize step writes them across the package boundary into core; the CI gate
`pnpm check-permanent-rules` keeps the bundled permanent slice
(`packages/core/src/classify_entry_points/permanent_data.ts`) and the builtins
barrel in sync with the curator's working registry at
`.claude/skills/self-repair-pipeline/known_issues/registry.json`.

Each `check_*.ts` file is a **pure function of its `BuiltinClassifierSpec`** —
the investigator emits the spec, the main agent runs `render_classifier.ts`,
and the rendered source is written to disk. Finalize AST-parses each file
before upserting the registry. Never hand-edit a generated classifier; change
the spec (or flip the registry entry to `status: "permanent"` to lock it) and
re-run the sweep.

Sub-agents:

- `.claude/agents/triage-curator-qa.md` — sonnet, 50 turns
- `.claude/agents/triage-curator-investigator.md` — opus, 200 turns

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
- `~/.ariadne/triage-curator/runs/<run_id>/investigate/<group_id>.session.json` —
  investigator session log, one per dispatch.
- `~/.ariadne/triage-curator/runs/<run_id>/finalized.json` — written by
  finalize; its presence marks the run as curated and makes scan skip it.
