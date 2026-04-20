---
id: TASK-190.16.6
title: Implement 10 initial auto-classifiers covering dominant failure modes
status: To Do
assignee: []
created_date: "2026-04-17 14:38"
labels:
  - self-repair
  - auto-classifier
dependencies:
  - TASK-190.16.1
  - TASK-190.16.2
  - TASK-190.16.4
references:
  - /Users/chuck/.claude/plans/open-that-plan-up-hazy-cloud.md
  - >-
    /Users/chuck/.ariadne/self-repair-pipeline/analysis_output/webpack/triage_results/
  - .claude/skills/self-repair-pipeline/src/auto_classify/
parent_task_id: TASK-190.16
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Plan reference: `~/.claude/plans/open-that-plan-up-hazy-cloud.md` — Phase C2.

Populate `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/` with 10 classifiers covering the webpack-run dominant groups and the core resolution-failure taxonomy. Registry priority is the order below (1 = highest):

| Priority | group_id                          | axis   | kind      | Logic                                                                                                                      |
| -------- | --------------------------------- | ------ | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1        | `framework-pytest-fixture`        | C      | predicate | `decorator_matches "@pytest.fixture*"`                                                                                      |
| 2        | `framework-flask-route`           | C      | predicate | `language_eq python` AND `decorator_matches "@*.route*"`                                                                    |
| 3        | `framework-component-decorator`   | C      | predicate | `decorator_matches "@Component*"`                                                                                           |
| 4        | `method-chain-dispatch`           | A+B    | builtin   | `receiver_kind_eq "call_chain"` AND resolution unresolved                                                                   |
| 5        | `polymorphic-subtype-dispatch`    | B (F7) | builtin   | diagnosis `callers-in-registry-wrong-target` AND no inheritance link between caller and resolved target                     |
| 6        | `dynamic-property-keyed-callback` | B (F9) | builtin   | `syntactic_feature_eq is_dynamic_dispatch true` AND collection-source with non-literal key                                  |
| 7        | `constructor-new-expression`      | A      | builtin   | grep line matches `new Name(` AND `missing_capture_at_grep_hit "@reference.constructor"`                                    |
| 8        | `python-module-attribute-call`    | B (F4) | predicate | `language_eq python` AND `resolution_failure_reason_eq "import_unresolved"` AND import_kind ≠ namespace                     |
| 9        | `aliased-re-export-walk-broken`   | B (F5) | builtin   | resolution_failure stage = `import_resolution`, reason = `reexport_chain_unresolved`                                                |
| 10       | `unindexed-external-module`       | B (F6) | predicate | `resolution_failure_reason_eq "receiver_is_external_import"`                                                                |

Each classifier is fixture-tested against hand-crafted `EnrichedFunctionEntry` instances drawn from the webpack triage output at `~/.ariadne/self-repair-pipeline/analysis_output/webpack/triage_results/*.json` — treated as the regression suite. Precision must meet the registry's declared `min_confidence` on its fixture set.

Depends on `resolution_failure`, `receiver_kind`, and `syntactic_features` being populated (TASK-190.16.1, TASK-190.16.2) and the registry schema (TASK-190.16.4).

### Known resolver gaps to address while wiring classifiers

- **Namespace-import barrel re-export emits `method_lookup`/`method_not_on_type` instead of `import_resolution`/`reexport_chain_unresolved`.** When `import * as ns from "./barrel"` is followed by `ns.fn()` and `barrel/index.ts` re-exports `fn` via `export { fn } from "./fn"`, `resolve_method_on_type` (namespace path, `method_lookup.ts:48-69`) calls `resolve_namespace_export`, which skips `kind === "import"` defs (re-exports). It returns null and the resolver emits `method_lookup`/`method_not_on_type` — losing the barrel-walk signal that the `aliased-re-export-walk-broken` classifier (priority 9) needs. The `reexport_chain_unresolved` reason currently fires only on the named/default-import path (`method_lookup.ts:108-115`). Before relying on that classifier in the registry, either (a) extend `resolve_namespace_export` to follow re-export chains and emit `reexport_chain_unresolved` on miss, or (b) widen the classifier's predicate to also match `method_not_on_type` for namespace-import receivers backed by a re-export-only source file. Verified by `resolve_references.typescript.test.ts > "namespace import with re-exports should resolve through barrel file"`.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 10 classifier files under `.claude/skills/self-repair-pipeline/src/auto_classify/builtins/`
- [ ] #2 Each classifier has a co-located `.test.ts` with fixtures from real webpack entries + synthetic edge cases
- [ ] #3 Each classifier's measured precision on its fixture set meets the registry-declared `min_confidence`
- [ ] #4 All 10 classifiers registered in the registry with correct `ClassifierSpec`
- [ ] #5 End-to-end run against webpack: auto-classified ÷ total flagged ≥ 40%
- [ ] #6 Classifier-to-agent disagreement rate < 10% per classifier registered with `min_confidence: 0.9`
- [ ] #7 Regression run against the core.json (Ariadne self-corpus) produces non-zero auto-classify rate with the same precision guarantees as webpack
<!-- AC:END -->
