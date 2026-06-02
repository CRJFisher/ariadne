# plan

Offline sweep over completed `triage` runs. Consumes the v5
`triage_results/<run-id>.json` published by triage (schema owned by
`@ariadnejs/skill-protocol`) — specifically `novel_issues[]` (one row per
false-positive entry named by the per-entry investigator) and
`classifier_regressions[]` (in-flight drift flags the per-entry investigator
raised when a wip classifier failed to match an entry it should have caught).

The sweep is **planning-only**: it reads the registry and emits proposals. The
deferred actuator applies them. For each novel issue with no registry row yet,
`plan` dispatches a single `plan-strategist` (opus) to author a
`BuiltinClassifierSpec` plus an Ariadne-bug backlog proposal. Classifier-regression
flags and already-registered novel issues are surfaced as drift-evidence and
observed-stat proposals for the actuator. The skill never writes the registry.

## Where this fits

`plan` is the middle link in the self-healing chain: triage (sense) → plan
(classify) → actuator (actuate). For the broader chain see
[triage → Self-healing pipeline](../triage/README.md#self-healing-pipeline).

A novel issue whose `id` does not match a registry row dispatches an
investigator; `yes · wip/permanent` matches surface as observed-stat bumps;
`yes · fixed` matches surface as resurfacings for human review (the reconciler
owns the `fixed` write boundary). Validation is folded into the investigator's
own propose → validate → iterate loop, scoped to a single response at a time.

Write boundaries live in `.claude/rules/classifier-lifecycle.md`: `plan` reads
the registry; the actuator writes `wip` rows and drift evidence; the
fix-sequencer reconciler writes `fixed`; a human flips `permanent`.

## Authored classifiers

Builtin classifiers live at
`packages/core/src/classify_entry_points/builtins/check_<id>.ts`. Each
`check_*.ts` file is a pure function of its `BuiltinClassifierSpec` — the
investigator emits the spec; the deferred actuator renders it to source, AST-parses
it, and upserts the registry. The actuator keeps the bundled permanent slice
(`packages/core/src/classify_entry_points/permanent_data.ts`) and the builtins
barrel in sync with the source registry at
`.claude/skills/triage/known_issues/registry.json`.

Sub-agents:

- `.claude/agents/plan-strategist.md` — opus, 200 turns, primary path
  (promote-novel)

## Run the sweep

```bash
# From the repo root
node --import tsx .claude/skills/plan/scripts/curate_all.ts
```

Or via Claude: `/plan [--project <name>] [--last <n>] [--run <path>]`.

## Tests

```bash
cd .claude/skills/plan
pnpm test
```

## State files

- `~/.ariadne/triage-curator/runs/<run_id>/investigate/*.json` —
  per-novel-issue investigator output.
- `~/.ariadne/triage-curator/runs/<run_id>/investigate/<novel_issue_id>.session.json` —
  investigator session log, one per dispatch.
