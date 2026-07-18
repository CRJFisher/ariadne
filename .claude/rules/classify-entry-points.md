---
paths: packages/core/src/classify_entry_points/**
---

# Classify Entry Points

`trace_call_graph` emits raw entry points; this folder decides which are genuine.
`enrich_call_graph.ts` is the stage face, calling `auto_classify.ts` as its sub-step.
`index.ts` is the folder's public surface — there is no folder-named orchestrator here.

## Adding a Builtin Classifier

Three artifacts, all required. Ship the first two and the check is dead code: dispatch is by
the registry row's `classifier.function_name`, so nothing reaches a check with no row.

1. `builtins/check_<group_id>.ts`.
2. Two lines in `builtins/index.ts` — the import and the `BUILTIN_CHECKS` entry.
3. A registry row, which you cannot write. Stage a draft and hand it to the human for
   `reconcile_registry.ts --stage <draft> --apply`.

One `group_id`, two spellings: it is hyphenated (`py-dunder-protocol`) and names the file
(`check_py-dunder-protocol.ts`); the exported function, its `BUILTIN_CHECKS` key, and the
registry `classifier.function_name` are all the underscored form
(`check_py_dunder_protocol`). A mismatch fails at runtime. The filename↔`group_id` bijection
is load-bearing: `reconcile-registry` maps a row to its file by that name and unlinks
`check_<group_id>.ts` on retire.

Two constraints bind the check body, both guarded by `builtins/field_denylist.test.ts`:

- Read `language` off the `BuiltinCheckFn` parameter. A `detect_language` import or an
  extension gate fails the build — see `@.claude/rules/language-patterns.md`.
- Never key on `tree_size` or `definition_features`. Both are absent from the `TriageEntry`
  the author validates against, so a check reading them passes staging and misfires later.

`registry_permanent_data.ts` is generated — regenerate it, never hand-edit it.

## Enforcement

Automatic: `file_naming_validator.ts` (PreToolUse) requires a lowercase stem separated by
hyphens or underscores under `builtins/`; it neither requires the `check_` prefix nor opens
the registry, so a stem that is not a real `group_id` passes. `registry_write_guard.ts`
(PreToolUse) routes every registry write to a per-edit human `ask`. `run_tests_stop.ts`
(Stop) scopes vitest to the directories of changed `.ts` files, so a `builtins/` edit runs
`field_denylist.test.ts` but not `registry_permanent_data.sync.test.ts` one level up, and a
registry-JSON edit runs neither — run the sync test yourself after `--promote`.

On demand: `.claude/skills/triage/scripts/check_registry.ts` rejects a `function_name`
absent from `BUILTIN_CHECKS`. Nothing invokes it automatically; run it or the
`reconcile-registry` skill.

Lifecycle — who may write the registry, and how a rule is created, promoted, or retired — is
`@.claude/rules/classifier-lifecycle.md`.
