# triage-curator

Offline sweep over completed `self-repair-pipeline` runs. Audits
auto-classified false-positive groups, investigates residuals, and produces
proposals for classifier, backlog, and signal updates.

## Layout

```
triage-curator/
├── SKILL.md                    # Claude-facing orchestration prose
├── README.md                   # This file
├── package.json, tsconfig.json
├── scripts/
│   ├── curate_all.ts           # Default entry: plan the full sweep
│   ├── curate_run.ts           # Phased plan/finalize for one run
│   ├── get_qa_context.ts       # Hydrates the sonnet QA agent
│   └── get_investigate_context.ts  # Hydrates the opus investigator
├── src/
│   ├── paths.ts, types.ts
│   ├── compute_wip_counts.ts   # Registry → wip group example counts
│   ├── curation_state.ts  (+ .test.ts)
│   ├── scan_runs.ts       (+ .test.ts)
│   ├── detect_drift.ts    (+ .test.ts)   # 15 % outlier-rate threshold
│   └── apply_proposals.ts (+ .test.ts)   # Validate + apply opus output
└── reference/
    └── signal_inventory.md     # Six signal categories + predicate DSL
```

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

- `~/.ariadne/triage-curator/state.json` — rollup (`curated_runs[]`).
- `~/.ariadne/triage-curator/runs/<run_id>/{qa,investigate}/*.json` —
  per-group sub-agent output (inputs to `curate_run --phase finalize`).
