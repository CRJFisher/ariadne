// AUTO-GENERATED barrel — do not edit by hand. Regenerated from the
// known-issues registry when its builtin classifiers change. The orchestrator
// looks up a builtin classifier by `function_name` via BUILTIN_CHECKS.

import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FileLinesReader } from "../auto_classify_types";

import { check_bundler_module_substitution } from "./check_bundler-module-substitution";
import { check_dependency_injection_type_resolution } from "./check_dependency-injection-type-resolution";
import { check_dynamic_cast_structural_type_dispatch } from "./check_dynamic-cast-structural-type-dispatch";
import { check_dynamic_dispatch } from "./check_dynamic-dispatch";
import { check_dynamic_dispatch_reporter_constructor } from "./check_dynamic-dispatch-reporter-constructor";
import { check_dynamic_new_function_dispatch } from "./check_dynamic-new-function-dispatch";
import { check_dynamic_require_constructor } from "./check_dynamic-require-constructor";
import { check_eval_based_dynamic_dispatch } from "./check_eval-based-dynamic-dispatch";
import { check_framework_lifecycle_dispatch } from "./check_framework-lifecycle-dispatch";
import { check_framework_lifecycle_handler } from "./check_framework-lifecycle-handler";
import { check_framework_lifecycle_override } from "./check_framework-lifecycle-override";
import { check_py_dunder_protocol } from "./check_py-dunder-protocol";
import { check_receiver_type_unknown } from "./check_receiver-type-unknown";
import { check_string_keyed_dispatch } from "./check_string-keyed-dispatch";
import { check_unresolved_receiver_type } from "./check_unresolved-receiver-type";
import { check_untyped_attribute_receiver } from "./check_untyped-attribute-receiver";

export type BuiltinCheckFn = (
  entry_point: EnrichedEntryPoint,
  read_file_lines: FileLinesReader,
) => boolean;

export const BUILTIN_CHECKS: Record<string, BuiltinCheckFn> = {
  check_bundler_module_substitution,
  check_dependency_injection_type_resolution,
  check_dynamic_cast_structural_type_dispatch,
  check_dynamic_dispatch,
  check_dynamic_dispatch_reporter_constructor,
  check_dynamic_new_function_dispatch,
  check_dynamic_require_constructor,
  check_eval_based_dynamic_dispatch,
  check_framework_lifecycle_dispatch,
  check_framework_lifecycle_handler,
  check_framework_lifecycle_override,
  check_py_dunder_protocol,
  check_receiver_type_unknown,
  check_string_keyed_dispatch,
  check_unresolved_receiver_type,
  check_untyped_attribute_receiver,
};
