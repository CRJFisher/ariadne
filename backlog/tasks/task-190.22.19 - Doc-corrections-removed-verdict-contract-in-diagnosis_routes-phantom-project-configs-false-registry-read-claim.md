---
id: TASK-190.22.19
title: >-
  Doc corrections: removed verdict contract in diagnosis_routes, phantom project
  configs, false registry-read claim
status: Done
assignee: []
created_date: "2026-06-09 20:06"
labels:
  - self-repair
  - docs
dependencies: []
parent_task_id: TASK-190.22
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

A doc-vs-code audit found claims that would actively mislead an agent following the skills. Two break an agent outright; the rest erode trust in the docs as the canonical source. All fixes are doc-only (canonical, self-contained style — present tense, no historical framing).

## Agent-breaking (must fix)

1. **`triage/reference/diagnosis_routes.md` (~27–39) documents a removed output contract.** It tells the investigator each entry produces a `TriageEntryResult` with `ariadne_correct`, `group_id` ("confirmed-unreachable"/"barrel-reexport"), `root_cause`, `reasoning`. The actual contract is the four-arm `TriageVerdict` union (`tp`/`fp-novel`/`fp-classifier-regression`/`uncertain`, `triage/src/verdict/triage_verdict.ts`) written to `results/<entry_index>.json`; an investigator emitting the documented shape halts finalize (strict parse). Also at ~line 25: hints exist for three diagnoses, not four (`no-textual-callers` falls back to `GENERIC_HINTS`), and there is no per-diagnosis "classification hint".

2. **`triage/SKILL.md` (~71–78, 126) "Available project configs" table points at files that do not exist.** `~/.ariadne/triage-entrypoints/project_configs/` is absent on disk and no configs are tracked in the repo (the only copies sit in a stale worktree under the removed skill name). Either commit real configs to a tracked location and point the table there, or delete the table and document how to author a config.

## Wrong claims (fix in the same pass)

3. **Plan sweep does not read the registry.** `plan/SKILL.md` (~200), `.claude/rules/classifier-lifecycle.md` ("`plan` reads it to ground its planning"), and `plan/README.per-step.mmd` (registry→Pass-A "read · dedup/grounding" edge) all claim Pass A reads `registry.json`. No sweep script loads it; dedup uses `backlog/tasks/*.md` frontmatter (`plan/src/store/backlog_dedup.ts`). Only the on-demand `generate_impact_report.ts`/`render_unsupported_features.ts` read the registry. Fix all three surfaces; re-render the SVG from the .mmd (the mermaid-pre-render pattern).

4. **`classifier-lifecycle.md` names `fixed_commit`/`fixed_in_run` fields that exist in no schema** (`KnownIssue` in `packages/types/src/known_issues.ts` has neither). Either add the fields to the schema or stop naming them. Also: "its `novel_issue.id` appears again in a later run" is not a stable identity (ids are positional `novel-<entry_index>`); reference `member_symbol` instead. And the enforcement-scan roots are understated — `registry_writers.test.ts` walks all of `.claude/skills` and all of `packages`.

5. **`triage/SKILL.md` Phase 2 options (~134–148) omit `--config <path>`**, which `prepare_triage.ts` accepts and uses for `folders`/`exclude` scoping — omitting it re-indexes the full tree, a different classification input than detect saw.

## Smaller accuracy fixes (same pass, all verified)

- `prioritize/SKILL.md` (~54–56): dry-run output carries only `{id, backlog_task, path}` — not `fault_area`/`core_fix_effort`; tell the user to read `~/.ariadne/plan/tasks/<id>.json`.
- `plan/SKILL.md` (~94): `reconcile_plan.ts` also accepts `--strategist <id>` (undocumented).
- `triage/README.md` (~21, 25): "5-phase" → four phases (matches SKILL.md and the diagram).
- `triage/SKILL.md:336`: constant is `TRIAGE_RESULTS_SCHEMA_VERSION`; `:374`: module is `src/store/paths.ts` and the CLI helpers live in `src/cli_args.ts`.
- `plan/README.per-step.mmd`: diagram predates 190.22.14 — add the membership review (`StrategistPlan.membership`), the override store (`~/.ariadne/plan/membership_overrides.json`, Pass C → Pass A loop), and the sweep manifest; drop the "(190.22.11)" task-id label.
- `.claude/agents/triage-investigator.md:3`: "Early-exits only on a registry match (`fp-classifier-regression`)" mislabels the verdict — a registry match is the Phase-2 auto-classify path; the body has no early-exit instruction.

## Coordination

Curator-vocabulary prose fixes are owned by TASK-190.22.18 — do not duplicate them here.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 diagnosis_routes.md describes the four-arm TriageVerdict contract exactly as parse_triage_verdict enforces it, and its hint claims match get_entry_context.ts
- [x] #2 The project-configs section of triage/SKILL.md points only at paths that exist (tracked configs or authoring instructions); no reference to ~/.ariadne/triage-entrypoints/project_configs remains
- [x] #3 No doc or diagram claims the plan sweep reads registry.json; plan/README.per-step.mmd reflects the membership-override loop and sweep manifest, and its SVG is re-rendered from the .mmd
- [x] #4 classifier-lifecycle.md names only fields that exist in the KnownIssue schema (or the schema gains the fields), uses a stable resurfacing identity, and states the actual enforcement-scan roots
- [x] #5 All remaining listed accuracy fixes (prepare_triage --config, prioritize dry-run fields, --strategist flag, phase count, constant/module names, investigator description) are applied, in canonical present-tense style with no historical framing
<!-- AC:END -->

## Implementation Notes

## High-level summary

A doc-vs-code audit had flagged claims that would mislead an agent following the
self-healing pipeline skills. This pass corrects them at the source so the docs
read as the authoritative description of the system as it currently is. Every
change is doc-only (one SVG re-render and two stale code comments aside); each
correction was first verified against the live code it describes.

The two agent-breaking claims are gone. `triage/reference/diagnosis_routes.md`
now describes the real investigator output contract — the four-arm `TriageVerdict`
union (`tp` / `fp-novel` / `fp-classifier-regression` / `uncertain`), each arm's
fields, and the shared `member_evidence`, written as raw JSON to
`results/<entry_index>.json` and strict-parsed at finalize (a shape violation
throws and halts the run). The removed `TriageEntryResult` / `ariadne_correct` /
`confirmed-unreachable` shape is excised. `triage/SKILL.md` no longer advertises a
table of project configs that ship with the repo: none do. The configs are
user-authored runtime artifacts, so the skill now documents how to author one and
pass it via `--config <path>`, keeping the `project_configs/<name>.json` path only
as authoring instructions.

The false "the plan engine reads the registry" claim is removed from every surface
that carried it — `plan/SKILL.md`, `triage/README.md`, `classifier-lifecycle.md`,
and the per-step diagram. The plan sweep's only dedup signal is `backlog/tasks/*.md`
frontmatter; the registry is read solely by `triage`. The per-step diagram drops
the phantom registry→Pass-A edge and instead shows what Pass A actually consumes
and produces: the membership-override store (written by Pass C, read by Pass A — the
re-routing loop) and the sweep manifest (written by Pass A, read by Pass C). The
SVG is re-rendered from the `.mmd` via the mermaid pre-render pattern and its hash
stamp verified.

`classifier-lifecycle.md` is brought back in line with the `KnownIssue` schema: the
`fixed_commit` / `fixed_in_run` fields it named exist in no schema and are dropped —
`status: "fixed"` is the only recorded transition, with the landed fix linked
through `backlog_task` plus the target repo's git log. Resurfacing identity now
references the stable `member_symbol` `(file_path, name, kind, start_line)` rather
than the positional `novel-<entry_index>` id, and the write-boundary enforcement
scan is described by its real roots (the whole `.claude/skills` and `packages`
trees, excluding `.test.ts` and `.d.ts`). The remaining accuracy fixes land in the
same pass: the Phase-2 `--config` option, the prioritize dry-run's true output
fields (`{id, backlog_task, path}`, pointing at `~/.ariadne/plan/tasks/<id>.json`
for `fault_area` / `core_fix_effort`), the `reconcile_plan --strategist <id>` flag,
the four-phase count, the `TRIAGE_RESULTS_SCHEMA_VERSION` constant, the
`store/paths.ts` + `cli_args.ts` module split, and the `triage-investigator`
description (a registry match is the Phase-2 auto-classify path, not an investigator
early-exit).

### Notes on scope and interpretation

- **AC#2 wording.** The criterion reads "no reference to
  `~/.ariadne/triage-entrypoints/project_configs` remains," but its own
  parenthetical permits "authoring instructions." That path is the real on-disk
  location where a user saves an authored config, so it survives as authoring
  guidance (with `<name>` placeholders); what is removed is every claim that
  specific named configs (`core` / `mcp` / `types` / `projections`) already exist.
- **Review fixes applied.** A multi-lens review found one real error — the verdict
  section cited `strict_parse.ts` (the low-level primitives) as the home of
  `parse_triage_verdict`, which is actually defined in `triage_verdict.ts`; the
  citation is corrected. Two stale `triage_state_paths.ts` comments left by the
  earlier module rename (`cli_args.ts`, `store/paths.test.ts`) were fixed as
  cheap mechanical drift of the same kind; `paths.test.ts` still passes (11/11).
- **Out of scope.** `triage/package.json` scripts hardcode a `core.json` config
  path. This is operational config, not a doc claim, and pointing it at a real
  config is separate work — left untouched here.
