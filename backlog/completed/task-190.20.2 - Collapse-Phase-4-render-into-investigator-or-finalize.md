---
id: TASK-190.20.2
title: Collapse Phase 4 render into the investigator loop (or finalize)
status: Done
assignee: []
created_date: "2026-05-24 12:00"
labels:
  - triage-curator
  - simplification
dependencies: []
parent_task_id: TASK-190.20
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

SKILL.md's "Phase 4 — Author source" is one script call:
`render_classifier.ts --out` per response. The transform is deterministic
(spec → TypeScript) and already AST-checked downstream by
`finalize_run.ts`. A standalone phase, with its own `--authored-files`
JSON map juggled by the orchestrator, is more ceremony than the work
warrants.

After 190.19's collapse, Phase 4 is the only remaining "phase" that is
neither sub-agent dispatch nor multi-step state mutation. Folding it
removes a phase boundary, an artefact file, and an orchestrator step.

## Scope

Pick one of two collapse targets — investigator-owned (preferred) or
finalize-owned — and implement it. Document the choice in the task's
Implementation Notes when picking it up.

**Option A (preferred): investigator-owned.** Have
`triage-curator-investigator` call `render_classifier.ts --out` at the
end of its self-validate loop, once its response file is final. The
authored `.ts` path lands alongside the response JSON in
`~/.ariadne/triage-curator/runs/<run-id>/investigate/<id>/`.
`finalize_run.ts` discovers the authored files by scanning the same
directory instead of reading an external map. Drop the
`--authored-files` flag entirely.

**Option B: finalize-owned.** Move the render loop into a
`prepare_authored_files()` helper called inside `finalize_run.ts`. It
already has the response list and AST-checks the output. Drop
`scripts/render_classifier.ts` as a separately-invoked entry point; keep
`src/render_classifier.ts` as the pure renderer.

Either way:

- Drop the `validate_cmd`-style `render_cmd` field from
  `scripts/curate_all.ts`'s dispatch JSON, if present
- Update SKILL.md and the README primary diagram to remove the standalone
  Phase 4 subgraph
- Update `meta.json` flow phase lists accordingly (P1, P3, P5 only)

## Acceptance criteria

<!-- AC:BEGIN -->

- [x] #1 The README primary mermaid diagram no longer has a P4 subgraph;
      rendering is shown either inside the investigator's P3 subgraph or as
      the first action inside P5's `finalize_run.ts` node
- [x] #2 SKILL.md's pipeline table is reduced by one row (no separate
      "Author source" step)
- [x] #3 `--authored-files` JSON map plumbing is gone (no script in
      `.claude/skills/triage-curator/scripts/` produces or consumes it)
- [x] #4 `pnpm test` is green inside `.claude/skills/triage-curator/`
- [x] #5 An end-to-end fixture test exercises the chosen collapse path
      (investigator writes `.ts` and finalize picks it up, OR finalize renders
  - writes + AST-checks in one pass)

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:DESCRIPTION:END -->

Option A keeps the renderer where the spec is authored — closer to the
LLM boundary, easier for the agent to self-verify by reading its own
output. Option B keeps the LLM agent's responsibilities narrower (it
never touches the core builtins path). Decision criterion: whichever
collapse causes the smaller `finalize_run.ts` diff.

### Resolution (2026-05-25) — Option B chosen

Implemented Option B (finalize-owned). Rationale: keeps the LLM
investigator's responsibility narrow (it never invokes `Bash` for
rendering), removes the orchestrator's `--authored-files` map plumbing,
and lets `finalize_run.ts` discover what to render directly from the
investigate responses it already loads.

Changes:

- New helper `src/render_authored_files.ts` exposes the rendering loop:
  iterates responses with non-null `classifier_spec`, renders each via
  `src/render_classifier.ts`, writes to `<builtins_dir>/check_<target>.ts`,
  folds renderer throws into `render_failures`. Pure-ish (single side-effect
  is `fs.writeFile`).
- `scripts/finalize_run.ts` calls `render_authored_files()` before
  `ast_check_authored_files()`, then `apply_proposals()`. The three failure
  collections (`render_failures`, `ast_failures`, `result.failed_authoring`)
  union into the summary's `failed_authoring`.
- `scripts/render_classifier.ts` deleted. `src/render_classifier.ts` (the
  pure renderer) retained — now invoked from the new helper only.
- `--authored-files` CLI flag + the `load_authored_files_map` loader
  removed from `finalize_run.ts`. The orphan-cleanup logic still uses
  `authored_files_raw` (now built in-process from the render step).
- `SKILL.md` pipeline table reduced by one row (Plan / Investigate /
  Finalize / Backlog / Commit).
- `README.md` mermaid: P4 subgraph + the `REND` step + `AUTH` artifact
  removed; the `FIN` node copy now mentions `render_classifier · …` to make
  the inline-render explicit.
- `meta.json` `phases: ["P1","P3","P5"]` (P4 dropped from both `phases` and
  `bypasses`).
- New test `src/render_authored_files.test.ts` — 6 cases: happy path,
  skip-on-null-spec, retargets_to renaming, builtins dir auto-creation,
  renderer-throw → render_failures, idempotency on re-run.
