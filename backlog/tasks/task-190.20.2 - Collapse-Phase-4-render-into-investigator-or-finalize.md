---
id: TASK-190.20.2
title: Collapse Phase 4 render into the investigator loop (or finalize)
status: To Do
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

- [ ] #1 The README primary mermaid diagram no longer has a P4 subgraph;
      rendering is shown either inside the investigator's P3 subgraph or as
      the first action inside P5's `finalize_run.ts` node
- [ ] #2 SKILL.md's pipeline table is reduced by one row (no separate
      "Author source" step)
- [ ] #3 `--authored-files` JSON map plumbing is gone (no script in
      `.claude/skills/triage-curator/scripts/` produces or consumes it)
- [ ] #4 `pnpm test` is green inside `.claude/skills/triage-curator/`
- [ ] #5 An end-to-end fixture test exercises the chosen collapse path
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
