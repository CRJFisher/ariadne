---
id: TASK-364.10
title: "Remove unreachable capture handlers and guard against recurrence"
status: Done
assignee: []
labels:
  - hygiene
  - dead-code
  - tooling
parent_task_id: TASK-364
dependencies: []
references:
  - packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.javascript.ts
  - packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.python.ts
  - packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.rust.ts
  - packages/core/src/index_single_file/query_code_tree/queries/javascript.scm
  - packages/core/src/index_single_file/query_code_tree/queries/python.scm
  - packages/core/src/index_single_file/query_code_tree/queries/rust.scm
  - packages/core/src/index_single_file/index_single_file.ts
  - .claude/hooks/stage_boundary_stop.ts
  - .claude/hooks/utils.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Definition capture handlers are dispatched by an **exact** capture-name lookup:
`process_definitions` in `index_single_file.ts` does `registry[capture.name]`
and calls the handler only `if (handler)`. There is no normalization, no
prefix fallback. Two consequences follow directly:

- A handler registered under a key that **no `.scm` query emits** as
  `@<name>` is unreachable dead code — it can never run.
- A `@<name>` capture emitted by a query with **no handler** in the matching
  registry is silently dropped — the extraction the author intended never
  happens.

TASK-364.8 found the first case: the seven granular re-export handlers
(`handle_import_reexport_named_alias`, `…default_original`,
`…namespace_source`, etc.) are all unreachable — only `@import.reexport` is
emitted, routed to `handle_import_reexport`. A quick cross-reference (registry
keys minus the union of emitted capture names) shows this is not isolated;
there are candidate dead handlers in all three languages.

### Seed evidence (candidates — verify each before deleting)

Registry keys with no exactly-matching emitted capture:

- **JavaScript/TypeScript** — `definition.arrow`, `definition.param`,
  `definition.import.named`, `definition.import.default`,
  `definition.import.namespace`, and the re-export family
  `import.reexport.named`, `import.reexport.named.simple`,
  `import.reexport.named.alias`, `import.reexport.default.alias`,
  `import.reexport.default.original`, `import.reexport.as_default.alias`,
  `import.reexport.namespace.source`, `import.reexport.namespace.alias`.
- **Python** — `definition.lambda`, `definition.comprehension_var`,
  `definition.except_var`, `definition.with_var`, `definition.loop_var`,
  `definition.loop_var.multiple`, `definition.method.class`,
  `definition.method.static`, `definition.parameter.args`,
  `definition.parameter.kwargs`, `definition.parameter.typed`,
  `definition.parameter.typed.default`, `definition.parameter.default`,
  `definition.variable.typed`, `definition.variable.multiple`,
  `definition.variable.tuple`, `definition.variable.destructured`,
  `decorator.variable`.
- **Rust** — `definition.type`, `definition.type_alias.impl`,
  `definition.type_parameter.constrained`, `definition.visibility`,
  `definition.module.public`, `definition.method.associated`,
  `definition.function.returns_impl`, `definition.function.accepts_impl`,
  `definition.function.async_closure`, `definition.function.async_move_closure`,
  `definition.parameter.closure`.

Two caveats the verification must handle, so the list is a starting point and
not a delete list:

- The candidates come from the **union** of every query's captures, which can
  mark a JS-registry key "live" because the Python query happens to emit the
  same name. Confirm per registry against the query(ies) that actually feed it
  (`TYPESCRIPT_HANDLERS` spreads `JAVASCRIPT_HANDLERS`, so JS handlers are live
  if either `javascript.scm` or `typescript.scm` emits the capture).
- Some keys look dead only because a near-neighbour is live (e.g.
  `definition.param` vs the emitted `definition.parameter`); confirm the exact
  string is absent, then treat the unused handler as the superseded duplicate.

<!-- SECTION:DESCRIPTION:END -->

### Work

1. **Build a capture/receiver consistency check** as a pure, tested module
   under `.claude/hooks/` (e.g. `capture_receiver_consistency.ts`). It parses
   `@<name>` captures from every `queries/*.scm`, reads the registry keys from
   each `capture_handlers.<lang>.ts`, models the dispatch exactly
   (`registry[capture.name]`, TS spreads JS), and reports two lists:
   - **dead handlers** — registry keys no feeding query emits;
   - **orphan captures** — emitted captures with no handler in the matching
     registry.
   Ship it with a colocated `.test.ts` and a CLI entry so it can be run
   on demand.

2. **Wire it as a Stop hook** — add `capture_receiver_consistency_stop.ts`
   following the existing gated-Stop pattern
   (`stage_boundary_stop.ts` / `detect_language_singleton_stop.ts`): read
   session changes via `get_changed_files` from `utils.ts`, and run the check
   only when the session edited a `queries/*.scm` query file or a
   `capture_handlers/*.ts` receiver file. Register it in `.claude/settings.json`
   under `hooks.Stop`. Decide block-vs-warn to match the sibling hooks (dead
   handlers are cheap to remove → block is reasonable; orphan captures may be
   work-in-progress → warn).

3. **Remove the dead handlers** the check confirms: delete each unreachable
   handler function, its registry entry, any helper functions it was the sole
   caller of, and any tests that exist only to exercise the dead handler.
   Apply per language. Follow the constitution — no compatibility shims, delete
   rather than deprecate.

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A tested consistency module reports dead handlers and orphan captures by
      modelling the exact `registry[capture.name]` dispatch (TS-spreads-JS
      accounted for).
- [ ] A Stop hook runs the check at session end only when a `.scm` query file
      or a `capture_handlers/*.ts` file changed in the session, registered in
      `.claude/settings.json`, with a colocated test.
- [ ] Every handler the check confirms unreachable is removed — function,
      registry entry, sole-use helpers, and dead-only tests — across JS/TS,
      Python, and Rust.
- [ ] After removal the check reports zero dead handlers; full core suite,
      typecheck, and lint green.

<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## High-level summary

Definition capture handlers dispatch by an exact `registry[capture.name]` lookup
in `process_definitions` (`packages/core/src/index_single_file/index_single_file.ts`),
with no normalization and no prefix fallback. That makes two silent failure
modes possible: a handler registered under a key no `.scm` query emits is
unreachable dead code, and a capture a query emits with no matching handler is
silently dropped. TASK-364.8 exposed the first mode in the re-export handlers; a
full cross-reference showed it was systemic across all three languages.

A pure module, `.claude/hooks/capture_receiver_consistency.ts`, models the
dispatch exactly. It parses each `queries/*.scm` for emitted `@<name>` captures
(ignoring `;` comments and predicate-only names) and each
`capture_handlers.<lang>.ts` for registry keys, reads the
`...JAVASCRIPT_HANDLERS` spread edge that makes JS handlers reachable from
TypeScript straight out of the registry file, and reports **dead handlers** and
**orphan captures**. It ships a CLI entry and a colocated test whose live-repo
integration case asserts zero dead handlers and pins the known orphans.
`capture_receiver_consistency_stop.ts` runs it as a Stop hook when a query or
receiver file changed — blocking deterministically on dead handlers (cheap to
delete), warning on orphans (often work-in-progress) — registered in
`.claude/settings.json`.

The check confirmed 44 unreachable handlers, all removed with their registry
entries and dead-only tests across JavaScript (14), Python (19), and Rust (11);
`control_flow_variable_handlers.python.ts` disappeared entirely once its five
handlers proved dead. No shared helper lost its last caller. Two direct unit
tests were restored for live neighbours the deleted dead-handler tests had
incidentally exercised (JS `definition.parameter`; Rust pub/private type-alias
`is_exported`).

**Where to start:** the invariant is documented in
`.claude/rules/semantic-indexing.md` (Capture/Receiver Consistency). The model
lives in `capture_receiver_consistency.ts` — `check_consistency` is the core;
the trigger predicate and block-vs-warn policy live in the `_stop.ts` wrapper.

**Watch:** two orphan captures remain by decision, not oversight —
`@definition.type_parameter` (TypeScript) and `@decorator.macro` (Rust) are
emitted with no handler, so their extraction never runs. They are pinned by an
integration test and warned by the hook; writing handlers (or dropping the
captures) is real feature work, a candidate follow-up task. The hook files are
typecheck-gated via `.claude/hooks/tsconfig.json`, not covered by `pnpm lint`
(consistent with every sibling hook). Orphan detection is scoped to the
`definition`/`decorator`/`import` categories; the `assignment` family is
deliberately excluded because it is dominated by reference-pass captures, and
its one dispatched key (`assignment.property`) stays honest through the
dead-handler side.

<!-- SECTION:NOTES:END -->
