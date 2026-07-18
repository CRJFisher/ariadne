---
paths: packages/core/src/classify_entry_points/**
---

# Classify Entry Points

Stage-3 classification: `trace_call_graph` emits raw entry points, and this folder decides
which of them are genuine.

## Stage Face

`enrich_call_graph.ts` is the stage face — it enriches each raw entry point into an
`EnrichedEntryPoint` and applies the classification. `auto_classify.ts` is the
auto-classify sub-step it calls. There is no `classify_entry_points.ts`: the
folder-ts-is-the-orchestrator convention does not hold here, so read `index.ts` for the
folder's public surface rather than reaching for a folder-named file.

## Adding a Builtin Classifier

A classifier is one `builtins/check_<group_id>.ts` file plus two lines in the
`builtins/index.ts` barrel (an import and a `BUILTIN_CHECKS` entry).

The name appears in three forms, and getting the transform wrong fails at runtime, not at
the hook:

| Form              | Shape                            | Example                        |
| ----------------- | -------------------------------- | ------------------------------ |
| Registry `group_id` | hyphenated                     | `py-dunder-protocol`           |
| Filename          | `check_<group_id>.ts`, hyphenated | `check_py-dunder-protocol.ts` |
| Exported function / `BUILTIN_CHECKS` key / registry `classifier.function_name` | underscored | `check_py_dunder_protocol` |

The filename↔`group_id` bijection is load-bearing: `reconcile-registry` maps a registry row
to its file by that name, and unlinks `check_<group_id>.ts` on retire.

## Language Is Threaded, Never Re-Derived

Language arrives as the `language` parameter on `BuiltinCheckFn`, threaded from parse
ingress. Never re-derive it inside this folder — no `detect_language` import, no
`.endsWith(".py")` extension gate. `builtins/field_denylist.test.ts` fails the build on
either. See `@.claude/rules/language-patterns.md`.

`registry_permanent_data.ts` is generated from the registry — never hand-edit it.

## Hook Enforcement

- `.claude/hooks/file_naming_validator.ts` (PreToolUse) enforces kebab-case filenames under
  `builtins/`. It does **not** open the registry, so it cannot catch a stem that is not a
  real `group_id`.
- `.claude/skills/triage/scripts/check_registry.ts` is what actually checks the bijection's
  other half: it rejects a `classifier.function_name` absent from `BUILTIN_CHECKS`.
- `.claude/hooks/registry_write_guard.ts` (PreToolUse) routes every registry write to a
  per-edit human `ask`.
- `run_tests_stop.ts` (Stop) runs `registry_permanent_data.sync.test.ts`, the byte-equality
  drift guard between the registry and the bundled core slice.

Lifecycle — who may write the registry, and how a rule is created, promoted, or retired —
is `@.claude/rules/classifier-lifecycle.md`.
