---
id: TASK-190.22.7
title: 'Backlog firewall: rule doc + AST enforcement test'
status: Done
assignee: []
created_date: '2026-06-01 15:18'
updated_date: '2026-06-10 08:51'
labels:
  - self-repair
  - firewall
  - enforcement
dependencies: []
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Make the firewall structural, not just convention — mirror the registry write-boundary contract (`.claude/rules/classifier-lifecycle.md` + `packages/skill-fs/src/registry_writers.test.ts`). `backlog/` is exclusively user-operated; the only sanctioned backlog writer is the user-invoked export adapter (190.22.11).

## Scope

- **Rule doc** `.claude/rules/backlog-firewall.md` (twin of classifier-lifecycle.md): a writer table stating the pipeline (`triage`, `plan`) NEVER writes `backlog/` and never calls `mcp__backlog__task_create`/`task_edit`/`task_complete`/`task_archive`/`milestone_*`/`document_create`/`document_update`; the export adapter is the sole writer, human-invoked; the human operates `backlog/` directly. Cross-reference classifier-lifecycle.md and commit-convention.md.
- **AST enforcement test** `packages/skill-fs/src/backlog_writers.test.ts` (clone of registry_writers.test.ts's AST walk over `.claude/skills/**`, `**/scripts`, `packages/**/src`): flag (a) any raw write (`writeFile`/`appendFile`/`atomic_write_file`/…) whose first arg resolves to a `backlog/`-shaped path, and (b) any reference to the mutating `mcp__backlog__*` tool names. Reuse the existing arg-resolution + negative-control machinery. `ALLOWED_BACKLOG_WRITERS = { ".claude/skills/plan/scripts/export_to_backlog.ts" }` — nothing else.

## Note

Read-only backlog access (`mcp__backlog__task_search`/`task_view`, frontmatter parse) is permitted as a dedup signal (190.22.10) — the test flags writes + mutator calls only, so reads pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `.claude/rules/backlog-firewall.md` exists with a writer table (pipeline = never; export adapter = sole human-invoked writer; human = direct), cross-referencing classifier-lifecycle.md + commit-convention.md
- [x] #2 `packages/skill-fs/src/backlog_writers.test.ts` flags raw writes to `backlog/`-shaped paths AND references to mutating `mcp__backlog__*` tools across the skills/packages tree
- [x] #3 `ALLOWED_BACKLOG_WRITERS` contains only the export adapter; the test has a negative control proving the scanner is not a no-op
- [x] #4 Read-only `task_search`/`task_view`/frontmatter parse is NOT flagged
- [x] #5 The test passes against the post-firewall tree (after 190.22.6); `pnpm -r test` green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## High-level summary

**Why this work exists.** `backlog/` is exclusively user-operated. The self-healing pipeline (`triage`, `plan`) must never write it — proposed work flows through the pipeline's own task-DB (`~/.ariadne/plan/`), and a single user-invoked export adapter is the only sanctioned bridge into `backlog/`. Convention alone is fragile, so this work makes the boundary structural, mirroring the registry write-boundary contract (`classifier-lifecycle.md` + `registry_writers.test.ts`).

**What was built.** Two deliverables, both twins of the registry firewall:

1. The rule doc `.claude/rules/backlog-firewall.md` — a four-row writer table (`triage`/`plan` never write; the human-invoked `export_to_backlog.ts` is the sole programmatic writer; the human operates `backlog/` directly), the read-only carve-out, the enumerated mutator denylist, an Enforcement section describing the two violation kinds, and a Known-limitations section. It cross-references `classifier-lifecycle.md` and `commit-convention.md`, and is now reachable *from* the code it governs: `plan/SKILL.md` and `classifier-lifecycle.md` both link to it.
2. The AST test `packages/skill-fs/src/backlog_writers.test.ts` — a deliberate clone of `registry_writers.test.ts`'s TypeScript-compiler walk over `.claude/skills` and `packages`. It flags **(a)** raw writes whose path argument resolves to a `backlog/`-shaped path and **(b)** any string-literal reference to a *mutating* `mcp__backlog__*` tool. `ALLOWED_BACKLOG_WRITERS = { ".claude/skills/plan/scripts/export_to_backlog.ts" }` gates both kinds (named pre-emptively; the file lands with 190.22.11).

**Key decisions.**

- *Deny-by-default mutator detection.* Rather than enumerate mutators, the test keeps an explicit read-only allowlist (`task_search`/`task_view`/`task_list`/`document_view`/…) and flags every other `mcp__backlog__*` token — so a mutator added to the MCP server later is caught with no edit. Reads stay permitted everywhere (the dedup signal of 190.22.10).
- *Path-shape gate, not name heuristic.* The registry twin's `/registry/i` identifier-name branch is dropped: `backlog_task`/`exported_backlog_task` are domain nouns across the plan engine, so only the resolved path *value* decides. This let the write-function set safely expand beyond the registry's five byte-writers to the destructive primitives (`rename`/`rm`/`mkdir`/`cp`/`copyFile`/`truncate`/`createWriteStream`); move/copy primitives are checked at the endpoint they write.
- *Duplicate, don't extract.* The ~120 lines of AST-walk machinery are cloned rather than shared, because a non-test shared module would pull the `typescript` compiler into `@ariadnejs/skill-fs`'s runtime dependency graph. The header comment pins the twin relationship and names the three intended divergence seams.

**Review hardening.** A multi-agent review surfaced and fixed: a fail-open crash where a self-referential or cyclic local binding (`const x = x`) infinitely recursed the path resolver (now guarded by a `seen` set); two same-file bypasses the scan missed — string concatenation (`repo + "/backlog/tasks/" + id`, now handled via `BinaryExpression`) and nested `path.join` (now recursed); and a silent-no-op risk where a bad `REPO_ROOT` would let the scan pass while inspecting nothing (now anchored on a sentinel source file). The negative control was extended to exercise all six raw-write branches plus the cycle guard.

**Known gap (deliberately out of scope).** The static `.ts` scan cannot see *agent grant surfaces*. `.claude/agents/plan-strategist.md` still carries a whole-server `mcpServers: - backlog` grant left over from the pre-restructure curator — a real latent hole, since it admits every mutator to an autonomous agent. It is entangled with that file's stale, Phase-4-pending prose (which still instructs backlog-task filing), so the narrowing belongs with the plan-engine rewrite (TASK-190.22.10), where it is now noted. The rule doc's Known-limitations section discloses this vector honestly rather than implying the boundary is sealed.

## Retirement note

The deliverables of this task (`backlog-firewall.md`, `backlog_writers.test.ts`, `ALLOWED_BACKLOG_WRITERS`) were deliberately deleted in commit c5c2ccd7 ("refactor(self-healing): scrub shelved fix-sequencer + actuator; remove backlog firewall; human-maintained registry"). The sole-backlog-writer property is now convention, documented in `.claude/skills/plan/SKILL.md` and `.claude/skills/prioritize/SKILL.md`.
<!-- SECTION:NOTES:END -->
