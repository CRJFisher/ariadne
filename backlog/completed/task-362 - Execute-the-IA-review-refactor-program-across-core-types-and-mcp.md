---
id: TASK-362
title: "Execute the IA-review refactor program across core, types, and mcp"
status: Done
assignee: []
created_date: "2026-07-05 00:00"
labels:
  - information-architecture
  - refactor
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The 2026-07-05 multi-layer information-architecture review of `packages/core`,
`packages/types`, `packages/mcp`, `packages/skill-fs`, and
`packages/skill-protocol` produced a verified refactor program — source drafts
in `backlog/drafts/ia-review.refactor-program.md` (the program) and
`backlog/drafts/ia-review.information-architecture.md` (the analysis). Every
load-bearing claim in both is verified against source.

The diagnosis: the folder skeleton faithfully instantiates the three-stage
intention tree, but ten of twelve routing drills fail one level below the
folders. The debt concentrates in (1) four megafiles (867–1069 LOC) hiding
4–10 sub-concerns each behind a headline name, and (2) an inconsistently
applied language axis — the dotted `{feature}.{lang}.ts` mechanism is correct
and hook-enforced, but ~a dozen files hide whole-language logic in
neutral-named bodies, three folders have their language dispatch displaced
into the stage orchestrator, and `detect_language` exists as three forked
copies with three different unknown-extension contracts (one a latent
mislabel bug: `trace_call_graph.ts` silently defaults unknown extensions to
TypeScript).

This epic is the program: seven areas plus a closing hygiene sweep. The
program's six rulings on contested recommendations (keep dotted files, no
builtins renames, `detect_language` contract reconciliation, MCP
de-duplication, `@language` annotations in types, registry `group_id` renames
out of scope) are decided matters — sub-tasks apply them, they do not reopen
them.

### Sub-tasks

- **TASK-362.1 — Unify language identity: one `detect_language`, one parse
  dispatch point** (Area 1; Effort M, Risk low). Highest-leverage single fix,
  named independently by three layer-2 reports: kills the DRY fork, the
  latent trace-stage mislabel bug, and the 14-builtin import edge into a
  product megafile. Also lands the terminal file-naming rule
  (`file-naming.md`) and the `query_loader.ts` parser-registry split.
- **TASK-362.2 — Dissolve the `index_single_file` type-hub orchestrator and
  re-home displaced dispatch** (Area 2; Effort L, Risk medium — widest import
  churn in core). Fixes the inverted dependency arrow (18 files importing
  wire types upward from the orchestrator) and the displaced
  metadata/documentation-state dispatch.
- **TASK-362.3 — Extract hidden language logic into dotted leaves in
  `resolve_references/` and `references/`** (Area 3; Effort M, Risk
  low-medium). Makes the call-resolution axis enumerable from names alone,
  as the import axis already is.
- **TASK-362.4 — Split the classification megafile; one owner for call-graph
  helpers** (Area 4; Effort M, Risk low). Splits
  `extract_entry_point_diagnostics.ts` (867 LOC) and ends the MCP
  re-implementation divergence of `build_signature`/`count_tree_size`.
- **TASK-362.5 — Types package: delete the dead island, split the
  stage-straddlers, reconcile `Resolution`** (Area 5; Effort L, Risk low).
  Removes ~450 LOC of dead public API, dissolves the barrel-masked name
  collision, moves `SemanticIndex` to the types boundary.
- **TASK-362.6 — Align stage boundaries and barrels with the pipeline order**
  (Area 6; Effort M, Risk medium — touches the resolution hot path). Fixes
  four verified boundary violations and makes every barrel export its own
  folder's surface.
- **TASK-362.7 — MCP: separate boot from logic, split the two
  four-responsibility tools** (Area 7; Effort M, Risk low). Ends the
  boots-a-server-at-import-scope inversion and gives the agent-facing tools
  per-concern routing.
- **TASK-362.8 — Support-tissue and skill-package hygiene sweep; restore doc
  truth** (small-items residue; Effort S, Risk low). The table rows owned by
  no area, plus the doc rewrites that must land after the code settles.

Every one of the 36 consolidated small-item rows in the program's closing
table is assigned to exactly one sub-task (the one that owns its files); the
assignment is recorded in each sub-task. Row 19 (`check_string-keyed-dispatch`
match-pattern fix) routes through the human-owned `reconcile-registry` flow
per program Decision 6 and classifier-lifecycle — TASK-362.4 prints the
hand-off command, it does not self-apply it.

### Dependency graph and work order

```
362.1 ──┬──► 362.3   (dotted leaves import the shared detect_language)
        └──► 362.4   (Area 1 removes detect_language from the megafile and
                      re-points the 14 builtins first)
362.2 ──────► 362.3 (partial: .3's index_single_file/references/ slice lands
                      after .2's stage-1 restructure to avoid rebase churn;
                      .3's resolve_references work is independent)
362.5 ──────► 362.6  (SemanticIndex must live in types before registries/type.ts
                      import cleanup)
362.3 ──────► 362.6  (barrel repair is written once, against final file names)
362.2 ──────► 362.6  (core/index.ts re-pointing follows the stage-1 renames)
362.4 ──────► 362.7  (MCP deletes its helper copies and imports from core)
362.1–.7 ───► 362.8  (doc-truth rewrites land against settled code)
```

Waves: **(1)** 362.1 ∥ 362.2 ∥ 362.5 — the three independent starting points;
362.1 goes first within the wave (smallest blast radius, highest citation
count, unblocks two areas). **(2)** 362.3 ∥ 362.4. **(3)** 362.6 ∥ 362.7.
**(4)** 362.8.

Within each sub-task, land everything at once per the no-shims constitution:
update all callers, no re-exports, no transitional aliases; `git mv` for
every rename so history survives; each extraction moves its colocated tests
in the same commit.

### Enforcement / encouragement mechanism layer (TASK-362.9–362.15)

The refactor above fixes today's IA violations once. This second layer keeps
them fixed by hardening the Claude Code customisation surface so the patterns
are enforced or encouraged going forward. It is designed on two rails with a
strict division of labour (source: the 2026-07-05 IA-enforcement strategy
workflow over the `ia-review` drafts):

- **ENFORCE (hooks)** — every deterministic, mechanically-decidable
  convention gets a blocking check, almost all as extensions of the four hook
  surfaces that already exist (`file_naming.ts`/`file_naming_validator.ts`
  PreToolUse, `detect_dead_code.ts` Stop) plus three new Stop scripts
  (`stage_boundary_stop.ts`, `doc_path_truth.ts`,
  `detect_language_singleton_stop.ts`). Hooks carry zero standing tokens and
  emit bounded messages only on violation.
- **ENCOURAGE (guidance)** — every judgement-heavy convention is delivered as
  terse **path-scoped** rule text (loads only when a matching file is
  touched) plus one write-time `additionalContext` micro-injection. Judgement
  patterns are NEVER wired to a deny/block — a false-positive block on a
  judgement call is worse than a miss.

**Context-cost is a first-class constraint, and this layer is net strongly
negative on always-on tokens** (~−200 lines/turn): TASK-362.15 thins
`CLAUDE.md` (126→~40 lines) and path-scopes the currently-unscoped 114-line
`classifier-lifecycle.md`, while every addition is either a hook (zero
standing cost) or a 5–15-line path-scoped rule.

**Sequencing couples to the refactor layer:** per the no-grandfathering
constitution, each blocking hook ships warn-only (or lands with the offender
migration) until the matching refactor sub-task removes today's real
violations — `detect_language_singleton_stop` follows 362.1,
`stage_boundary_stop` follows 362.6, the generic-name denylist lands with the
362.5/362.8 renames, and the rule-payload refresh (362.9) precedes
`doc_path_truth` (362.13) so the new hook does not block on known-stale rules
(satisfied in substance: after 362.8's refresh, 362.13 fixes the last stale
citations in its own commit, and its live repo-truth test guards 362.9's
later rule edits).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] TASK-362.1 complete: exactly one `detect_language` definition exists in
      core (grep-verified); `trace_call_graph` fails loud on unknown
      extensions; the parse-phase dispatch lives in `project/parse_file.ts`.
- [ ] TASK-362.2 complete: `index_single_file.ts` is an orchestrator only —
      no wire-type definitions, no hand-enumerated per-language calls; the 18
      upward type imports are gone.
- [ ] TASK-362.3 complete: every whole-language body in
      `resolve_references/` and `references/` named in Area 3 wears a dotted
      suffix or a marshaller; the deliberately-inline branches carry
      `@language` comments.
- [ ] TASK-362.4 complete: `extract_entry_point_diagnostics.ts` holds only
      the diagnosis core + grep-index build; `build_signature` and
      `count_tree_size` have one owner in `trace_call_graph/`.
- [ ] TASK-362.5 complete: the seven dead-island files are deleted; the
      `Resolution` collision is dissolved; `SemanticIndex` is imported from
      `@ariadnejs/types` everywhere.
- [ ] TASK-362.6 complete: no stage value-imports from a later stage; every
      barrel exports only its own folder's surface; `core/index.ts` routes
      through sub-barrels.
- [ ] TASK-362.7 complete: importing MCP's CLI-parsing module does not boot a
      server; the two agent-facing tools route per-concern.
- [ ] TASK-362.8 complete: every remaining small-item row is landed or
      explicitly rejected with a reason; `trace-call-graph.md` and
      `file-naming.md` match reality.
- [ ] All 36 small-item table rows accounted for across sub-tasks (landed or
      rejected-with-reason); full test suite green after each wave.

<!-- AC:END -->

## Sub-tasks

- TASK-362.1: Unify language identity — one detect_language, one parse dispatch point
- TASK-362.2: Dissolve the index_single_file type-hub orchestrator and re-home displaced dispatch
- TASK-362.3: Extract hidden language logic into dotted leaves in resolve_references and references
- TASK-362.4: Split the classification megafile and give call-graph helpers one owner
- TASK-362.5: Types package — delete the dead island, split the stage-straddlers, reconcile Resolution
- TASK-362.6: Align stage boundaries and barrels with the pipeline order
- TASK-362.7: MCP — separate boot from logic, split the two four-responsibility tools
- TASK-362.8: Support-tissue and skill-package hygiene sweep; restore doc truth
- TASK-362.9: Refresh IA rule payloads — fix stale subsystem layouts and add the missing path-scoped rules (encourage)
- TASK-362.10: Harden the file-naming hook — language sub-folder block, generic-name denylist, drop go/java (enforce)
- TASK-362.11: Add the detect_language singleton Stop guard — warn-only until 362.1 lands (enforce)
- TASK-362.12: Add the stage-boundary Stop hook and its paired stage-boundaries rule (enforce)
- TASK-362.13: Enforce doc-truth and full dead-code coverage at Stop (enforce)
- TASK-362.14: Add the write-time judgement nudges — marshaller-presence injection and megafile notice (encourage)
- TASK-362.15: Thin the always-on context — CLAUDE.md trunk, classifier-lifecycle path-scoping, doc-style dedup (encourage)
