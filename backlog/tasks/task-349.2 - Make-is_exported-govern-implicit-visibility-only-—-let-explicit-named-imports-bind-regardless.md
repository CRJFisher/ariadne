---
id: TASK-349.2
title: "Make is_exported govern implicit visibility only — let explicit named imports bind regardless"
status: To Do
assignee: []
created_date: "2026-06-26 11:16"
labels:
  - plan-export
  - name_resolution
dependencies: []
parent_task_id: TASK-349
priority: high
ordinal: 2000
plan_dedup_key: 353297f2e4746b78d2f28b25eaf9000871464ddfc2cb520d15954a32559b8426
plan_source_task: pt-57521973c069ab2e
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Phase-1 binds a named import by calling `resolve_export_chain(source_file, import_name, …)` (`name_resolution.ts:166`). The `ExportRegistry` only registers definitions whose `is_exported === true` (`registries/export.ts:89`). Python's indexer sets `is_exported=false` for single-underscore module-level names (verified at `capture_handlers.python.test.ts:1388-1406`). Therefore `from .x import _y` — a fully explicit, valid import — produces an import whose `resolve_export_chain` returns `null`, so no binding enters the scope map. Nearly every Python row in this leaf is underscore-prefixed (`_make_block`, `_ensure_sync_result`, `_parse_mapper_argument`, `_custom_op_with_schema`, …), so this one data-completeness defect accounts for the entire Python population.

This is one widened lookup, not N independent import fixes.

## Producer edit

- **`resolve_references/registries/export.ts`** — add an explicit-named-import resolution path that falls back to a by-name `DefinitionRegistry` lookup in the source file when the `is_exported`-gated export set has no entry. The defining symbol already exists in the `DefinitionRegistry` keyed by `(file, name)`; the export registry simply refuses to surface it. **Keep the `is_exported` filter for the wildcard / namespace / re-export paths** — `is_exported=false` correctly models "not part of the public surface"; it must only stop gating *explicit* imports.
- **`name_resolution.ts:166`** (`resolve_export_chain` caller) picks up the change automatically once the export lookup is widened.

## Scope boundary

- The TypeScript rows in this leaf (destructured from `./_namespaces/ts` barrel namespace) are **excluded** — they fail for an unrelated reason (re-export-chain indirection) that belongs to `import_resolution`, not this change.
- The sqlx/tokio Rust `use crate::x::y` single-hop named-import rows resolve via the same export-chain path: confirm against the widened lookup and the submodule fallback (`name_resolution.ts:177`). They are likely resolved once the export lookup is symmetric; only if not does a small Rust-import adapter become necessary.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `Project` + `update_file` Python: `from .m import _private_fn` resolves to the underscore-private definition.
- [ ] #2 A `build_index_single_file` assertion confirms `is_exported` stays `false` for underscore names — the public-surface contract is unchanged; only explicit-import resolution widens.
- [ ] #3 The existing public-name Python and TS named-import resolution controls stay green.
- [ ] #4 The `is_exported` filter still applies to wildcard / namespace / re-export resolution paths.
- [ ] #5 `capture_handlers.python.test.ts` `is_exported` cases (1388-1448) stay green.

<!-- AC:END -->
