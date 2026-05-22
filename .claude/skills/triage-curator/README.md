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

**Primary trigger**: a residual group in a freshly published `triage_results/<run-id>.json` that has no matching registry entry; this diagram traces that flow from entry through to the `wip` row in `registry.json`, the `check_<id>.ts` written to core builtins, and the backlog task filed for the underlying signal/bug. Maintenance flows live below.

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

  subgraph P3["Phase 3 · Investigate residual (puller loop · ≤5 concurrent)"]
    direction TB
    DLIST[/"dispatch list<br/>residual + promoted entries"/]:::artifact
    PULL("next_investigate_tasks.ts<br/>puller · drift-priority sort"):::step
    AG_INV[["triage-curator-investigator<br/>opus · 200t · residual | promoted"]]:::agent
    INV_OUT[/"investigate/&lt;gid&gt;.json<br/>proposed_classifier · signal_gap · ariadne_bug"/]:::artifact
  end

  subgraph P4["Phase 4 · Validate + render classifier"]
    direction TB
    VAL("validate_responses.ts"):::step
    BR3{validation.ok?}:::branch
    MX2(["see Maintenance entries:<br/>validator re-dispatch"]):::inter
    REND("render_classifier.ts<br/>spec → check_&lt;id&gt;.ts"):::step
    AUTH[/"authored-files.json<br/>{ gid → check_*.ts path }"/]:::artifact
  end

  subgraph P5["Phase 5 · Finalize + ship"]
    direction TB
    FIN("finalize_run.ts<br/>apply_proposals · sync_permanent_rules"):::step
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
  AG_INV --> INV_OUT
  INV_OUT -. "remaining &gt; 0 · re-pull" .-> PULL

  INV_OUT --> VAL
  VAL --> BR3
  BR3 -- "ok=false" --> MX2
  BR3 -- "ok=true" --> REND
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

**What to look for**: residual groups (the `no` arm of `BR1`) thread Phases 3 → 4 → 5 into a new `check_<id>.ts`, a `wip` row, and a backlog task; four phase bands stacked top-to-bottom (Phase 2's QA loop is omitted — see [_Maintenance flow_](#maintenance-flow-qa-of-already-classified-groups) below); two read-only inputs (`triage_results` + `registry.json`) sit on the left rail and only feed the steps that touch them; one sub-agent on the primary path (`triage-curator-investigator`, opus, ≤5 concurrent); one contained back-edge inside Phase 3 (`INV_OUT → PULL`, puller re-pull); two branch decisions gate the forward flow (`has registry entry?` with `yes` stubbed to the maintenance flow, and `validation.ok?` with `false` stubbed to a maintenance entry). The bottom-row stores make the curator's write surface explicit: it is the **single autonomous writer of `wip` rows** — `permanent` (human-edited, via `find-promotion-candidates`) and `fixed` (`fix-sequencer` reconciler) are owned by other writers. Maintenance flows (`QA of already-classified groups` below) and self-triage entries (`validator re-dispatch`; `wip → permanent` human promotion) are noted separately so the primary stays a clean top-down flow.

## Maintenance flow: QA of already-classified groups

Maintenance flow: drift detection over groups that already match a registry entry. Fires when `curate_all.ts` finds entries whose `gid` already has a classifier hit — the `yes · classified` arm of `BR1` in the primary diagram. Reuses Phase 1 (`S1`, `BR1`), Phase 3's dispatch list (`DLIST`), and Phase 5's finalize step (`FIN`) from the primary diagram (not redrawn). The surface this flow exposes that the primary does not is the `triage-curator-qa` sub-agent and its drift signal — outliers above threshold are _promoted back_ into the investigator queue; everything below threshold short-circuits to finalize with a `drift_detected` tag.

```mermaid
flowchart TD
  classDef ext        fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px,color:#0d47a1
  classDef artifact   fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.2px,color:#1b5e20
  classDef agent      fill:#ffe5ec,stroke:#c2185b,stroke-width:1.5px,color:#5a0922
  classDef inter      fill:#f5f5f5,stroke:#616161,stroke-width:1px,color:#212121,stroke-dasharray:3 3
  classDef branch     fill:#ffe0b2,stroke:#e65100,stroke-width:1.5px,color:#bf360c

  TR_M[/"triage_results entries<br/>with registry hit"/]:::ext
  REG_R_M[("registry.json<br/><i>read-only · QA context</i>")]:::ext

  BR1_yes(["BR1 yes-arm<br/>(in primary diagram)"]):::inter

  subgraph P2["Phase 2 · QA classified groups (parallel)"]
    direction TB
    AG_QA[["triage-curator-qa<br/>sonnet · 50t · per classified group"]]:::agent
    QA_OUT[/"qa/&lt;gid&gt;.json<br/>outliers · drift notes"/]:::artifact
    BR2{QA outlier rate?}:::branch
  end

  DLIST_P(["DLIST in primary diagram<br/>(promoted entries join residuals)"]):::inter
  FIN_P(["FIN in primary diagram<br/>(drift_detected tag on existing wip row)"]):::inter

  TR_M --> BR1_yes
  BR1_yes -- "yes · classified" --> AG_QA
  REG_R_M -. read · QA context .-> AG_QA
  AG_QA --> QA_OUT
  QA_OUT --> BR2
  BR2 -- "outlier ≥ threshold · promote" --> DLIST_P
  BR2 -- "below threshold · drift tag" --> FIN_P

  linkStyle default stroke:#cbd5e1,stroke-width:1.5px
```

**What to look for (maintenance)**: classified groups (the `yes` arm of `BR1` in the primary) get parallel QA from `triage-curator-qa` (sonnet, 50t, per group); the lone branch decision is `QA outlier rate?` with two labelled exits — outliers above threshold re-enter the primary diagram at `DLIST` (promoting the group back into investigation as if it were residual); everything below threshold re-enters the primary diagram at `FIN` with a `drift_detected` tag on the existing `wip` row. This flow never authors a new classifier; it only mutates `drift_detected` and `observed_count` on rows the primary flow already wrote. Re-enters the primary diagram at `DLIST` (Phase 3) and `FIN` (Phase 5).

## Maintenance entries

Self-triage loops factored out of the primary diagram because their back-edges would otherwise flatten the primary's vertical layout (see [skill-diagrammer · anatomy.md → Layout pitfalls](../../../../.claude/skills/skill-diagrammer/anatomy.md#layout-pitfalls)).

### Validator re-dispatch

Maintenance entry: when `validate_responses.ts` rejects an investigator's proposed classifier spec (the `BR3 = ok=false` arm in the primary, stubbed via `MX2`), the gid plus per-error feedback notes are appended back to the dispatch list; the puller picks the gid up again and re-runs `triage-curator-investigator` with the failure feedback in context. The loop continues until validation passes (control re-enters the primary flow at `BR3 = ok=true → REND`) or the puller hits a retry limit.

```mermaid
flowchart TD
  classDef artifact   fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.2px,color:#1b5e20
  classDef inter      fill:#f5f5f5,stroke:#616161,stroke-width:1px,color:#212121,stroke-dasharray:3 3

  BR3_P(["BR3 ok=false<br/>(in primary diagram, Phase 4)"]):::inter
  FAIL[/"validation failure feedback<br/>{ gid → error notes }"/]:::artifact
  DLIST_P(["DLIST in primary diagram<br/>(Phase 3 — re-queued for puller)"]):::inter
  AG_INV_P(["AG_INV in primary diagram<br/>(re-runs investigator with feedback)"]):::inter

  BR3_P --> FAIL
  FAIL --> DLIST_P
  DLIST_P --> AG_INV_P

  linkStyle default stroke:#cbd5e1,stroke-width:1.5px
```

**What to look for (maintenance entry)**: three anchor `inter` nodes (`BR3`, `DLIST`, `AG_INV`) match the primary diagram by Mermaid ID — the loop closes through them. One new artifact (`validation failure feedback`) is unique to this entry and is not present in the primary. Re-enters the primary diagram at `DLIST` (Phase 3) on the failure arm, and rejoins the primary's `BR3 → REND` arm only after validation eventually passes.

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
