# triage-curator

Offline sweep over completed `self-repair-pipeline` runs. Audits
auto-classified false-positive groups, investigates residuals, and produces
proposals for classifier, backlog, and signal updates.

## Layout

```
triage-curator/
├── SKILL.md                    # Claude-facing 7-step worksheet
├── README.md                   # This file
├── package.json, tsconfig.json
├── scripts/
│   ├── curate_all.ts                  # Default entry: plan the full sweep
│   ├── curate_run.ts                  # Phased plan/finalize for one run
│   ├── promote_qa_to_investigate.ts   # Step 3: route mis-matching QA outputs to the investigator
│   ├── get_qa_context.ts              # Hydrates the sonnet QA agent
│   ├── get_investigate_context.ts     # Hydrates the opus investigator (residual + --promoted modes)
│   └── render_classifier.ts           # Step 4.5: render a BuiltinClassifierSpec to TypeScript (stdout)
├── src/
│   ├── paths.ts, types.ts
│   ├── compute_wip_counts.ts          # Registry → wip group example counts
│   ├── source_excerpt.ts              # Shared source-excerpt reader + SAMPLE_SIZE
│   ├── curation_state.ts       (+ .test.ts)
│   ├── scan_runs.ts            (+ .test.ts)
│   ├── detect_drift.ts         (+ .test.ts)   # 15 % outlier-rate / group-size → sticky tag
│   ├── promote_to_investigate.ts (+ .test.ts) # 40 % outlier-rate / sample-size → re-investigate
│   ├── session_log.ts          (+ .test.ts)   # Parse + cross-check investigator session logs
│   ├── render_classifier.ts    (+ .test.ts)   # Pure render(spec) → TypeScript module body
│   └── apply_proposals.ts      (+ .test.ts)   # Validate + apply opus output
└── reference/
    └── signal_inventory.md     # Six signal categories + predicate DSL
```

## Authored classifiers

Builtin classifiers produced by this sweep live at
`.claude/skills/self-repair-pipeline/src/auto_classify/builtins/check_<group_id>.ts`.
Each file is a **pure function of its `BuiltinClassifierSpec`** — the
investigator emits the spec, the main agent runs `render_classifier.ts`,
and the rendered source is written to disk. Finalize AST-parses each file
before upserting the registry. Never hand-edit a generated classifier;
change the spec (or flip the registry entry to `status: "permanent"` to
lock it) and re-run the sweep.

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
- `~/.ariadne/triage-curator/runs/<run_id>/{qa,investigate,investigate_promoted}/*.json` —
  per-group sub-agent output (inputs to `curate_run --phase finalize`).
  `investigate/` holds residual-mode dispatches (no prior registry entry);
  `investigate_promoted/` holds re-investigations of classifiers QA found
  mis-matching.
- `~/.ariadne/triage-curator/runs/<run_id>/{investigate,investigate_promoted}/<group_id>.session.json` —
  investigator session log, one per dispatch. Finalize folds
  success/failure/blocked counts into the summary.
