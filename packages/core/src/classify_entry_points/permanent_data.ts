// AUTO-GENERATED slice of the known-issues registry — do not edit by hand.
// Source of truth: .claude/skills/triage/known_issues/registry.json
// Regenerated from the source registry when its permanent slice changes.

import type { KnownIssuesRegistryFile } from "@ariadnejs/types";

export const PERMANENT_REGISTRY_FILE: KnownIssuesRegistryFile = {
  "schema_version": 1,
  "rules": [
    {
      "group_id": "dynamic-property-keyed-callback",
      "title": "Callback invoked via dynamic / computed property key",
      "description": "A function is stored in a map or object and invoked via `handlers[key](...)` or `obj[name]()` where the key is not a literal. The resolver has a collection source but no literal key, so the specific callback cannot be linked. Webpack-corpus F9 and a permanent resolver limitation when the key is computed.",
      "status": "permanent",
      "languages": [
        "typescript",
        "javascript",
        "python",
        "rust"
      ],
      "examples": [
        {
          "file": "lib/Compilation.js",
          "line": 1,
          "snippet": "this._hooks[name].call(arg)"
        }
      ],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_dynamic_property_keyed_callback",
        "min_confidence": 0.9
      },
      "observed_count": 12,
      "observed_projects": [
        "webpack"
      ],
      "last_seen_run": "2026-04-16T18-10-16.855Z",
      "classification": {
        "kind": "framework_invoked",
        "framework": "language_dispatch"
      }
    },
    {
      "group_id": "py-property-decorator-access",
      "title": "`@property` getter accessed as attribute, never captured as a call",
      "description": "A Python `@property`-decorated method is invoked implicitly by attribute access (`obj.value`), not by an explicit `obj.value()`. Tree-sitter captures only emit `@reference.call` on call expressions, so these entry points look unreachable.",
      "status": "permanent",
      "languages": [
        "python"
      ],
      "examples": [
        {
          "file": "src/model.py",
          "line": 10,
          "snippet": "@property\ndef full_name(self):\n    return f'{self.first} {self.last}'"
        }
      ],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_py_property_decorator_access",
        "min_confidence": 0.9
      },
      "classification": {
        "kind": "framework_invoked",
        "framework": "python_property"
      }
    },
    {
      "group_id": "rust-macro-invocation-call",
      "title": "Rust macro invocation hides a function call",
      "description": "Rust macros such as `println!`, `format!`, custom proc macros, and `#[derive(...)]` expand into function calls that are not visible to tree-sitter's `.scm` queries on the pre-expansion AST. Functions invoked only through macros look unreachable.",
      "status": "permanent",
      "languages": [
        "rust"
      ],
      "examples": [
        {
          "file": "src/main.rs",
          "line": 12,
          "snippet": "log_event!(ctx, \"started\");"
        }
      ],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_rust_macro_invocation_call",
        "min_confidence": 0.9
      },
      "classification": {
        "kind": "framework_invoked",
        "framework": "rust_macros"
      }
    },
    {
      "group_id": "framework-pytest-fixture",
      "title": "pytest fixture invoked by test runner",
      "description": "A function decorated with `@pytest.fixture` (or `@pytest.fixture(...)`) is invoked by the pytest runtime when a test requests it. It has no explicit call site, but it is a legitimate entry point — label as a framework true-positive.",
      "status": "permanent",
      "languages": [
        "python"
      ],
      "examples": [
        {
          "file": "tests/conftest.py",
          "line": 7,
          "snippet": "@pytest.fixture\ndef client():\n    return Client()"
        }
      ],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_framework_pytest_fixture",
        "min_confidence": 0.95
      },
      "classification": {
        "kind": "framework_invoked",
        "framework": "pytest"
      }
    },
    {
      "group_id": "framework-flask-route",
      "title": "Flask route handler invoked by Flask/Werkzeug router",
      "description": "A function decorated with `@app.route(...)` or `@blueprint.route(...)` is registered with Flask and invoked by the request dispatcher, not by a Python call expression. Label as a framework true-positive.",
      "status": "permanent",
      "languages": [
        "python"
      ],
      "examples": [
        {
          "file": "src/web.py",
          "line": 18,
          "snippet": "@app.route('/ping')\ndef ping():\n    return 'ok'"
        }
      ],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_framework_flask_route",
        "min_confidence": 0.95
      },
      "classification": {
        "kind": "framework_invoked",
        "framework": "flask"
      }
    },
    {
      "group_id": "framework-component-decorator",
      "title": "Framework `@Component`-style class invoked by framework runtime",
      "description": "Angular `@Component`, NestJS `@Controller`, or similar framework class decorators register the class with the framework's dependency-injection runtime. The class constructor and its lifecycle methods are invoked by the framework without an explicit call site.",
      "status": "permanent",
      "languages": [
        "typescript",
        "javascript"
      ],
      "examples": [
        {
          "file": "src/app.component.ts",
          "line": 6,
          "snippet": "@Component({ selector: 'app-root', template: '...' })\nexport class AppComponent {}"
        }
      ],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_framework_component_decorator",
        "min_confidence": 0.95
      },
      "classification": {
        "kind": "framework_invoked",
        "framework": "angular"
      }
    },
    {
      "group_id": "dynamic-dispatch",
      "title": "dynamic-dispatch",
      "description": "Permanent limitation. Webpack invokes dependency-template `apply()` methods through a constructor-keyed Map (`dependencyTemplates.get(constructor).apply(...)`); the callee is chosen at runtime by Map lookup, so no static call site exists.",
      "status": "permanent",
      "languages": [
        "javascript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_dynamic_dispatch",
        "min_confidence": 0.9
      },
      "observed_count": 43,
      "observed_projects": [
        "webpack",
        "lodash",
        "prisma"
      ],
      "last_seen_run": "2026-04-27T16-24-40.808Z"
    },
    {
      "group_id": "dynamic-dispatch-reporter-constructor",
      "title": "dynamic-dispatch-reporter-constructor",
      "description": "Permanent limitation. Mocha reporter class constructors are instantiated via string-keyed dispatch (`new this._reporter(...)` after a `builtinReporters[name]` lookup); no direct `new ClassName()` call site exists.",
      "status": "permanent",
      "languages": [
        "javascript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_dynamic_dispatch_reporter_constructor",
        "min_confidence": 0.9
      },
      "observed_count": 12,
      "observed_projects": [
        "mocha"
      ],
      "last_seen_run": "2026-04-23T20-41-21.302Z"
    },
    {
      "group_id": "dynamic-require-constructor",
      "title": "dynamic-require-constructor",
      "description": "Permanent limitation. Class identity flows through a runtime dynamic require/property lookup (`require(require.resolve(name))`, `this._reporter = require(...)`) and is instantiated via `new R(...)`; the constructor's call site is runtime string-keyed module dispatch.",
      "status": "permanent",
      "languages": [
        "javascript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_dynamic_require_constructor",
        "min_confidence": 0.9
      },
      "observed_count": 1,
      "observed_projects": [
        "mocha"
      ],
      "last_seen_run": "2026-04-23T20-41-21.302Z"
    },
    {
      "group_id": "framework-lifecycle-dispatch",
      "title": "framework-lifecycle-dispatch",
      "description": "Permanent limitation. NestJS reads method-level handler decorators (`@Get`/`@Post`/`@SubscribeMessage`/`@MessagePattern`/`@Cron`/...) via reflect-metadata at startup and dispatches to the method at runtime; no textual call site exists. Subsumes the former byte-identical `framework-decorator-dispatch`.",
      "status": "permanent",
      "languages": [
        "typescript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_framework_lifecycle_dispatch",
        "min_confidence": 0.9
      },
      "observed_count": 6,
      "observed_projects": [
        "nest"
      ],
      "last_seen_run": "2026-04-23T22-12-28.705Z"
    },
    {
      "group_id": "framework-lifecycle-override",
      "title": "framework-lifecycle-override",
      "description": "Permanent limitation. Node.js stream internals invoke the underscore-prefixed stream-protocol overrides (`_transform`/`_flush`/`_read`/`_write`/`_construct`/`_destroy`/`_final`) via the stream protocol; no application-source call site exists.",
      "status": "permanent",
      "languages": [
        "typescript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_framework_lifecycle_override",
        "min_confidence": 0.9
      },
      "observed_count": 1,
      "observed_projects": [
        "nest"
      ],
      "last_seen_run": "2026-04-23T22-12-28.705Z"
    },
    {
      "group_id": "string-keyed-dispatch",
      "title": "string-keyed-dispatch",
      "description": "Permanent limitation. Angular's JIT stores ɵɵ-prefixed runtime instructions in the `angularCoreEnv` string-keyed map and invokes them via `new Function(...)` over compiler-emitted source; no static AST call site exists. Subsumes the former `angular-generated-instruction-call` and `compiler-generated-dynamic-dispatch` (same ɵɵ + /packages/core/src/ gate, narrower paths).",
      "status": "permanent",
      "languages": [
        "typescript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_string_keyed_dispatch",
        "min_confidence": 0.95
      },
      "observed_count": 27,
      "observed_projects": [
        "angular"
      ],
      "last_seen_run": "2026-04-25T17-07-32.678Z"
    },
    {
      "group_id": "dynamic-new-function-dispatch",
      "title": "dynamic-new-function-dispatch",
      "description": "Permanent limitation. The function's only textual references live inside string literals passed to `new Function(...)` / `eval(...)`; the runtime constructs and invokes it from a string.",
      "status": "permanent",
      "languages": [
        "javascript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_dynamic_new_function_dispatch",
        "min_confidence": 0.9
      },
      "observed_count": 1,
      "observed_projects": [
        "lodash"
      ],
      "last_seen_run": "2026-04-27T11-02-57.035Z"
    },
    {
      "group_id": "eval-based-dynamic-dispatch",
      "title": "eval-based-dynamic-dispatch",
      "description": "Permanent limitation. Dunder-named template-compiler locals (`__link__`, `__loop__`, ...) are referenced only from generated source strings passed to `eval(...)` / `new Function(...)`; the call site lives inside a string, invisible to static analysis.",
      "status": "permanent",
      "languages": [
        "javascript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_eval_based_dynamic_dispatch",
        "min_confidence": 0.9
      },
      "observed_count": 8,
      "observed_projects": [
        "lodash"
      ],
      "last_seen_run": "2026-04-27T11-02-57.035Z"
    },
    {
      "group_id": "framework-lifecycle-handler",
      "title": "framework-lifecycle-handler",
      "description": "Permanent limitation. yargs invokes `CommandModule.handler(args)` at runtime via the interface contract; there is no in-source call site for the handler.",
      "status": "permanent",
      "languages": [
        "typescript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_framework_lifecycle_handler",
        "min_confidence": 0.9
      },
      "observed_count": 12,
      "observed_projects": [
        "typeorm"
      ],
      "last_seen_run": "2026-04-27T16-19-42.325Z"
    },
    {
      "group_id": "bundler-module-substitution",
      "title": "bundler-module-substitution",
      "description": "Permanent limitation. esbuild's fill-plugin `onResolve` hook redirects a Node built-in import to a filler file at build time, so the filler's exports are reachable only through the bundler's runtime path substitution, never the static call graph. Scope: TypeScript fillers with no resolved callers (the observed prisma shape); subsumes the former byte-identical `bundler-module-path-substitution` and the broader `dynamic-runtime-injection`.",
      "status": "permanent",
      "languages": [
        "typescript"
      ],
      "examples": [],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_bundler_module_substitution",
        "min_confidence": 0.9
      },
      "observed_count": 4,
      "observed_projects": [
        "prisma"
      ],
      "last_seen_run": "2026-04-27T16-24-40.808Z"
    },
    {
      "group_id": "py-dunder-protocol",
      "title": "Python framework-invoked dunder method (`__str__`, `__repr__`, etc.)",
      "description": "Python dunder methods invoked by the runtime via the language protocol layer (`__str__`/`__repr__` for string conversion, `__eq__`/`__hash__`/`__lt__`/`__gt__` for comparisons, `__iter__`/`__next__` for iteration, `__enter__`/`__exit__` for context managers, etc.) are never called from user code. Excludes the traceable subset (`__init__`, `__call__`, `__new__`) which Ariadne can resolve through constructor / callable-instance dispatch. Replaces the hardcoded `filter_entry_points.python.ts` list.",
      "status": "permanent",
      "languages": [
        "python"
      ],
      "examples": [
        {
          "file": "src/model.py",
          "line": 5,
          "snippet": "def __str__(self): return self.name"
        },
        {
          "file": "src/iterable.py",
          "line": 8,
          "snippet": "def __iter__(self): return iter(self._items)"
        }
      ],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_py_dunder_protocol",
        "min_confidence": 1
      },
      "classification": {
        "kind": "dunder_protocol"
      }
    },
    {
      "group_id": "untyped-attribute-receiver",
      "title": "Python method reached only via an untyped self-attribute receiver",
      "description": "Permanent limitation. A Python method reachable only as `self.<attr>.<method>()` where `self.<attr>` is an untyped Cython `object` constructor parameter that never gains a followable type. The receiver collapses to the caller's own enclosing class, the method is not found there (`resolution_failure.reason = member_type_unknown`, resolved type's file == caller file), and the call edge is genuinely out of static reach.",
      "status": "permanent",
      "languages": [
        "python"
      ],
      "examples": [
        {
          "file": "pandas/core/indexing.py",
          "line": 3171,
          "snippet": "self.obj._set_value(*key, value=value, takeable=self._takeable)"
        }
      ],
      "classifier": {
        "kind": "builtin",
        "function_name": "check_untyped_attribute_receiver",
        "min_confidence": 0.9
      }
    }
  ]
};
