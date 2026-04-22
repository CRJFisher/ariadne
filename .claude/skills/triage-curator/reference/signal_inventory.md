# Signal Inventory — Ariadne Classifier Authoring Reference

This document lists the signals Ariadne exposes to classifier authors and the
predicate DSL operators that consume them. Use it when proposing a new
classifier from the `triage-curator-investigator` sub-agent: prefer existing
signals; only propose new signals in `new_signals_needed` when no existing
combination suffices.

## The six signal categories

### 1. Definition-site location

Every entry carries its own `name`, `file_path`, `start_line`, and optional
`signature`. Classifiers that branch on the language of the definition use
`language_eq` rather than parsing the path themselves.

### 2. Grep evidence (`grep_call_sites`)

A lightweight textual scan performed before triage, recording each line whose
text matches the entry name. Each hit carries:

- `file`, `line`, `content` — so `grep_line_regex` can match against literal
  call patterns (e.g. `\bnew\s+Name\s*\(`)
- `captures: string[]` — the set of tree-sitter capture names that _did_ fire
  at that hit. `has_capture_at_grep_hit` / `missing_capture_at_grep_hit` are
  the authoritative way to distinguish "tree-sitter saw this site" from "tree-
  sitter missed this site even though grep found the literal text".

### 3. Resolution-failure diagnoses (`diagnosis`)

A single discriminant per entry describing why the resolver failed to find
inbound callers. Match with `diagnosis_eq`. Reasons produced by deep
sub-stages (e.g. `import_unresolved`, `reexport_chain_unresolved`,
`polymorphic_no_implementations`) may be short-circuited by earlier stages
like `name_resolution` returning `name_not_in_scope` first (see "Known API
caveats" below).

### 4. Syntactic features (`syntactic_features`)

Booleans / small enums recorded during extraction that describe shape rather
than context: `is_constructor`, `is_method`, `is_dynamic_dispatch`, etc. Match
with `syntactic_feature_eq` by name and value.

### 5. Decorator / leading-attribute block

For languages with decorators (Python `@decorator`, TypeScript `@Decorator`,
Rust attributes), the lines immediately above the definition are captured
verbatim. `decorator_matches` runs a pre-compiled regex against this block —
useful for framework registration patterns (`@app.route(...)`, `@staticmethod`,
`#[test]`).

### 6. Call references to the entry (via `ariadne_call_refs`)

The list of resolved inbound calls the resolver produced, each with
`receiver_kind`, `syntactic_features`, and `resolution_failure` metadata.
Three predicate DSL operators address this signal directly:

- `resolution_failure_reason_eq` — at least one call-ref failed resolution with
  the given reason (e.g. `name_not_in_scope`, `import_unresolved`).
- `receiver_kind_eq` — at least one call-ref's receiver is of the given kind
  (`object`, `super`, `this`, etc).
- `syntactic_feature_eq` — at least one call-ref has the given syntactic
  feature (e.g. `is_new_expression`, `is_super_call`, `is_optional_chain`).

When the classifier needs aggregate or cross-file information beyond a single
call-ref (e.g. "all callers are inside the same module"), propose
`kind: "builtin"` so it can read `project.resolutions.get_calls_for_file(file)`
and compute its own shape.

## Predicate DSL operators

| Operator                       | Fields                         | Matches when                                                         |
| ------------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| `all`                          | `of: PredicateExpr[]`          | Every child evaluates to `true`.                                     |
| `any`                          | `of: PredicateExpr[]`          | At least one child evaluates to `true`.                              |
| `not`                          | `of: PredicateExpr`            | Child evaluates to `false`.                                          |
| `diagnosis_eq`                 | `value: string`                | `entry.diagnostics.diagnosis === value`.                             |
| `language_eq`                  | `value: string`                | File extension maps to `<lang>` (typescript/javascript/python/rust). |
| `decorator_matches`            | `pattern: string`              | The leading-decorator block matches the regex.                       |
| `grep_line_regex`              | `pattern: string`              | Some grep hit's `content` matches the regex.                         |
| `has_capture_at_grep_hit`      | `capture_name: string`         | Some grep hit's `captures` includes `capture_name`.                  |
| `missing_capture_at_grep_hit`  | `capture_name: string`         | Some grep hit's `captures` omits `capture_name` (tree-sitter gap).   |
| `resolution_failure_reason_eq` | `value: string`                | Some `ariadne_call_refs[i].resolution_failure.reason === value`.     |
| `receiver_kind_eq`             | `value: string`                | Some `ariadne_call_refs[i].receiver_kind === value`.                 |
| `syntactic_feature_eq`         | `name: string; value: boolean` | Some `ariadne_call_refs[i].syntactic_features[name] === value`.      |

All regex expressions are pre-compiled at registry load; do not write regex
flags inline.

## Builtin-only SignalCheck ops

Four additional ops are available only inside `classifier_spec.checks[]` for
`kind: "builtin"` proposals. They read entry-local fields (`name`, `file_path`)
or aggregate the resolution-graph shape (`ariadne_call_refs.length`) and have
no predicate-DSL counterpart — do not propose them inside a `kind: "predicate"`
expression.

| Operator                 | Fields            | Matches when                         |
| ------------------------ | ----------------- | ------------------------------------ |
| `name_matches`           | `pattern: string` | `entry.name` matches the regex.      |
| `file_path_matches`      | `pattern: string` | `entry.file_path` matches the regex. |
| `callers_count_at_least` | `n: number`       | `ariadne_call_refs.length >= n`.     |
| `callers_count_at_most`  | `n: number`       | `ariadne_call_refs.length <= n`.     |

The complete closed union is `SIGNAL_CHECK_OPS` in
`.claude/skills/triage-curator/src/types.ts`; the renderer rejects any op not
listed there.

## Classifier kinds

A registry entry's `classifier` field is one of:

- **`{ kind: "none" }`** — The group is documented but no auto-classifier
  runs. New entries start here while the investigator proposes a rule;
  `kind: "none"` entries never flag members at triage time.

- **`{ kind: "predicate", axis, expression, min_confidence }`** — Pure
  boolean DSL expression over the six signals above. Chosen for patterns
  that can be decided from entry-local evidence (decorator presence,
  grep-line shape, diagnosis discriminant). `axis` is one of `"A"`, `"B"`,
  `"C"` and groups classifiers by the dimension they test (see
  `self-repair-pipeline/known_issues/` for the axis definitions).

- **`{ kind: "builtin", function_name, min_confidence }`** — Reference to a
  TypeScript function in
  `self-repair-pipeline/src/auto_classify/builtins/{function_name}.ts` that
  receives the full `Project` + entry and returns a confidence score.
  Chosen when the classifier needs resolution-graph access, aggregate
  call-reference shape, or other signals not expressible in the predicate
  DSL.

`min_confidence ∈ [0, 1]`; omit the field and it defaults to `0.9` in the
curator pipeline. Predicate matches score 1.0; builtins may emit
sub-threshold scores that become classifier hints rather than
auto-classifications.

## Known API caveats

**Chained calls cannot be individually addressed by `(line, column)`.**
For expressions like `factory().run()`, the outer `.run()` and inner
`factory()` calls share an identical `(start_line, start_column)` — the
outer call's AST range starts at the first character of the inner call.
Passing that position returns the inner call; the outer call is
unreachable through this API. Classifiers that need the outer call in a
chain must enumerate `project.resolutions.get_calls_for_file(file)`
directly and filter by `call_type` / `call_site_syntax.receiver_kind`.

**`ResolutionFailureReason` values surfaced in practice are a subset of
the full union.** Reasons produced by deep sub-stages (e.g.
`import_unresolved`, `reexport_chain_unresolved`, `polymorphic_no_implementations`
from `method_lookup.ts`) are often short-circuited by earlier stages
like `name_resolution` returning `name_not_in_scope` first. Classifiers
must pattern-match exhaustively on the full `ResolutionFailureReason`
union for correctness, but end-to-end tests will only exercise a
subset; unit tests on `resolve_method_on_type` cover the rest.
