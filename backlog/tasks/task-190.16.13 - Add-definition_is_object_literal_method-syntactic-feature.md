---
id: TASK-190.16.13
title: >-
  Add `definition_is_object_literal_method` syntactic feature to support
  context-object-destructuring classifier
status: To Do
assignee: []
created_date: '2026-04-22 14:00'
labels:
  - self-repair-pipeline
  - signal-gap
dependencies: []
parent_task_id: TASK-190.16
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `context-object-destructuring` false-positive pattern occurs when a method is defined as an object-literal property-shorthand (e.g. `let ctx = { rollback(snapshot) { ... }, ... }` at `lib/serialization/ObjectMiddleware.js:541`), passed as an argument to another function, and then destructured at the call site (e.g. `serialize({ write, snapshot, rollback, logger, profile })` at `lib/cache/PackFileCacheStrategy.js:720`), with the destructured name invoked as a bare identifier (`rollback(s);` at lines 745, 771, 781).

Ariadne does not walk the chain `object-literal-property -> argument binding -> parameter destructuring -> bare call`, so such methods are marked unreachable even though real callers exist.

To classify this pattern precisely without overlapping with unrelated `diagnosis=callers-not-in-registry` entries (which are already handled by `callers-outside-scope-strict-grep-evidence` at precision 0.952), the signal library needs a new feature: `definition_is_object_literal_method`. This is a boolean captured at definition-extraction time, distinguishing property-shorthand methods inside an object literal from regular class methods.

With that signal, the classifier would be: `language_eq(javascript|typescript)` AND `definition_is_object_literal_method=true` AND `diagnosis_eq(callers-not-in-registry)` AND `callers_count_at_most(0)` AND `grep finds at least one bare-identifier call site matching ^\\s*<name>\\s*\\(`.

Until the signal exists, entries matching this pattern are still caught (less precisely) by the existing `callers-outside-scope-strict-grep-evidence` classifier. The single observed entry (webpack `ObjectMiddleware.js:541 rollback`) is already flagged as a false positive by that classifier.

Acceptance criteria:
- Definition extractor sets `syntactic_features.definition_is_object_literal_method = true` for object-literal property-shorthand methods in TS/JS.
- Extractor sets the same feature to `false` (or absent) for class methods and standalone functions.
- Add a predicate DSL operator (or reuse `syntactic_feature_eq` at entry scope) so the feature is addressable from classifier expressions.
- Add test fixtures covering: object-literal shorthand method (should match), class method (should not match), standalone function expression assigned to a variable (should not match).
- Once the signal is available, author a new registry entry for `context-object-destructuring` with the predicate above and retire the overlap with `callers-outside-scope-strict-grep-evidence`.
<!-- SECTION:DESCRIPTION:END -->
