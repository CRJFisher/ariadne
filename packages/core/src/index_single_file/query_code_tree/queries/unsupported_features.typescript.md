# Unsupported features — typescript

Canonical list of known Ariadne failure modes that affect this language. Generated from `.claude/skills/self-repair-pipeline/known_issues/registry.json` by `.claude/skills/self-repair-pipeline/scripts/render_unsupported_features.ts`. Do not edit by hand — edit the registry and re-render.

Entries: 110

## `method-chain-dispatch` — Method call on call-chain receiver unresolved

A method is invoked on the result of another call (e.g. `a.b().c()`), but Ariadne cannot carry the intermediate call's return type through to resolve the final method. Common in builder patterns and fluent APIs. Observed as a dominant group in the webpack corpus.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | `wip`                                        |
| Languages    | `typescript`, `javascript`, `python`, `rust` |
| Backlog task | `TASK-206`                                   |
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

## `constructor-new-expression` — `new Name(...)` call site missed by tree-sitter query

A constructor is invoked via `new Name(...)`, grep sees the literal text, but the `.scm` query did not fire `@reference.constructor`, so no `CallReference` exists. Tree-sitter capture gap for constructor calls, particularly on TS/JS namespaced or generic constructors.

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Status       | `wip`                                                            |
| Languages    | `typescript`, `javascript`                                       |
| Backlog task | `TASK-228`                                                       |
| Classifier   | builtin, `check_constructor_new_expression` (min_confidence 0.9) |

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

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Status       | `wip`                                                                 |
| Languages    | `typescript`, `javascript`, `python`                                  |
| Backlog task | `TASK-187`                                                            |
| Classifier   | builtin, `check_inline_constructor_method_chain` (min_confidence 0.9) |

**Examples**

- `test/suite.ts`:3 — `new Builder().with_opt().build()`

## `aliased-re-export` — F5 — Aliased re-export (`export { orig as alias }`) broken

A symbol is re-exported under a new name via `export { original as alias }`. The resolution registry binds the alias to the barrel location but does not walk back to the original definition, so calls via the alias resolve to nothing.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`, `javascript`              |
| Backlog task | `TASK-156`                              |
| Classifier   | _none — known, no automated classifier_ |

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

## `wasm-cross-language-call` — wasm-cross-language-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `abstract-class-polymorphic-dispatch` — abstract-class-polymorphic-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-198`                              |
| Classifier   | _none — known, no automated classifier_ |

## `anonymous-class-inheritance-resolution` — anonymous-class-inheritance-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `barrel-reexport` — barrel-reexport

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-218`                              |
| Classifier   | _none — known, no automated classifier_ |

## `cross-package-call-untracked` — cross-package-call-untracked

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `cross-package-method-resolution` — cross-package-method-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `destructured-property-method-call` — destructured-property-method-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `dynamic-constructor-dispatch` — dynamic-constructor-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-231`                              |
| Classifier   | _none — known, no automated classifier_ |

## `dynamic-require-resolution` — dynamic-require-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `framework-decorator-dispatch` — framework-decorator-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Status       | `wip`                                                              |
| Languages    | `typescript`                                                       |
| Backlog task | _none_                                                             |
| Classifier   | builtin, `check_framework_decorator_dispatch` (min_confidence 0.9) |

## `framework-lifecycle-dispatch` — framework-lifecycle-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Status       | `wip`                                                              |
| Languages    | `typescript`                                                       |
| Backlog task | _none_                                                             |
| Classifier   | builtin, `check_framework_lifecycle_dispatch` (min_confidence 0.9) |

## `framework-lifecycle-override` — framework-lifecycle-override

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Status       | `wip`                                                              |
| Languages    | `typescript`                                                       |
| Backlog task | _none_                                                             |
| Classifier   | builtin, `check_framework_lifecycle_override` (min_confidence 0.9) |

## `generic-type-erasure` — generic-type-erasure

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `inherited-method-call` — inherited-method-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `interface-polymorphic-dispatch` — interface-polymorphic-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-198`                              |
| Classifier   | _none — known, no automated classifier_ |

## `intra-class-method-call` — intra-class-method-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Status       | `wip`                                                         |
| Languages    | `typescript`                                                  |
| Backlog task | _none_                                                        |
| Classifier   | builtin, `check_intra_class_method_call` (min_confidence 0.9) |

## `method-call-in-callback-unresolved` — method-call-in-callback-unresolved

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-205`                              |
| Classifier   | _none — known, no automated classifier_ |

## `method-call-on-typed-receiver` — method-call-on-typed-receiver

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-205`                              |
| Classifier   | _none — known, no automated classifier_ |

## `polymorphic-interface-dispatch` — polymorphic-interface-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-198`                              |
| Classifier   | _none — known, no automated classifier_ |

## `stored-callback-via-object-property` — stored-callback-via-object-property

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Status       | `wip`                                                                     |
| Languages    | `typescript`                                                              |
| Backlog task | _none_                                                                    |
| Classifier   | builtin, `check_stored_callback_via_object_property` (min_confidence 0.9) |

## `tsconfig-path-alias` — tsconfig-path-alias

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `tsconfig-paths-not-resolved` — tsconfig-paths-not-resolved

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `typed-field-method-dispatch` — typed-field-method-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Status       | `wip`                                                             |
| Languages    | `typescript`                                                      |
| Backlog task | `TASK-205`                                                        |
| Classifier   | builtin, `check_typed_field_method_dispatch` (min_confidence 0.9) |

## `unindexed-caller-files` — unindexed-caller-files

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-190.13`                           |
| Classifier   | _none — known, no automated classifier_ |

## `aliased-import-method-dispatch` — aliased-import-method-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Status       | `wip`                                                                |
| Languages    | `typescript`                                                         |
| Backlog task | _none_                                                               |
| Classifier   | builtin, `check_aliased_import_method_dispatch` (min_confidence 0.9) |

## `angular-framework-lifecycle-dispatch` — angular-framework-lifecycle-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `angular-generated-instruction-call` — angular-generated-instruction-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Status       | `wip`                                                                     |
| Languages    | `typescript`                                                              |
| Backlog task | _none_                                                                    |
| Classifier   | builtin, `check_angular_generated_instruction_call` (min_confidence 0.95) |

## `any-typed-receiver-method-call` — any-typed-receiver-method-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `compiler-generated-dynamic-dispatch` — compiler-generated-dynamic-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| Status       | `wip`                                                                      |
| Languages    | `typescript`                                                               |
| Backlog task | `TASK-226`                                                                 |
| Classifier   | builtin, `check_compiler_generated_dynamic_dispatch` (min_confidence 0.95) |

## `cross-file-import-resolution` — cross-file-import-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `cross-package-registry-gap` — cross-package-registry-gap

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Status       | `wip`                                                            |
| Languages    | `typescript`                                                     |
| Backlog task | `TASK-198`                                                       |
| Classifier   | builtin, `check_cross_package_registry_gap` (min_confidence 0.9) |

## `dependency-injection-type-resolution` — dependency-injection-type-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| Status       | `wip`                                                                      |
| Languages    | `typescript`                                                               |
| Backlog task | _none_                                                                     |
| Classifier   | builtin, `check_dependency_injection_type_resolution` (min_confidence 0.9) |

## `dynamic-cast-structural-type-dispatch` — dynamic-cast-structural-type-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Status       | `wip`                                                                       |
| Languages    | `typescript`                                                                |
| Backlog task | _none_                                                                      |
| Classifier   | builtin, `check_dynamic_cast_structural_type_dispatch` (min_confidence 0.9) |

## `external-framework-interface-dispatch` — external-framework-interface-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `getter-property-access` — getter-property-access

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-233`                              |
| Classifier   | _none — known, no automated classifier_ |

## `higher-order-function-callback` — higher-order-function-callback

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Status       | `wip`                                                                |
| Languages    | `typescript`                                                         |
| Backlog task | `TASK-204`                                                           |
| Classifier   | builtin, `check_higher_order_function_callback` (min_confidence 0.9) |

## `import-resolution-missed` — import-resolution-missed

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Status       | `wip`                                                          |
| Languages    | `typescript`                                                   |
| Backlog task | _none_                                                         |
| Classifier   | builtin, `check_import_resolution_missed` (min_confidence 0.9) |

## `instance-method-call-unresolved` — instance-method-call-unresolved

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-205`                              |
| Classifier   | _none — known, no automated classifier_ |

## `instance-method-dispatch` — instance-method-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-182`                              |
| Classifier   | _none — known, no automated classifier_ |

## `interface-method-dispatch` — interface-method-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-198`                              |
| Classifier   | _none — known, no automated classifier_ |

## `missed-named-import-call` — missed-named-import-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `property-getter-dispatch` — property-getter-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Status       | `wip`                                                          |
| Languages    | `typescript`                                                   |
| Backlog task | _none_                                                         |
| Classifier   | builtin, `check_property_getter_dispatch` (min_confidence 0.9) |

## `singleton-instance-method-call` — singleton-instance-method-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `static-method-resolution` — static-method-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Status       | `wip`                                                          |
| Languages    | `typescript`                                                   |
| Backlog task | _none_                                                         |
| Classifier   | builtin, `check_static_method_resolution` (min_confidence 0.9) |

## `string-keyed-dispatch` — string-keyed-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Status       | `wip`                                                        |
| Languages    | `typescript`                                                 |
| Backlog task | `TASK-212`                                                   |
| Classifier   | builtin, `check_string_keyed_dispatch` (min_confidence 0.95) |

## `type-based-method-dispatch` — type-based-method-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Status       | `wip`                                                            |
| Languages    | `typescript`                                                     |
| Backlog task | `TASK-205`                                                       |
| Classifier   | builtin, `check_type_based_method_dispatch` (min_confidence 0.9) |

## `anonymous-function-in-object-or-chain` — anonymous-function-in-object-or-chain

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `builtin-higher-order-callback` — builtin-higher-order-callback

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-204`                              |
| Classifier   | _none — known, no automated classifier_ |

## `constructor-instance-method-resolution` — constructor-instance-method-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| Status       | `wip`                                                                        |
| Languages    | `typescript`                                                                 |
| Backlog task | `TASK-187`                                                                   |
| Classifier   | builtin, `check_constructor_instance_method_resolution` (min_confidence 0.9) |

## `cross-package-call` — cross-package-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-190.13`                           |
| Classifier   | _none — known, no automated classifier_ |

## `dynamic-or-untyped-property-access` — dynamic-or-untyped-property-access

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Status       | `wip`                                                                    |
| Languages    | `typescript`                                                             |
| Backlog task | _none_                                                                   |
| Classifier   | builtin, `check_ts_class_getter_no_textual_callers` (min_confidence 0.9) |

## `framework-command-builder-callback` — framework-command-builder-callback

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Status       | `wip`                                                                    |
| Languages    | `typescript`                                                             |
| Backlog task | `TASK-198`                                                               |
| Classifier   | builtin, `check_framework_command_builder_callback` (min_confidence 0.9) |

## `framework-lifecycle-handler` — framework-lifecycle-handler

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Status       | `wip`                                                             |
| Languages    | `typescript`                                                      |
| Backlog task | `TASK-223`                                                        |
| Classifier   | builtin, `check_framework_lifecycle_handler` (min_confidence 0.9) |

## `getter-accessor-not-tracked` — getter-accessor-not-tracked

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Status       | `wip`                                                             |
| Languages    | `typescript`                                                      |
| Backlog task | _none_                                                            |
| Classifier   | builtin, `check_getter_accessor_not_tracked` (min_confidence 0.9) |

## `import-resolution-miss` — import-resolution-miss

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `inherited-method-dispatch` — inherited-method-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `inherited-static-method-dispatch` — inherited-static-method-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `inline-callback` — inline-callback

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                 |
| ------------ | ----------------------------------------------------- |
| Status       | `wip`                                                 |
| Languages    | `typescript`                                          |
| Backlog task | `TASK-204`                                            |
| Classifier   | builtin, `check_inline_callback` (min_confidence 0.9) |

## `interface-dispatch` — interface-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-198`                              |
| Classifier   | _none — known, no automated classifier_ |

## `jsx-mdx-component-usage` — jsx-mdx-component-usage

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Status       | `wip`                                                         |
| Languages    | `typescript`                                                  |
| Backlog task | _none_                                                        |
| Classifier   | builtin, `check_jsx_mdx_component_usage` (min_confidence 0.9) |

## `method-call-on-callback-parameter` — method-call-on-callback-parameter

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `method-call-on-typed-instance` — method-call-on-typed-instance

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| Status       | `wip`                                                                |
| Languages    | `typescript`                                                         |
| Backlog task | _none_                                                               |
| Classifier   | builtin, `check_method_call_on_typed_instance` (min_confidence 0.85) |

## `method-call-unresolved` — method-call-unresolved

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| Status       | `wip`                                                                           |
| Languages    | `typescript`                                                                    |
| Backlog task | `TASK-184`                                                                      |
| Classifier   | builtin, `check_method_call_unresolved_receiver_type_lost` (min_confidence 0.9) |

## `method-chain-return-type-resolution` — method-chain-return-type-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `static-method-call-unresolved` — static-method-call-unresolved

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `static-method-call` — static-method-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `test-file-callers-missed` — test-file-callers-missed

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Status       | `wip`                                                          |
| Languages    | `typescript`                                                   |
| Backlog task | `TASK-182`                                                     |
| Classifier   | builtin, `check_test_file_callers_missed` (min_confidence 0.9) |

## `type-cast-dispatch` — type-cast-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Status       | `wip`                                                    |
| Languages    | `typescript`                                             |
| Backlog task | _none_                                                   |
| Classifier   | builtin, `check_type_cast_dispatch` (min_confidence 0.9) |

## `type-cast-receiver` — type-cast-receiver

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Status       | `wip`                                                    |
| Languages    | `typescript`                                             |
| Backlog task | _none_                                                   |
| Classifier   | builtin, `check_type_cast_receiver` (min_confidence 0.9) |

## `unindexed-callers` — unindexed-callers

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `bundler-module-path-substitution` — bundler-module-path-substitution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Status       | `wip`                                                                  |
| Languages    | `typescript`                                                           |
| Backlog task | _none_                                                                 |
| Classifier   | builtin, `check_bundler_module_path_substitution` (min_confidence 0.9) |

## `bundler-module-substitution` — bundler-module-substitution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Status       | `wip`                                                             |
| Languages    | `typescript`                                                      |
| Backlog task | _none_                                                            |
| Classifier   | builtin, `check_bundler_module_substitution` (min_confidence 0.9) |

## `callback-stored-in-dictionary` — callback-stored-in-dictionary

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `computed-property-method-caller` — computed-property-method-caller

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Status       | `wip`                                                                 |
| Languages    | `typescript`                                                          |
| Backlog task | _none_                                                                |
| Classifier   | builtin, `check_computed_property_method_caller` (min_confidence 0.9) |

## `const-arrow-function-export` — const-arrow-function-export

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-190.13`                           |
| Classifier   | _none — known, no automated classifier_ |

## `cross-package-import-resolution` — cross-package-import-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-235`                              |
| Classifier   | _none — known, no automated classifier_ |

## `cross-package-workspace-import` — cross-package-workspace-import

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `dynamic-class-instantiation` — dynamic-class-instantiation

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-184`                              |
| Classifier   | _none — known, no automated classifier_ |

## `dynamic-runtime-injection` — dynamic-runtime-injection

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| Status       | `wip`                                                           |
| Languages    | `typescript`                                                    |
| Backlog task | _none_                                                          |
| Classifier   | builtin, `check_dynamic_runtime_injection` (min_confidence 0.9) |

## `getter-access-not-tracked` — getter-access-not-tracked

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `iife-not-tracked` — iife-not-tracked

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `indirect-function-reference` — indirect-function-reference

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `namespace-reexport-member-access` — namespace-reexport-member-access

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `private-class-field-method` — private-class-field-method

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Status       | `wip`                                                            |
| Languages    | `typescript`                                                     |
| Backlog task | `TASK-216`                                                       |
| Classifier   | builtin, `check_private_class_field_method` (min_confidence 0.9) |

## `private-field-method-resolution` — private-field-method-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| Status       | `wip`                                                                  |
| Languages    | `typescript`                                                           |
| Backlog task | `TASK-230`                                                             |
| Classifier   | builtin, `check_private_field_method_resolution` (min_confidence 0.95) |

## `proxy-dispatch` — proxy-dispatch

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `test-file-exclusion` — test-file-exclusion

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-182`                              |
| Classifier   | _none — known, no automated classifier_ |

## `tsconfig-paths-import-resolution` — tsconfig-paths-import-resolution

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `unindexed-script-caller` — unindexed-script-caller

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `unresolved-import-caller` — unresolved-import-caller

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | _none_                                  |
| Classifier   | _none — known, no automated classifier_ |

## `unresolved-instance-method-call` — unresolved-instance-method-call

Proposed by triage-curator investigator — fill in before enabling.

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| Status       | `wip`                                   |
| Languages    | `typescript`                            |
| Backlog task | `TASK-182`                              |
| Classifier   | _none — known, no automated classifier_ |
