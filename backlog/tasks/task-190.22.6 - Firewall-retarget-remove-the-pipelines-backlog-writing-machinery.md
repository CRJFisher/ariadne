---
id: TASK-190.22.6
title: "Firewall: retarget/remove the pipeline's backlog-writing machinery"
status: Done
assignee: []
created_date: "2026-06-01 15:18"
labels:
  - self-repair
  - firewall
  - plan-skill
dependencies:
  - TASK-190.22.4
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

`backlog/` becomes exclusively user-operated. As part of stripping `plan`'s code-mutating machinery (Phase 3), remove every path by which the pipeline writes the user's backlog — the pipeline will instead write its own task-DB (impl in 190.22.8; engine wiring in 190.22.10). The only sanctioned backlog writer is the user-invoked export adapter (190.22.11).

## Scope

- **Retarget the pure row-builders, drop the MCP feed.** `triage-curator/src/propose/propose_backlog_tasks.ts` — keep `render_task_title`/`render_task_body`/`render_task_labels` (reused by the engine + export adapter), but they become feedstock for `PlanTask` records, not for `mcp__backlog__task_create`. Strip the `mcp__backlog__*` references from docstrings.
- **Remove the backlog-coupling.** Delete `scripts/link_ariadne_bug_tasks.ts` + the `link_ariadne_bug_tasks` path in `src/apply/apply_proposals.ts` + the `created_task_ids.json` sidecar (`src/store/paths.ts` `created_task_ids_path`). If a registry backlink is still wanted, it points at the task-DB id, not a `TASK-<N>` backlog id. (Most of `src/apply/*` is already being stripped/parked by Phase 3; this ensures the backlog-specific pieces go with it.)
- **SKILL.md** — remove `mcp__backlog__task_create`/`task_edit` from the `plan` `allowed-tools`; rewrite the "File backlog tasks" step (curator SKILL.md:151-241) as "write proposals to the task-DB"; drop the `created_task_ids.json` handshake. Keep `mcp__backlog__task_search`/`task_view` ONLY for read-only dedup (see 190.22.10).
- **Types** — drop `AriadneBugTaskToCreate`/`SignalLibraryGapTaskToCreate`/`TaskProposal`/`TaskUpdateProposal` + `SIGNAL_LIBRARY_GAP_PARENT_TASK_ID` (backlog-specific); their role is taken by `PlanTask` (190.22.4). Update `get_investigate_context.ts:145` + `types.ts:242` (`existing_task_id`) to mean "existing DB task".

## Verification

`grep` finds no `mcp__backlog__task_create`/`task_edit` and no writes to `backlog/` anywhere under the `plan` skill; build/tests green. (The structural AST enforcement is added in 190.22.7.)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 No `mcp__backlog__task_create`/`task_edit`/`task_complete`/`task_archive` calls or `backlog/`-path writes remain anywhere under the `plan` skill (src, scripts, SKILL.md `allowed-tools`)
- [x] #2 `link_ariadne_bug_tasks` (script + apply_proposals path) and the `created_task_ids.json` sidecar are deleted; any registry backlink points at the task-DB id, not a `TASK-<N>`
- [x] #3 The pure row-builders (`render_task_*`) are retained as feedstock for `PlanTask` records; backlog-specific proposal types + `SIGNAL_LIBRARY_GAP_PARENT_TASK_ID` are removed
- [x] #4 SKILL.md Step-4 rewritten to 'write proposals to the task-DB'; only read-only `task_search`/`task_view` may remain (for dedup)
- [x] #5 `pnpm -r build && pnpm -r test` green; no dangling imports
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

**Intent.** Make `backlog/` exclusively user-operated by severing every path through which the `plan` skill writes the user's backlog. After the 190.22.5 strip, the actuator surface (`src/apply/*`, `link_ariadne_bug_tasks.ts`, the `created_task_ids.json` sidecar) is already gone, so AC#2 is largely satisfied at the code level; the remaining backlog-writing machinery is the registry-sweep MCP feed plus the backlog-coupled docstrings, types, and metadata.

**Approach.**

- **Strip the MCP feed.** Delete `scripts/propose_backlog_tasks.ts` (the CLI whose JSON output the main agent piped into `mcp__backlog__task_create`/`task_edit`) and the `propose_backlog_tasks` orchestration function plus its backlog-shaped proposal types (`TaskProposal`, `TaskUpdateProposal`, `ProposeBacklogTasksInput`, `ProposeBacklogTasksResult`). Retain the pure row-builders `render_task_title`/`render_task_body`/`render_task_labels` (+ the `render_classifier_for_body` helper) and export all three — they are reused by the deferred engine (190.22.10) and export adapter (190.22.11) to render `PlanTask` content. The file is renamed `git mv propose_backlog_tasks.ts → render_task.ts` (with its test) so the filename names its surviving responsibility.
- **Drop the signal-gap backlog coupling.** Remove `SIGNAL_LIBRARY_GAP_PARENT_TASK_ID` from `types.ts` and its surfacing in `get_investigate_context.ts`; the `SignalLibraryGap` shape stays (it grounds a future `PlanTask`), only its backlog-parent coupling goes.
- **`existing_task_id` left as a placeholder (deferred).** Retargeting `AriadneBug.existing_task_id` from a backlog `TASK-<N>` to a task-DB id is **not done in this task** — it is gated on first deciding the task-DB id format (see the follow-up to-do below). The field, its `/^TASK-…/` validation in `validate_investigate_responses.ts`, and the `get_investigate_context` authoring rule are left untouched as a placeholder. This is a read-side reference format only (it writes nothing), so leaving it does not breach the firewall.
- **SKILL.md.** Drop `mcp__backlog__task_create`/`task_edit` from `allowed-tools` (keep read-only `task_search`); remove the `mcp__backlog__document_create` impact-report-posting block; rewrite the "Sweeping registry entries" section so proposals land in the task-DB (`~/.ariadne/plan/`) via the engine, not backlog.
- **meta.json.** Remove the `backlog` write-artifact and `backlog-tasks` published-output entries so the skill's metadata no longer declares a backlog write.

Read-only backlog dedup (`mcp__backlog__task_search`, frontmatter parse) is retained per 190.22.10. The strategist agent prompt's classifier-author→strategist rewrite stays out of scope (Phase 4). The structural AST enforcement is 190.22.7.

## What changed

- `scripts/propose_backlog_tasks.ts` deleted; `src/propose/propose_backlog_tasks.ts` → `src/propose/render_task.ts` (`git mv`, history preserved), reduced to the three exported pure builders + the private `render_classifier_for_body` helper. The `propose_backlog_tasks` function and the `TaskProposal`/`TaskUpdateProposal`/`ProposeBacklogTasksInput`/`ProposeBacklogTasksResult` types are gone.
- `src/types.ts`: `SIGNAL_LIBRARY_GAP_PARENT_TASK_ID` removed; `SignalLibraryGap`/`AriadneBug`/`InvestigateResponse` docstrings retargeted from "drafts a backlog (sub-)task" to "grounds a task in the plan engine's task-DB".
- `scripts/get_investigate_context.ts`: dropped the `SIGNAL_LIBRARY_GAP_PARENT_TASK_ID` import and the `signal_library_gap_parent_task_id` field from the hydrated context bundle.
- `SKILL.md`: `allowed-tools` reduced to read-only `mcp__backlog__task_search`; the `mcp__backlog__document_create` impact-report-posting block removed; the registry-sweep section rewritten to "Rendering task content for the task-DB"; the frontmatter `description` no longer advertises "backlog reports".
- `meta.json`: removed the `backlog` write-artifact, the `backlog-tasks` published-output, and the `propose-backlog-tasks` flow; the `description` no longer advertises "backlog reports".
- `src/propose/render_task.test.ts`: renamed with the source; the deleted-function tests removed; dedicated `render_task_title`/`render_task_labels` cases added; the body test tightened to an exact full-string `toEqual`.

## Review outcome

Four opus reviewers (completeness, firewall-residue/correctness, information architecture, constitution/test-quality). Verified findings actioned:

- **Applied:** stale "backlog reports" wording in the `SKILL.md` + `meta.json` descriptions removed; the comprehensive `render_task_body` test tightened from fragmented `toContain` checks to an exact `toEqual`.
- **Routed to 190.22.9 (Phase 4):** `.claude/agents/plan-strategist.md` still grants the mutating `backlog` MCP server (pinned by `agent_prompt_pin.test.ts`), still carries task-filing prose, and still references the now-removed `signal_library_gap_parent_task_id` context field. These are one entangled unit owned by the Phase-4 strategist-prompt rewrite, carry no live regression (no actuator files tasks today), and a partial edit would fight the pin and leave a worse intermediate. The 190.22.9 scope now explicitly tracks completing the firewall at the agent boundary.
- **Considered, not actioned:** renaming the `src/propose/` folder (now holding renderers + validation, not a "propose" verb) is a separate IA concern beyond this firewall task, and the suggested `src/render/` fits only two of its three files.

## Follow-up to-do

- [ ] **Define the task-DB id (`PlanTaskId`) format, then retarget `existing_task_id`.** Decide a clean, new id grammar for `PlanTaskId` (the contract in `@ariadnejs/skill-protocol` deliberately fixes none; minting is the store's concern — owned by TASK-190.22.8). Once defined, repurpose `AriadneBug.existing_task_id` to a task-DB id and replace the backlog-specific `/^TASK-…/` validation in `validate_investigate_responses.ts` with a check against the new grammar (preferring the clean new format over the legacy `TASK-N` one). Until then `existing_task_id` is a placeholder.

<!-- SECTION:NOTES:END -->
