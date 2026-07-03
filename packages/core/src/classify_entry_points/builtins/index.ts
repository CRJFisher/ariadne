// Hand-maintained barrel of builtin classifiers. Each `check_<group_id>.ts` is
// a self-contained `BuiltinCheckFn`; when a builtin classifier is added or
// removed from the known-issues registry, add or remove its import and
// `BUILTIN_CHECKS` entry here. The orchestrator looks up a builtin classifier by
// `function_name` via BUILTIN_CHECKS.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

import { check_bundler_module_substitution } from "./check_bundler-module-substitution";
import { check_dynamic_dispatch } from "./check_dynamic-dispatch";
import { check_dynamic_dispatch_reporter_constructor } from "./check_dynamic-dispatch-reporter-constructor";
import { check_dynamic_new_function_dispatch } from "./check_dynamic-new-function-dispatch";
import { check_dynamic_property_keyed_callback } from "./check_dynamic-property-keyed-callback";
import { check_dynamic_require_constructor } from "./check_dynamic-require-constructor";
import { check_eval_based_dynamic_dispatch } from "./check_eval-based-dynamic-dispatch";
import { check_framework_component_decorator } from "./check_framework-component-decorator";
import { check_framework_flask_route } from "./check_framework-flask-route";
import { check_framework_lifecycle_dispatch } from "./check_framework-lifecycle-dispatch";
import { check_framework_lifecycle_handler } from "./check_framework-lifecycle-handler";
import { check_framework_lifecycle_override } from "./check_framework-lifecycle-override";
import { check_framework_pytest_fixture } from "./check_framework-pytest-fixture";
import { check_py_dunder_protocol } from "./check_py-dunder-protocol";
import { check_py_property_decorator_access } from "./check_py-property-decorator-access";
import { check_rust_macro_invocation_call } from "./check_rust-macro-invocation-call";
import { check_string_keyed_dispatch } from "./check_string-keyed-dispatch";
import { check_true_positive_lambda_handler } from "./check_true-positive-lambda-handler";
import { check_untyped_attribute_receiver } from "./check_untyped-attribute-receiver";

export type BuiltinCheckFn = (
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
) => boolean;

export const BUILTIN_CHECKS: Record<string, BuiltinCheckFn> = {
  check_bundler_module_substitution,
  check_dynamic_dispatch,
  check_dynamic_dispatch_reporter_constructor,
  check_dynamic_new_function_dispatch,
  check_dynamic_property_keyed_callback,
  check_dynamic_require_constructor,
  check_eval_based_dynamic_dispatch,
  check_framework_component_decorator,
  check_framework_flask_route,
  check_framework_lifecycle_dispatch,
  check_framework_lifecycle_handler,
  check_framework_lifecycle_override,
  check_framework_pytest_fixture,
  check_py_dunder_protocol,
  check_py_property_decorator_access,
  check_rust_macro_invocation_call,
  check_string_keyed_dispatch,
  check_true_positive_lambda_handler,
  check_untyped_attribute_receiver,
};
