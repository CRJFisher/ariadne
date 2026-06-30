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
        "kind": "predicate",
        "axis": "B",
        "min_confidence": 0.9,
        "expression": {
          "op": "syntactic_feature_eq",
          "name": "is_dynamic_dispatch",
          "value": true
        }
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
      "group_id": "unindexed-external-module",
      "title": "F6 — Caller lives in unindexed/external module",
      "description": "The only callers are inside a module that Ariadne did not index (outside configured folders, or an external package). When it is an external dependency, this is a permanent limitation. When it is an internal but unindexed folder, it is a configuration fix.",
      "status": "permanent",
      "languages": [
        "typescript",
        "javascript",
        "python",
        "rust"
      ],
      "examples": [
        {
          "file": "src/loader.ts",
          "line": 3,
          "snippet": "import { handler } from 'external-framework';"
        }
      ],
      "classifier": {
        "kind": "predicate",
        "axis": "B",
        "min_confidence": 0.95,
        "expression": {
          "op": "resolution_failure_reason_eq",
          "value": "receiver_is_external_import"
        }
      },
      "classification": {
        "kind": "framework_invoked",
        "framework": "external_module"
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
        "kind": "predicate",
        "axis": "A",
        "min_confidence": 0.9,
        "expression": {
          "op": "all",
          "of": [
            {
              "op": "language_eq",
              "value": "python"
            },
            {
              "op": "decorator_matches",
              "pattern": "@property"
            }
          ]
        }
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
        "kind": "predicate",
        "axis": "A",
        "min_confidence": 0.9,
        "expression": {
          "op": "all",
          "of": [
            {
              "op": "language_eq",
              "value": "rust"
            },
            {
              "op": "grep_line_regex",
              "pattern": "[A-Za-z_][A-Za-z0-9_]*!\\s*[\\(\\[{]"
            }
          ]
        }
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
        "kind": "predicate",
        "axis": "C",
        "min_confidence": 0.95,
        "expression": {
          "op": "all",
          "of": [
            {
              "op": "language_eq",
              "value": "python"
            },
            {
              "op": "decorator_matches",
              "pattern": "@pytest.fixture*"
            }
          ]
        }
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
        "kind": "predicate",
        "axis": "C",
        "min_confidence": 0.95,
        "expression": {
          "op": "all",
          "of": [
            {
              "op": "language_eq",
              "value": "python"
            },
            {
              "op": "decorator_matches",
              "pattern": "@*.route*"
            }
          ]
        }
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
        "kind": "predicate",
        "axis": "C",
        "min_confidence": 0.95,
        "expression": {
          "op": "decorator_matches",
          "pattern": "@Component*"
        }
      },
      "classification": {
        "kind": "framework_invoked",
        "framework": "angular"
      }
    },
    {
      "group_id": "dynamic-dispatch",
      "title": "dynamic-dispatch",
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "drift_detected": true,
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "Proposed by plan investigator — fill in before enabling.",
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
      "description": "A Python method whose only caller invokes it as self.<attr>.<method>() where <attr> is an untyped instance attribute (a Cython `object` constructor parameter such as pandas `self.obj`, or any attribute never assigned `self.<attr> = Constructor()`). The resolver cannot follow the attribute's type, collapses the receiver to the caller's own enclosing class, fails to find the method there, and records member_type_unknown with resolved_receiver_type pointing at that caller class — so the resolved receiver-type's file equals the call ref's caller_file. That equality is the discriminator. Interim classifier for the residual out-of-static-reach pandas row (indexing.py:3171 self.obj._set_value) after TASK-350 Fixes A-C; self-narrowing because Fix C promotes self.attr = Constructor() to typed properties, so typeable receivers resolve and never reach this classifier. Distinct from the JavaScript receiver-type-unknown rule (callers-not-in-registry with empty call refs, identifier receiver). The fixture-injected identifier receiver shape (styler._repr_html_) is deliberately out of scope — its identifier + receiver_type_unknown signal is indistinguishable from the dominant untyped-local-call bucket and belongs to a separate fault area (unindexed test caller / framework display-protocol method name). The deferred fixture-injected identifier-receiver row is tracked as TASK-350.4.",
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
