# triage-curator

Offline sweep over completed `self-repair-pipeline` runs. Audits
auto-classified false-positive groups, investigates residuals, produces
classifier + backlog + signal proposals, and commits the result.

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
