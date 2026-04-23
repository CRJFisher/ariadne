# Unsupported features — python

Canonical list of known Ariadne failure modes that affect this language. Generated from `.claude/skills/self-repair-pipeline/known_issues/registry.json` by `.claude/skills/self-repair-pipeline/scripts/render_unsupported_features.ts`. Do not edit by hand — edit the registry and re-render.

Entries: 18

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

## `aliased-receiver-type-lost` — F1 — Aliased-receiver method call with type lost

A method is called on a variable whose declared type is unknown (no annotation, no inferable initialiser). The receiver resolves to a variable definition but the resolver cannot recover the class on which to look up the method.

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | `wip`                                  |
| Languages    | `typescript`, `javascript`, `python`   |
| Backlog task | _none_                                 |
| Classifier   | predicate, axis B (min_confidence 0.9) |

**Examples**

- `src/service.ts`:12 — `const svc = create(); svc.run();`

**Predicate**

```
all:
  resolution_failure_reason_eq receiver_type_unknown
  receiver_kind_eq identifier
```

## `factory-return-type-unknown` — F2 — Receiver assigned from factory with unknown return type

A variable is assigned the result of a function call whose return type Ariadne cannot infer (no explicit annotation, no local body analysis). Subsequent method calls on that variable cannot be resolved.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`, `javascript`, `python`    |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

**Examples**

- `src/pool.ts`:7 — `const client = get_client(); client.connect();`

## `inline-constructor-method-chain` — F3 — Inline `new X().method()` unresolved

The source line contains an inline constructor followed by a method call (`new Builder().with_x().build()`). The tree-sitter capture fires but the resolver cannot track the constructed type across the intermediate chain to dispatch the final method.

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | `wip`                                  |
| Languages    | `typescript`, `javascript`, `python`   |
| Backlog task | _none_                                 |
| Classifier   | predicate, axis B (min_confidence 0.9) |

**Examples**

- `test/suite.ts`:3 — `new Builder().with_opt().build()`

**Predicate**

```
all:
  grep_line_regex new\s+[A-Z][A-Za-z0-9_]*\s*\([^)]*\)\s*\.
  diagnosis_eq callers-in-registry-unresolved
```

## `python-module-attribute-call` — F4 — Python `module.func()` call not resolved via namespace receiver

In Python, `module.func()` where `module` is imported directly (not via `import module`) resolves through an `ImportDefinition` whose target file is not re-entered for name lookup, so the callee's definition is missed.

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | `wip`                                  |
| Languages    | `python`                               |
| Backlog task | `TASK-190.11`                          |
| Classifier   | predicate, axis B (min_confidence 0.9) |

**Examples**

- `src/cli.py`:4 — `from utils import helpers helpers.run()`

**Predicate**

```
all:
  language_eq python
  resolution_failure_reason_eq import_unresolved
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

## `py-property-decorator-access` — `@property` getter accessed as attribute, never captured as a call

A Python `@property`-decorated method is invoked implicitly by attribute access (`obj.value`), not by an explicit `obj.value()`. Tree-sitter captures only emit `@reference.call` on call expressions, so these entry points look unreachable.

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | `permanent`                            |
| Languages    | `python`                               |
| Backlog task | _none_                                 |
| Classifier   | predicate, axis A (min_confidence 0.9) |

**Examples**

- `src/model.py`:10 — `@property def full_name(self):     return f'{self.first} {self.last}'`

**Predicate**

```
all:
  language_eq python
  decorator_matches @property
```

## `py-wildcard-import-caller` — Caller inside a `from x import *` module not linked back

Python wildcard imports (`from module import *`) bind names into the importing module's namespace without producing explicit per-name import records. Functions that are only called via a wildcard import look unreachable to the resolver.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `python`                                |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

**Examples**

- `src/api.py`:2 — `from .helpers import * run_task()`

## `framework-pytest-fixture` — pytest fixture invoked by test runner

A function decorated with `@pytest.fixture` (or `@pytest.fixture(...)`) is invoked by the pytest runtime when a test requests it. It has no explicit call site, but it is a legitimate entry point — label as a framework true-positive.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `permanent`                             |
| Languages    | `python`                                |
| Backlog task | _none_                                  |
| Classifier   | predicate, axis C (min_confidence 0.95) |

**Examples**

- `tests/conftest.py`:7 — `@pytest.fixture def client():     return Client()`

**Predicate**

```
all:
  language_eq python
  decorator_matches @pytest.fixture*
```

## `framework-flask-route` — Flask route handler invoked by Flask/Werkzeug router

A function decorated with `@app.route(...)` or `@blueprint.route(...)` is registered with Flask and invoked by the request dispatcher, not by a Python call expression. Label as a framework true-positive.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `permanent`                             |
| Languages    | `python`                                |
| Backlog task | _none_                                  |
| Classifier   | predicate, axis C (min_confidence 0.95) |

**Examples**

- `src/web.py`:18 — `@app.route('/ping') def ping():     return 'ok'`

**Predicate**

```
all:
  language_eq python
  decorator_matches @*.route*
```

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

## `true-positive-lambda-handler` — AWS Lambda handler file convention indicates framework entry point

Functions defined in files whose path contains `_lambda_handler` are AWS Lambda handler entry points, invoked by AWS infrastructure and never called from source code. Seeded from `triage_patterns.json` rule `lambda-handler-file-true-positive` (precision 1.0).

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `permanent`                             |
| Languages    | `typescript`, `javascript`, `python`    |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

**Examples**

- `src/handlers/ingest_lambda_handler.py`:1 — `def handler(event, context): ...`

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
