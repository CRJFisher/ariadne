# Self-Repair Pipeline

Triage pipeline for entry point analysis: detect false positives, classify root causes, and update the known-entrypoints registry.

## Pipeline Flow

```mermaid
flowchart TD
    START(["Invoke skill with target"]) --> RESOLVE

    %% ── Phase 1: Detect ─────────────────────────────────────
    subgraph P1["Phase 1: Detect"]
        RESOLVE[/"Resolve analysis target<br/>(config · path · github)"/]
        RESOLVE --> DETECT(["detect_entrypoints.ts"])
        DETECT --> ANALYSIS[("analysis_output/{project}/<br/>detect_entrypoints/{ts}.json")]
    end

    ANALYSIS --> PREPARE

    %% ── Phase 2: Prepare Triage ──────────────────────────────
    subgraph P2["Phase 2: Prepare Triage"]
        PREPARE(["prepare_triage.ts"]) --> LOAD_REG["Load known-entrypoints registry"]
        LOAD_REG --> CLASSIFY{"Classify<br/>each entry"}
        CLASSIFY -->|"Registry match"| KNOWN_UR["known-unreachable<br/>(completed immediately)"]
        CLASSIFY -->|"No match"| LLM_TRIAGE["llm-triage<br/>(pending, with diagnostics)"]
        KNOWN_UR --> STATE
        LLM_TRIAGE --> STATE
        STATE[("triage_state/{project}/{project}_triage.json")]
    end

    STATE --> LOOP_ENTRY

    %% ── Phase 3: Triage Loop ─────────────────────────────────
    subgraph P3["Phase 3: Triage Loop (continuous worker pool)"]
        LOOP_ENTRY(["get_next_triage_entry.ts"]) --> POOL_CHECK{"Pending<br/>entries?"}
        POOL_CHECK -->|"Yes — one entry"| CONTEXT["get_entry_context.ts<br/>(per entry)"]
        CONTEXT --> INVESTIGATORS[/"triage-investigator<br/>(run_in_background: true)<br/>N in flight"/]
        INVESTIGATORS -->|"on completion"| LOOP_ENTRY
        POOL_CHECK -->|"None &amp; no in-flight — phase=complete"| AGG_START
    end

    %% ── Phase 4: Aggregate ───────────────────────────────────
    subgraph P4["Phase 4: Aggregate"]
        AGG_START(["prepare_aggregation_slices.ts"])
        AGG_START --> ROUGH[/"rough-aggregator x slice<br/>(run_in_background: true)"/]
        ROUGH --> MERGE_ROUGH(["merge_rough_groups.ts"])
        MERGE_ROUGH --> PASS3_INPUT[("pass3/input.json")]
        PASS3_INPUT --> INVESTIGATORS2[/"group-investigator x group<br/>(Opus · run_in_background: true)"/]
        INVESTIGATORS2 --> FINALIZE_AGG(["finalize_aggregation.ts"])
    end

    FINALIZE_AGG --> FINALIZE

    %% ── Phase 5: Finalize ────────────────────────────────────
    subgraph P5["Phase 5: Finalize"]
        FINALIZE(["finalize_triage.ts"])
        FINALIZE --> PARTITION["Partition: confirmed-unreachable /<br/>false-positive groups"]
        PARTITION --> UPD_REG["Update known-entrypoints registry"]
        UPD_REG --> SAVE["Save results to<br/>analysis_output/{project}/triage_results/"]
    end

    SAVE --> DONE(["Pipeline complete"])

    %% ── Styling ──────────────────────────────────────────────
    classDef script fill:#e1f5fe,stroke:#0288d1,color:#01579b
    classDef agent fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef decision fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef data fill:#e8f5e9,stroke:#388e3c,color:#1b5e20

    class DETECT,PREPARE,FINALIZE,LOOP_ENTRY,AGG_START,MERGE_ROUGH,FINALIZE_AGG script
    class INVESTIGATORS,INVESTIGATORS2,ROUGH agent
    class CLASSIFY,POOL_CHECK decision
    class ANALYSIS,STATE,PASS3_INPUT data
```

## Sub-Agent Summary

| Agent               | Model  | Multiplicity              | Purpose                                                                                |
| ------------------- | ------ | ------------------------- | -------------------------------------------------------------------------------------- |
| triage-investigator | Sonnet | 1 per entry (worker pool) | Fetch own context via `get_entry_context.ts`, determine if Ariadne missed real callers |
| rough-aggregator    | Sonnet | 1 per slice               | Group false-positive entries by semantic similarity of root cause                      |
| group-investigator  | Opus   | 1 per group               | Verify per-entry group membership using source code and Ariadne MCP evidence           |

## Key Modules

See [SKILL.md → Architecture: Key Modules](SKILL.md#architecture-key-modules).
