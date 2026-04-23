# Unsupported features — rust

Canonical list of known Ariadne failure modes that affect this language. Generated from `.claude/skills/self-repair-pipeline/known_issues/registry.json` by `.claude/skills/self-repair-pipeline/scripts/render_unsupported_features.ts`. Do not edit by hand — edit the registry and re-render.

Entries: 11

## `method-chain-dispatch` — Method call on call-chain receiver unresolved

A method is invoked on the result of another call (e.g. `a.b().c()`), but Ariadne cannot carry the intermediate call's return type through to resolve the final method. Common in builder patterns and fluent APIs. Observed as a dominant group in the webpack corpus.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `wip`                                        |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | _none_                                       |
| Classifier   | _none — known, no automated classifier_      |

**Examples**

- `lib/util/Hash.js`:1 — `createHash('md4').update(buf).digest('hex')`

## `polymorphic-subtype-dispatch` — Method call resolves to base or wrong class in polymorphic hierarchy

A call on a base-class or generic receiver resolves to the base method (or an unrelated same-named method) rather than the concrete subclass override, so subclass entry points appear unreachable. Covers protocol/interface dispatch and generic parameter erasure. Webpack-corpus F7.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `wip`                                        |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | `TASK-198`                                   |
| Classifier   | _none — known, no automated classifier_      |

**Examples**

- `lib/dependencies/WorkerDependency.js`:86 — `class WorkerDependency { serialize(context) { /* ... */ } }`

## `dynamic-property-keyed-callback` — Callback invoked via dynamic / computed property key

A function is stored in a map or object and invoked via `handlers[key](...)` or `obj[name]()` where the key is not a literal. The resolver has a collection source but no literal key, so the specific callback cannot be linked. Webpack-corpus F9 and a permanent resolver limitation when the key is computed.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `permanent`                                  |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | _none_                                       |
| Classifier   | predicate, axis B (min_confidence 0.9)       |

**Examples**

- `lib/Compilation.js`:1 — `this._hooks[name].call(arg)`

**Predicate**

```
syntactic_feature_eq is_dynamic_dispatch=true
```

## `unindexed-external-module` — F6 — Caller lives in unindexed/external module

The only callers are inside a module that Ariadne did not index (outside configured folders, or an external package). When it is an external dependency, this is a permanent limitation. When it is an internal but unindexed folder, it is a configuration fix.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `permanent`                                  |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | _none_                                       |
| Classifier   | predicate, axis B (min_confidence 0.95)      |

**Examples**

- `src/loader.ts`:3 — `import { handler } from 'external-framework';`

**Predicate**

```
resolution_failure_reason_eq receiver_is_external_import
```

## `super-inherited-method` — F8 — `super` / inherited method call missed

A subclass method is invoked via `super.method()` or through inheritance. The call's receiver resolves to the parent class rather than the dispatching subclass, and the inherited method on the parent is marked unreachable.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `wip`                                        |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | _none_                                       |
| Classifier   | predicate, axis B (min_confidence 0.9)       |

**Examples**

- `src/derived.ts`:10 — `class Derived extends Base { m() { super.m(); } }`

**Predicate**

```
syntactic_feature_eq is_super_call=true
```

## `global-name-collision` — F10 — Global name collision resolves to wrong file

Two unrelated functions share a name in different files. With no receiver type to disambiguate, the resolver picks one globally, marking the other unreachable even when its real callers exist.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `wip`                                        |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | `TASK-108`                                   |
| Classifier   | _none — known, no automated classifier_      |

**Examples**

- `src/a.ts`:5 — `function handle() { /* ... */ }`
- `src/b.ts`:5 — `function handle() { /* other */ }`

## `rust-macro-invocation-call` — Rust macro invocation hides a function call

Rust macros such as `println!`, `format!`, custom proc macros, and `#[derive(...)]` expand into function calls that are not visible to tree-sitter's `.scm` queries on the pre-expansion AST. Functions invoked only through macros look unreachable.

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | `permanent`                            |
| Languages    | `rust`                                 |
| Backlog task | _none_                                 |
| Classifier   | predicate, axis A (min_confidence 0.9) |

**Examples**

- `src/main.rs`:12 — `log_event!(ctx, "started");`

**Predicate**

```
all:
  language_eq rust
  grep_line_regex [A-Za-z_][A-Za-z0-9_]*!\s*[\(\[{]
```

## `rust-trait-method-dispatch` — Trait method invoked via dynamic or generic dispatch

A Rust trait method is invoked through `&dyn Trait` or a generic parameter `T: Trait`. The concrete impl method appears unreachable because the call site resolves to the trait declaration rather than the impl.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `rust`                                  |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

**Examples**

- `src/plugin.rs`:14 — `fn run(p: &dyn Plugin) { p.execute(); }`

## `callers-outside-scope-grep-evidence` — Grep finds callers but Ariadne's call graph is empty (broad)

When `grep_call_sites` contains entries but `ariadne_call_refs` is empty, Ariadne found textual evidence of callers but its resolution pipeline failed to link those call sites to the entry. Covers module-qualified calls, cross-package callers, cross-file inheritance, protocol dispatch, intra-file call resolution failures, type-inference dispatch, and Python `@overload` stubs. Seeded from `triage_patterns.json` rule `grep-evidence-ariadne-miss` (precision 0.923 over the webpack corpus).

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `wip`                                        |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | _none_                                       |
| Classifier   | _none — known, no automated classifier_      |

**Examples**

- `lib/util/memoize.js`:1 — `memoize(fn)`

## `module-attribute-alias` — `callers-in-registry-wrong-target`: resolved target is a module-level alias

When Ariadne's diagnosis is `callers-in-registry-wrong-target`, callers exist in the call graph but were resolved to the wrong definition — typically a local alias variable rather than the actual function. Seeded from `triage_patterns.json` rule `callers-in-registry-wrong-target` (precision 1.0).

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `wip`                                        |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | _none_                                       |
| Classifier   | predicate, axis B (min_confidence 1)         |

**Examples**

- `src/torch_util.py`:74 — `revin = _revin_impl`

**Predicate**

```
diagnosis_eq callers-in-registry-wrong-target
```

## `callers-outside-scope-strict-grep-evidence` — Grep finds callers + diagnosis `callers-not-in-registry` + empty call refs

Stricter variant of `callers-outside-scope-grep-evidence`: diagnosis is `callers-not-in-registry` AND grep found call sites AND `ariadne_call_refs` is empty. Higher precision (0.952) at lower coverage. Seeded from `triage_patterns.json` rule `diagnosis-callers-not-in-registry-with-grep`.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `wip`                                        |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | _none_                                       |
| Classifier   | _none — known, no automated classifier_      |

**Examples**

- `src/utils.ts`:1 — `foo(...)`
