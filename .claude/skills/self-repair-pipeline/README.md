# Self-Repair Pipeline

Triage pipeline for entry point analysis: detect false positives and classify root causes.

Each invocation produces a self-contained run under `triage_state/<project>/runs/<run-id>/`. Run-id format is `<short-commit>-<iso-ts>` (or `nogit-<iso-ts>` for non-git projects). Re-running at the same target commit reuses prior `confirmed_unreachable` verdicts via the TP cache (skip with `--no-reuse-tp`). The classifier registry at `known_issues/registry.json` is the canonical registry, updated by the `triage-curator` skill. A generated `permanent`-status slice is bundled into `@ariadnejs/core` at `packages/core/src/classify_entry_points/permanent_data.ts`, so library consumers of `Project.get_call_graph()` filter framework noise without depending on this skill. Regenerate the slice with `pnpm sync-permanent-rules` (run pre-commit on registry edits and verified in CI).

Orthogonally, the `detect_dead_code` Stop hook (`.claude/hooks/detect_dead_code.ts`) reads a human-maintained whitelist at `~/.ariadne/self-repair-pipeline/known_entrypoints/<package>.json` to guard against dead code introduced during coding sessions. That whitelist is not read or written by any script in this skill — see [SKILL.md → Dead-code guardrail](SKILL.md#dead-code-guardrail).

## Self-healing pipeline

This skill is the first link in a three-skill chain: SRP (sense) → triage-curator (classify) → fix-sequencer (actuate). What makes it _self-healing_ rather than a linear pipeline is two durable surfaces that survive between runs — `registry.json` (what we learned) and the target repo (what we changed). Both are read on the _next_ SRP run; the two red dotted edges below are the loop closure.

```mermaid
flowchart LR
  classDef step      fill:#fff8e1,stroke:#b58900,stroke-width:1.8px,color:#5d4037
  classDef artifact  fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.5px,color:#1b5e20
  classDef store     fill:#ede7f6,stroke:#4527a0,stroke-width:1.8px,color:#311b92

  SRP(["self-repair-pipeline · <i>sense</i><br/>find unreachable funcs"]):::step
  TR[/"triage_results<br/>(per-run handoff)"/]:::artifact
  CUR(["triage-curator · <i>classify</i><br/>author classifier rule<br/>file backlog task"]):::step
  FS(["fix-sequencer · <i>actuate</i><br/>cluster · sign off · ship fix"]):::step

  REG[("registry.json<br/><b>what we learned</b>")]:::store
  REPO[("target repo<br/><b>what we changed</b>")]:::store

  SRP --> TR --> CUR --> FS

  CUR -- "writes wip rows" --> REG
  FS  -- "fix(task_id): commits" --> REPO

  REG  -. "next run: filter known issues" .-> SRP
  REPO -. "next run: scan commits → flip wip → fixed" .-> REG

  linkStyle default stroke:#cbd5e1,stroke-width:1.6px
  linkStyle 5 stroke:#ef5350,stroke-width:2.4px,stroke-dasharray:6 4
  linkStyle 6 stroke:#ef5350,stroke-width:2.4px,stroke-dasharray:6 4
```

**Reading the diagram**: three skills feed forward (sense → classify → actuate); two durable surfaces (registry + target repo) survive between runs and feed the next iteration; the two red dotted edges are the loop closure — both fire on the _next_ SRP invocation, not synchronously. Detail hidden here (covered in the per-step diagrams below + sibling READMEs): registry's lifecycle states and writers, the worker / reconciler / git-log scanner as distinct nodes, sub-agent fleets, the per-cluster sign-off branch, all other persistent stores.

## Pipeline Flow

This skill's internal flow is a top-down 5-phase pipeline. Read-only stores sit on a left rail and only feed the phases that touch them; the published `triage_results/<run-id>.json` fans out to three downstream consumers and (on the _next_ same-commit run) becomes the TP-cache source.

```mermaid
flowchart TD
  classDef ext        fill:#e3f2fd,stroke:#1565c0,stroke-width:1.5px,color:#0d47a1
  classDef store      fill:#ede7f6,stroke:#4527a0,stroke-width:1.5px,color:#311b92
  classDef artifact   fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.2px,color:#1b5e20
  classDef step       fill:#fff8e1,stroke:#b58900,stroke-width:1.5px,color:#5d4037
  classDef agent      fill:#ffe5ec,stroke:#c2185b,stroke-width:1.5px,color:#5a0922
  classDef inter      fill:#f5f5f5,stroke:#616161,stroke-width:1px,color:#212121,stroke-dasharray:3 3
  classDef published  fill:#a8e6a3,stroke:#0e5510,stroke-width:3px,color:#062c08
  classDef downstream fill:#e5e7eb,stroke:#374151,stroke-width:1px,color:#111827

  CORE[/"@ariadnejs/core API<br/>load_project · trace_call_graph<br/>extract_entry_point_diagnostics<br/>enrich_call_graph"/]:::ext

  REG[("known_issues/registry.json<br/><i>read-only here</i><br/>permanent + wip rules")]:::store
  PRIOR[("prior triage_results/<br/>&lt;run-id&gt;.json<br/><i>TP cache source</i>")]:::store

  subgraph P1["Phase 1 · Detect"]
    direction TB
    S1("detect_entrypoints.ts"):::step
    A1[/"analysis_output/&lt;p&gt;/<br/>detect_entrypoints/&lt;ts&gt;.json"/]:::artifact
  end

  subgraph P2["Phase 2 · Prepare"]
    direction TB
    S2("prepare_triage.ts<br/>enrich_call_graph · lifecycle filter<br/>derive TP cache · top-N by tree_size"):::step
    I_AUTO(["auto-classified<br/>(predicate/builtin hit)"]):::inter
    I_TP(["TP-cache reuse<br/>(same commit)"]):::inter
    I_RES(["residual<br/>(llm-triage)"]):::inter
    A2[/"runs/&lt;run-id&gt;/<br/>manifest.json · triage.json · LATEST"/]:::artifact
  end

  subgraph P3["Phase 3 · Triage Loop (worker pool, N=5)"]
    direction TB
    S3("get_next_triage_entry.ts<br/>+ merge_results · dispense/absorb cycle"):::step
    AG3[["triage-investigator<br/>sonnet · parallel"]]:::agent
    A3[/"results/&#123;idx&#125;.json"/]:::artifact
  end

  subgraph P4["Phase 4 · Aggregate (3 passes)"]
    direction TB
    S4a("prepare_aggregation_slices.ts"):::step
    A4a[/"aggregation/slices/<br/>slice_n.json"/]:::artifact
    AG4a[["rough-aggregator<br/>sonnet · per slice"]]:::agent
    A4b[/"aggregation/pass1/<br/>slice_n.output.json"/]:::artifact
    S4b("merge_rough_groups.ts<br/>union per-slice groups by id<br/>→ canonical group list"):::step
    A4c[/"aggregation/pass2/input.json"/]:::artifact
    AG4b[["group-investigator<br/>opus · per group"]]:::agent
    A4d[/"aggregation/pass2/<br/>&lt;gid&gt;_investigation.json"/]:::artifact
    S4c("finalize_aggregation.ts<br/>apply confirm/reject verdicts<br/>· reallocate rejected entries"):::step
  end

  subgraph P5["Phase 5 · Finalize"]
    direction TB
    S5("finalize_triage.ts<br/>build_finalization_output · seal manifest"):::step
    PUB[/"analysis_output/&lt;p&gt;/<br/>triage_results/&lt;run-id&gt;.json<br/>schema v3"/]:::published
  end

  CUR[["triage-curator<br/>(novel-group investigation)"]]:::downstream
  FX[["fix-sequencer reconciler<br/>(via prepare_triage)"]]:::downstream
  DIF[["diff_runs.ts<br/>(regression audit)"]]:::downstream

  CORE --> S1
  S1 --> A1 --> S2
  REG -. "read · lifecycle filter" .-> S2
  PRIOR -. "read · TP cache" .-> S2

  S2 --> I_AUTO
  S2 --> I_TP
  S2 --> I_RES
  I_AUTO --> A2
  I_TP --> A2
  I_RES --> A2

  A2 --> S3
  S3 --> AG3 --> A3
  A3 -- "merge_results" --> S3
  S3 -- "all pending drained" --> S4a

  S4a --> A4a --> AG4a --> A4b --> S4b --> A4c --> AG4b --> A4d --> S4c
  S4c --> S5 --> PUB

  PUB --> CUR
  PUB --> FX
  PUB --> DIF

  PUB -. "next run · TP cache" .-> PRIOR

  linkStyle default stroke:#cbd5e1,stroke-width:1.5px
  linkStyle 29 stroke:#ef5350,stroke-width:2.2px,stroke-dasharray:6 4
```

**What to look for**: five phase bands stacked top-to-bottom (strict reading order); two read-only stores (registry, prior triage_results) sit outside the phase bands — this skill **never** writes the registry (lifecycle contract); three Phase-2 buckets (auto / TP / residual) determine whether an entry skips the triage loop entirely; two sub-agent fleets in Phase 4 (rough-aggregator over slices, then group-investigator per canonical group). The red dotted edge is the only backward arrow: today's `triage_results` becomes tomorrow's TP cache.

## Sub-Agent Summary

| Agent               | Model  | Multiplicity              | Purpose                                                                                |
| ------------------- | ------ | ------------------------- | -------------------------------------------------------------------------------------- |
| triage-investigator | Sonnet | 1 per entry (worker pool) | Fetch own context via `get_entry_context.ts`, determine if Ariadne missed real callers |
| rough-aggregator    | Sonnet | 1 per slice               | Group false-positive entries by semantic similarity of root cause                      |
| group-investigator  | Opus   | 1 per group               | Verify per-entry group membership using source code and Ariadne MCP evidence           |

## Key Modules

See [SKILL.md → Architecture: Key Modules](SKILL.md#architecture-key-modules).
