/**
 * Comprehensive type validation layer with runtime type guards
 * and validation functions for all unified types
 */

import { Language, Location } from "./common";
import {
  is_symbol_name,
  is_symbol_id,
  is_caller_name,
  is_callee_name,
  is_receiver_name,
  is_module_context,
  is_caller_context,
  is_visibility,
  is_resolution_reason,
} from "./branded_types";
import {
  is_ast_node,
  is_semantic_node,
  is_query_capture,
  is_query_result,
  is_resolution,
  is_query_error,
} from "./query";
import {
  is_function_call,
  is_method_call,
  is_constructor_call,
  is_call_info,
} from "./calls";
import { is_symbol, is_unified_scope, SymbolUsage } from "./symbol_scope";
import {
  is_named_import,
  is_default_import,
  is_namespace_import,
  is_side_effect_import,
  is_named_export,
  is_default_export,
  is_namespace_export,
  is_re_export,
} from "./import_export";
import {
  is_type_definition,
  is_type_member,
  is_tracked_type,
  is_inferred_type,
} from "./type_analysis";
import {
  is_unified_type_entity,
  is_unified_member,
  is_inheritance_relation,
} from "./inheritance";
import {
  is_typed_query_capture,
  is_query_processor,
  is_language_configuration,
} from "./query_integration";

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Result of validation operation
 */
export interface ValidationResult<T> {
  readonly valid: boolean;
  readonly value?: T;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  readonly path: string; // Path to invalid field
  readonly expected: string; // Expected type/value
  readonly actual: unknown; // Actual value
  readonly message: string; // Error message
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  readonly path: string;
  readonly message: string;
  readonly suggestion?: string;
}

// ============================================================================
// Deep Validation Functions
// ============================================================================

/**
 * Deep validation for Location
 */
export function validate_location(
  value: unknown,
  path = "location"
): ValidationResult<Location> {
  const errors: ValidationError[] = [];

  if (typeof value !== "object" || value === null) {
    errors.push({
      path,
      expected: "Location object",
      actual: value,
      message: "Location must be an object",
    });
    return { valid: false, errors, warnings: [] };
  }

  const loc = value as any;

  // Validate required fields
  if (typeof loc.file_path !== "string") {
    errors.push({
      path: `${path}.file_path`,
      expected: "string",
      actual: loc.file_path,
      message: "file_path must be a string",
    });
  }

  const num_fields = ["line", "column", "end_line", "end_column"];
  for (const field of num_fields) {
    if (typeof loc[field] !== "number" || loc[field] < 0) {
      errors.push({
        path: `${path}.${field}`,
        expected: "positive number",
        actual: loc[field],
        message: `${field} must be a positive number`,
      });
    }
  }

  // Validate logical consistency
  if (errors.length === 0) {
    if (
      loc.end_line < loc.line ||
      (loc.end_line === loc.line && loc.end_column < loc.column)
    ) {
      errors.push({
        path,
        expected: "end position after start",
        actual: loc,
        message: "End position must be after start position",
      });
    }
  }

  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? (loc as Location) : undefined,
    errors,
    warnings: [],
  };
}

/**
 * Deep validation for Language
 */
export function validate_language(
  value: unknown,
  path = "language"
): ValidationResult<Language> {
  const errors: ValidationError[] = [];
  const valid_languages = ["javascript", "typescript", "python", "rust"];

  if (!valid_languages.includes(value as string)) {
    errors.push({
      path,
      expected: valid_languages.join(" | "),
      actual: value,
      message: `Language must be one of: ${valid_languages.join(", ")}`,
    });
  }

  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? (value as Language) : undefined,
    errors,
    warnings: [],
  };
}

/**
 * Deep validation for ASTNode
 */
export function validate_ast_node(
  value: unknown,
  path = "node"
): ValidationResult<any> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!is_ast_node(value)) {
    errors.push({
      path,
      expected: "ASTNode",
      actual: value,
      message: "Value is not a valid ASTNode",
    });
    return { valid: false, errors, warnings };
  }

  // Validate nested Location
  const loc_result = validate_location(
    (value as any).location,
    `${path}.location`
  );
  errors.push(...loc_result.errors);

  // Validate Language
  const lang_result = validate_language(
    (value as any).language,
    `${path}.language`
  );
  errors.push(...lang_result.errors);

  // Check node_type
  if (
    typeof (value as any).node_type !== "string" ||
    (value as any).node_type.length === 0
  ) {
    errors.push({
      path: `${path}.node_type`,
      expected: "non-empty string",
      actual: (value as any).node_type,
      message: "node_type must be a non-empty string",
    });
  }

  return { valid: errors.length === 0, value, errors, warnings };
}

/**
 * Deep validation for UnifiedCallInfo
 */
export function validate_call_info(
  value: unknown,
  path = "call"
): ValidationResult<any> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!is_call_info(value)) {
    errors.push({
      path,
      expected: "CallInfo",
      actual: value,
      message: "Value is not a valid CallInfo",
    });
    return { valid: false, errors, warnings };
  }

  const call = value as any;

  // Validate base fields
  if (!is_caller_context(call.caller)) {
    errors.push({
      path: `${path}.caller`,
      expected: "CallerContext",
      actual: call.caller,
      message: "Invalid caller context",
    });
  }

  const loc_result = validate_location(call.location, `${path}.location`);
  errors.push(...loc_result.errors);

  if (typeof call.arguments_count !== "number" || call.arguments_count < 0) {
    warnings.push({
      path: `${path}.arguments_count`,
      message: "arguments_count should be a non-negative number",
      suggestion: "Set to 0 if unknown",
    });
  }

  // Validate specific call type fields
  if (is_function_call(value)) {
    if (!is_callee_name(value.callee)) {
      errors.push({
        path: `${path}.callee`,
        expected: "CalleeName",
        actual: value.callee,
        message: "Invalid callee name",
      });
    }
  } else if (is_method_call(value)) {
    if (!is_callee_name(value.method_name)) {
      errors.push({
        path: `${path}.method_name`,
        expected: "CalleeName",
        actual: value.method_name,
        message: "Invalid method name",
      });
    }
    if (!is_receiver_name(value.receiver)) {
      errors.push({
        path: `${path}.receiver`,
        expected: "ReceiverName",
        actual: value.receiver,
        message: "Invalid receiver name",
      });
    }
  } else if (is_constructor_call(value)) {
    if (typeof value.class_name !== "string" || value.class_name.length === 0) {
      errors.push({
        path: `${path}.class_name`,
        expected: "non-empty string",
        actual: value.class_name,
        message: "class_name must be a non-empty string",
      });
    }
  }

  return { valid: errors.length === 0, value, errors, warnings };
}

/**
 * Deep validation for Symbol
 */
export function validate_unified_symbol(
  value: unknown,
  path = "symbol"
): ValidationResult<any> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!is_symbol(value)) {
    errors.push({
      path,
      expected: "Symbol",
      actual: value,
      message: "Value is not a valid Symbol",
    });
    return { valid: false, errors, warnings };
  }

  const symbol = value as any;

  // Validate branded types
  if (!is_symbol_id(symbol.id)) {
    errors.push({
      path: `${path}.id`,
      expected: "SymbolId",
      actual: symbol.id,
      message: "Invalid symbol ID format",
    });
  }

  if (!is_symbol_name(symbol.name)) {
    errors.push({
      path: `${path}.name`,
      expected: "SymbolName",
      actual: symbol.name,
      message: "Invalid symbol name",
    });
  }

  // Validate visibility if present
  if (symbol.visibility !== undefined && !is_visibility(symbol.visibility)) {
    errors.push({
      path: `${path}.visibility`,
      expected: "Visibility",
      actual: symbol.visibility,
      message: "Invalid visibility modifier",
    });
  }

  // Validate nested ASTNode fields
  const ast_result = validate_ast_node(symbol, path);
  errors.push(...ast_result.errors);

  return { valid: errors.length === 0, value, errors, warnings };
}

// ============================================================================
// Strict Mode Validation
// ============================================================================

/**
 * Options for strict validation
 */
export interface StrictValidationOptions {
  readonly allow_extra_fields?: boolean; // Allow unknown fields
  readonly require_all_fields?: boolean; // Require all optional fields
  readonly check_references?: boolean; // Validate ID references
  readonly max_depth?: number; // Maximum validation depth
}

/**
 * Perform strict validation with TypeScript strict mode compliance
 */
export function strict_validate<T>(
  value: unknown,
  validator: (v: unknown) => v is T,
  deep_validator?: (v: unknown, path?: string) => ValidationResult<T>,
  options: StrictValidationOptions = {}
): ValidationResult<T> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // First, use type guard
  if (!validator(value)) {
    errors.push({
      path: "",
      expected: "Valid type",
      actual: value,
      message: "Type guard validation failed",
    });
    return { valid: false, errors, warnings };
  }

  // Then perform deep validation if provided
  if (deep_validator) {
    const deep_result = deep_validator(value);
    errors.push(...deep_result.errors);
    warnings.push(...deep_result.warnings);
  }

  // Check for extra fields if strict
  if (
    !options.allow_extra_fields &&
    typeof value === "object" &&
    value !== null
  ) {
    // This would require knowing expected fields - implementation depends on type
    // For now, we'll add a warning
    warnings.push({
      path: "",
      message: "Extra field checking not implemented for this type",
    });
  }

  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? value : undefined,
    errors,
    warnings,
  };
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate an array of items
 */
export function validate_array<T>(
  values: unknown,
  item_validator: (v: unknown, path?: string) => ValidationResult<T>,
  path = "array"
): ValidationResult<T[]> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!Array.isArray(values)) {
    errors.push({
      path,
      expected: "array",
      actual: values,
      message: "Value must be an array",
    });
    return { valid: false, errors, warnings };
  }

  const valid_items: T[] = [];

  for (let i = 0; i < values.length; i++) {
    const item_result = item_validator(values[i], `${path}[${i}]`);
    if (item_result.valid && item_result.value) {
      valid_items.push(item_result.value);
    }
    errors.push(...item_result.errors);
    warnings.push(...item_result.warnings);
  }

  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? valid_items : undefined,
    errors,
    warnings,
  };
}

/**
 * Validate a map of items
 */
export function validate_map<K, V>(
  value: unknown,
  key_validator: (v: unknown) => v is K,
  value_validator: (v: unknown, path?: string) => ValidationResult<V>,
  path = "map"
): ValidationResult<Map<K, V>> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!(value instanceof Map)) {
    errors.push({
      path,
      expected: "Map",
      actual: value,
      message: "Value must be a Map",
    });
    return { valid: false, errors, warnings };
  }

  const valid_map = new Map<K, V>();

  for (const [key, val] of value.entries()) {
    if (!key_validator(key)) {
      errors.push({
        path: `${path}.keys`,
        expected: "valid key",
        actual: key,
        message: "Invalid map key",
      });
      continue;
    }

    const val_result = value_validator(val, `${path}[${String(key)}]`);
    if (val_result.valid && val_result.value) {
      valid_map.set(key, val_result.value);
    }
    errors.push(...val_result.errors);
    warnings.push(...val_result.warnings);
  }

  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? valid_map : undefined,
    errors,
    warnings,
  };
}

// ============================================================================
// Composite Validators
// ============================================================================

/**
 * Create a composite validator from multiple validators
 */
export function combine_validators<T>(
  ...validators: Array<(v: unknown) => v is T>
): (v: unknown) => v is T {
  return (value: unknown): value is T => {
    return validators.every((validator) => validator(value));
  };
}

/**
 * Create an optional validator
 */
export function optional<T>(
  validator: (v: unknown) => v is T
): (v: unknown) => v is T | undefined {
  return (value: unknown): value is T | undefined => {
    return value === undefined || validator(value);
  };
}

/**
 * Create a nullable validator
 */
export function nullable<T>(
  validator: (v: unknown) => v is T
): (v: unknown) => v is T | null {
  return (value: unknown): value is T | null => {
    return value === null || validator(value);
  };
}

// ============================================================================
// Assertion Functions
// ============================================================================

/**
 * Assert that a value is of a specific type
 */
export function assert_type<T>(
  value: unknown,
  validator: (v: unknown) => v is T,
  message?: string
): asserts value is T {
  if (!validator(value)) {
    throw new TypeError(message || "Type assertion failed");
  }
}

/**
 * Assert with validation result
 */
export function assert_valid<T>(
  result: ValidationResult<T>,
  message?: string
): asserts result is ValidationResult<T> & { valid: true; value: T } {
  if (!result.valid) {
    const error_messages = result.errors.map((e) => e.message).join(", ");
    throw new TypeError(message || `Validation failed: ${error_messages}`);
  }
}

// ============================================================================
// Additional Non-nullability Type Guards
// ============================================================================

/**
 * Type guard to check if an array is non-empty
 * Useful for converting T[] to [T, ...T[]] type
 */
export function is_non_empty_array<T>(value: T[]): value is [T, ...T[]] {
  return value.length > 0;
}

/**
 * Type guard to check if a value is defined (not null or undefined)
 */
export function is_defined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if a string is non-empty
 */
export function is_non_empty_string(value: string): value is string & { length: number } {
  return value.length > 0;
}

/**
 * Assertion function for non-null values
 */
export function assert_defined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new TypeError(message || "Expected value to be defined, but got null or undefined");
  }
}

// ============================================================================
// Export All Type Guards
// ============================================================================

export const type_guards = {
  // Branded types
  is_symbol_name,
  is_symbol_id,
  is_caller_name,
  is_callee_name,
  is_receiver_name,
  is_module_context,
  is_caller_context,
  is_visibility,
  is_resolution_reason,

  // Base query types
  isASTNode: is_ast_node,
  isSemanticNode: is_semantic_node,
  isQueryCapture: is_query_capture,
  isQueryResult: is_query_result,
  isResolution: is_resolution,
  isQueryError: is_query_error,

  // Unified call types
  is_function_call,
  is_method_call,
  is_constructor_call,
  is_call_info,

  // Unified symbol/scope types
  is_symbol,
  is_unified_scope,

  // Unified import/export types
  is_named_import,
  is_default_import,
  is_namespace_import,
  is_side_effect_import,
  is_named_export,
  is_default_export,
  is_namespace_export,
  is_re_export,

  // Unified type analysis types
  is_type_definition,
  is_type_member,
  is_tracked_type,

  // Unified inheritance types
  is_unified_type_entity,
  is_unified_member,
  is_inheritance_relation,

  // Query integration types
  is_typed_query_capture,
  is_query_processor,
  is_language_configuration,
} as const;
