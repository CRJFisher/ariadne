---
id: TASK-190.16.4
title: >-
  Create known-issues registry with schema, seed content, and rendered
  per-language refs
status: To Do
assignee: []
created_date: "2026-04-17 14:37"
labels:
  - self-repair
  - auto-classifier
  - registry
dependencies: []
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - .claude/skills/self-repair-pipeline/src/types.ts
  - >-
    packages/core/src/index_single_file/query_code_tree/queries/CAPTURE-SCHEMA.md
  - /Users/chuck/.ariadne/self-repair-pipeline/triage_patterns.json
  - >-
    /Users/chuck/.ariadne/self-repair-pipeline/analysis_output/webpack/triage_results/
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase B1 + B2.

Create the canonical `known_issues/registry.json` that lists every known Ariadne failure mode, with a classifier spec for each. This replaces the self-repair pipeline's previous triage-memoization write path into `known_entrypoints/<pkg>.json` with a repo-tracked, drift-free source of classifier rules.

**Orthogonal to the dead-code whitelist.** The Stop hook `detect_dead_code.ts` reads a *separate* static whitelist at `~/.ariadne/self-repair-pipeline/known_entrypoints/<pkg>.json` to catch dead code introduced during Claude coding sessions. That whitelist is human-maintained and unchanged by this initiative. The `known_issues/registry.json` created here stores **classifier rules** (how to label an unreachable entry when the triage pipeline runs). The two catalogs do not share entries, formats, writeback paths, or consumers.

Schema includes `group_id`, `title`, `description`, `status`, `languages`, `backlog_task?`, `examples`, `classifier: ClassifierSpec`, plus curator-populated optional fields `observed_count`, `observed_projects`, `last_seen_run`. `ClassifierSpec` is a tagged union: `none | builtin { function_name, min_confidence } | predicate { axis, expression, min_confidence }` with a structured predicate DSL (no eval).

The `PredicateExpr` DSL is an enumerated set of 12 operators (serializable, no string eval):

- Combinators: `all`, `any`, `not`
- Leaf predicates: `diagnosis_eq`, `language_eq`, `decorator_matches`, `has_capture_at_grep_hit`, `missing_capture_at_grep_hit`, `grep_line_regex`, `resolution_failure_reason_eq`, `receiver_kind_eq`, `syntactic_feature_eq`

Seed ~15 entries drawn from:

- Webpack-run dominant groups: `method-chain-dispatch`, `polymorphic-subtype-dispatch`, `dynamic-property-keyed-callback`, `constructor-new-expression`
- Resolution-failure taxonomy F1–F10
- Axis A tree-sitter gaps: `ts-jsx-component-call`, `ts-decorator-factory-call`, `ts-private-method-unreachable`, `py-property-decorator-access`, `py-wildcard-import-caller`, `rust-macro-invocation-call`, `rust-trait-method-dispatch`, `js-commonjs-require-destructure`
- Axis C decorator patterns: `framework-pytest-fixture`, `framework-flask-route`, `framework-component-decorator`

Seed the four entries in `~/.ariadne/self-repair-pipeline/triage_patterns.json` verbatim with their pre-measured precision values (0.923–1.0) — these are LLM-proposed rules from previous runs already validated against the webpack corpus. Where registry entries have existing Ariadne backlog tasks (e.g. F1–F10 linking to `task-epic-11.107.*` audit tasks, `task-190.11`, `task-156`, `task-198`, `task-108`), set `backlog_task?` accordingly.

Also build `scripts/render_unsupported_features.ts` that generates per-language markdown files (`packages/core/src/index_single_file/query_code_tree/queries/unsupported_features.{typescript,javascript,python,rust}.md`) from the registry. These are read by the residual-only triage agent and by the curator.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `.claude/skills/self-repair-pipeline/known_issues/registry.json` exists with 15+ seed entries
- [ ] #2 TypeScript type definitions for `KnownIssue` and `ClassifierSpec` live in `.claude/skills/self-repair-pipeline/src/types.ts`
- [ ] #3 JSON schema validation test ensures every entry conforms to the schema
- [ ] #4 Each seed entry's `backlog_task?` either matches an existing backlog task or is intentionally absent
- [ ] #5 `scripts/render_unsupported_features.ts` generates 4 markdown files; golden-file test pins the output
- [ ] #6 All 4 rendered `.md` files live at `packages/core/src/index_single_file/query_code_tree/queries/unsupported_features.{lang}.md`
- [ ] #7 Schema defines `observed_count`, `observed_projects`, `last_seen_run` as optional curator-owned fields
- [ ] #8 `PredicateExpr` type enumerates all 12 operators listed in the description; schema validation rejects any unknown operator
- [ ] #9 Seed entries include the 4 pre-measured patterns from `triage_patterns.json` with their declared `min_confidence`
<!-- AC:END -->
