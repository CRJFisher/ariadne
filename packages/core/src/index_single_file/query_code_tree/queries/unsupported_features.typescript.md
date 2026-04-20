# Unsupported features — typescript

Canonical list of known Ariadne failure modes that affect this language. Generated from `.claude/skills/self-repair-pipeline/known_issues/registry.json` by `.claude/skills/self-repair-pipeline/scripts/render_unsupported_features.ts`. Do not edit by hand — edit the registry and re-render.

Entries: 19

## `method-chain-dispatch` — Method call on call-chain receiver unresolved

A method is invoked on the result of another call (e.g. `a.b().c()`), but Ariadne cannot carry the intermediate call's return type through to resolve the final method. Common in builder patterns and fluent APIs. Observed as a dominant group in the webpack corpus.

| Field        | Value                                                |
| ------------ | ---------------------------------------------------- |
| Status       | `wip`                                                |
| Languages    | `typescript`, `javascript`, `python`, `rust`         |
| Backlog task | _none_                                               |
| Classifier   | builtin `method_chain_dispatch` (min_confidence 0.9) |

**Examples**

- `lib/util/Hash.js`:1 — `createHash('md4').update(buf).digest('hex')`

## `polymorphic-subtype-dispatch` — Method call resolves to base or wrong class in polymorphic hierarchy

A call on a base-class or generic receiver resolves to the base method (or an unrelated same-named method) rather than the concrete subclass override, so subclass entry points appear unreachable. Covers protocol/interface dispatch and generic parameter erasure. Webpack-corpus F7.

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Status       | `wip`                                                       |
| Languages    | `typescript`, `javascript`, `python`, `rust`                |
| Backlog task | `TASK-198`                                                  |
| Classifier   | builtin `polymorphic_subtype_dispatch` (min_confidence 0.9) |

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

## `constructor-new-expression` — `new Name(...)` call site missed by tree-sitter query

A constructor is invoked via `new Name(...)`, grep sees the literal text, but the `.scm` query did not fire `@reference.constructor`, so no `CallReference` exists. Tree-sitter capture gap for constructor calls, particularly on TS/JS namespaced or generic constructors.

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Status       | `wip`                                                                 |
| Languages    | `typescript`, `javascript`                                            |
| Backlog task | _none_                                                                |
| Classifier   | builtin `constructor_new_expression_capture_gap` (min_confidence 0.9) |

**Examples**

- `lib/dependencies/WorkerPlugin.js`:1 — `const worker = new WorkerDependency(req, range, parserState);`

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

## `aliased-re-export` — F5 — Aliased re-export (`export { orig as alias }`) broken

A symbol is re-exported under a new name via `export { original as alias }`. The resolution registry binds the alias to the barrel location but does not walk back to the original definition, so calls via the alias resolve to nothing.

| Field        | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Status       | `wip`                                                  |
| Languages    | `typescript`, `javascript`                             |
| Backlog task | `TASK-156`                                             |
| Classifier   | builtin `aliased_re_export_chain` (min_confidence 0.9) |

**Examples**

- `src/index.ts`:1 — `export { original_name as alias } from './impl';`

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

## `ts-jsx-component-call` — JSX/TSX component element not captured as a call

`<Component />` in JSX/TSX is a function invocation at runtime but the tree-sitter query does not emit `@reference.call` for JSX elements. Components that are only referenced via JSX appear unreachable.

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | `wip`                                  |
| Languages    | `typescript`, `javascript`             |
| Backlog task | _none_                                 |
| Classifier   | predicate, axis A (min_confidence 0.9) |

**Examples**

- `src/app.tsx`:8 — `<UserCard user={u} />`

**Predicate**

```
all:
  any:
    language_eq typescript
    language_eq javascript
  grep_line_regex <[A-Z][A-Za-z0-9_]*[\s/>]
  missing_capture_at_grep_hit reference.call
```

## `ts-decorator-factory-call` — Decorator factory invocation not captured as a call

`@Decorator(args)` attached to a class or method invokes the factory, but the decorator expression is not currently emitted as `@reference.call`, so the factory itself can look unreachable.

| Field        | Value                                  |
| ------------ | -------------------------------------- |
| Status       | `wip`                                  |
| Languages    | `typescript`, `javascript`             |
| Backlog task | _none_                                 |
| Classifier   | predicate, axis A (min_confidence 0.9) |

**Examples**

- `src/controller.ts`:4 — `@Injectable({ scope: 'singleton' }) class Controller {}`

**Predicate**

```
all:
  grep_line_regex ^\s*@[A-Za-z_][A-Za-z0-9_]*\s*\(
  missing_capture_at_grep_hit reference.call
```

## `ts-private-method-unreachable` — Private class method with only intra-class callers reported unreachable

A `private` method called only through `this.m()` inside the same class is not picked up because the self-reference resolution does not walk private members, or because the `this` receiver does not bind back to the enclosing class.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`, `javascript`              |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

**Examples**

- `src/service.ts`:12 — `class Service { private encode() {} public run() { this.encode(); } }`

## `framework-component-decorator` — Framework `@Component`-style class invoked by framework runtime

Angular `@Component`, NestJS `@Controller`, or similar framework class decorators register the class with the framework's dependency-injection runtime. The class constructor and its lifecycle methods are invoked by the framework without an explicit call site.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `permanent`                             |
| Languages    | `typescript`, `javascript`              |
| Backlog task | _none_                                  |
| Classifier   | predicate, axis C (min_confidence 0.95) |

**Examples**

- `src/app.component.ts`:6 — `@Component({ selector: 'app-root', template: '...' }) export class AppComponent {}`

**Predicate**

```
decorator_matches @Component*
```

## `callers-outside-scope-grep-evidence` — Grep finds callers but Ariadne's call graph is empty (broad)

When `grep_call_sites` contains entries but `ariadne_call_refs` is empty, Ariadne found textual evidence of callers but its resolution pipeline failed to link those call sites to the entry. Covers module-qualified calls, cross-package callers, cross-file inheritance, protocol dispatch, intra-file call resolution failures, type-inference dispatch, and Python `@overload` stubs. Seeded from `triage_patterns.json` rule `grep-evidence-ariadne-miss` (precision 0.923 over the webpack corpus).

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Status       | `wip`                                                       |
| Languages    | `typescript`, `javascript`, `python`, `rust`                |
| Backlog task | _none_                                                      |
| Classifier   | builtin `grep_evidence_ariadne_miss` (min_confidence 0.923) |

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

| Field        | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Status       | `permanent`                                                 |
| Languages    | `typescript`, `javascript`, `python`                        |
| Backlog task | _none_                                                      |
| Classifier   | builtin `lambda_handler_file_convention` (min_confidence 1) |

**Examples**

- `src/handlers/ingest_lambda_handler.py`:1 — `def handler(event, context): ...`

## `callers-outside-scope-strict-grep-evidence` — Grep finds callers + diagnosis `callers-not-in-registry` + empty call refs

Stricter variant of `callers-outside-scope-grep-evidence`: diagnosis is `callers-not-in-registry` AND grep found call sites AND `ariadne_call_refs` is empty. Higher precision (0.952) at lower coverage. Seeded from `triage_patterns.json` rule `diagnosis-callers-not-in-registry-with-grep`.

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Status       | `wip`                                                              |
| Languages    | `typescript`, `javascript`, `python`, `rust`                       |
| Backlog task | _none_                                                             |
| Classifier   | builtin `callers_not_in_registry_with_grep` (min_confidence 0.952) |

**Examples**

- `src/utils.ts`:1 — `foo(...)`
