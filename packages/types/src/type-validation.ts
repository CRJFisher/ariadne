/**
 * Comprehensive type validation layer with runtime type guards
 * and validation functions for all unified types
 */

import { Language, Location } from "./common";
import { 
  isSymbolName, 
  isSymbolId, 
  isCallerName,
  isCalleeName,
  isReceiverName,
  isModuleContext,
  isCallerContext,
  isVisibility,
  isResolutionReason
} from "./branded-types";
import { 
  isASTNode,
  isSemanticNode,
  isQueryCapture,
  isQueryResult,
  isResolution,
  isQueryError 
} from "./base-query-types";
import {
  isFunctionCall,
  isMethodCall,
  isConstructorCall,
  isUnifiedCallInfo
} from "./unified-call-types";
import {
  isUnifiedSymbol,
  isUnifiedScope,
  isSymbolUsage
} from "./unified-symbol-scope-types";
import {
  isNamedImport,
  isDefaultImport,
  isNamespaceImport,
  isSideEffectImport,
  isNamedExport,
  isDefaultExport,
  isNamespaceExport,
  isReExport
} from "./unified-import-export-types";
import {
  isUnifiedType,
  isTypeMember,
  isTrackedType,
  isInferredType
} from "./unified-type-analysis-types";
import {
  isUnifiedTypeEntity,
  isUnifiedMember,
  isInheritanceRelation
} from "./unified-inheritance-types";
import {
  isTypedQueryCapture,
  isQueryProcessor,
  isLanguageConfiguration
} from "./query-integration-types";

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
  readonly path: string;           // Path to invalid field
  readonly expected: string;        // Expected type/value
  readonly actual: unknown;         // Actual value
  readonly message: string;        // Error message
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
export function validateLocation(value: unknown, path = "location"): ValidationResult<Location> {
  const errors: ValidationError[] = [];
  
  if (typeof value !== "object" || value === null) {
    errors.push({
      path,
      expected: "Location object",
      actual: value,
      message: "Location must be an object"
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
      message: "file_path must be a string"
    });
  }
  
  const numFields = ["line", "column", "end_line", "end_column"];
  for (const field of numFields) {
    if (typeof loc[field] !== "number" || loc[field] < 0) {
      errors.push({
        path: `${path}.${field}`,
        expected: "positive number",
        actual: loc[field],
        message: `${field} must be a positive number`
      });
    }
  }
  
  // Validate logical consistency
  if (errors.length === 0) {
    if (loc.end_line < loc.line || 
        (loc.end_line === loc.line && loc.end_column < loc.column)) {
      errors.push({
        path,
        expected: "end position after start",
        actual: loc,
        message: "End position must be after start position"
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? loc as Location : undefined,
    errors,
    warnings: []
  };
}

/**
 * Deep validation for Language
 */
export function validateLanguage(value: unknown, path = "language"): ValidationResult<Language> {
  const errors: ValidationError[] = [];
  const validLanguages = ["javascript", "typescript", "python", "rust"];
  
  if (!validLanguages.includes(value as string)) {
    errors.push({
      path,
      expected: validLanguages.join(" | "),
      actual: value,
      message: `Language must be one of: ${validLanguages.join(", ")}`
    });
  }
  
  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? value as Language : undefined,
    errors,
    warnings: []
  };
}

/**
 * Deep validation for ASTNode
 */
export function validateASTNode(value: unknown, path = "node"): ValidationResult<any> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (!isASTNode(value)) {
    errors.push({
      path,
      expected: "ASTNode",
      actual: value,
      message: "Value is not a valid ASTNode"
    });
    return { valid: false, errors, warnings };
  }
  
  // Validate nested Location
  const locResult = validateLocation((value as any).location, `${path}.location`);
  errors.push(...locResult.errors);
  
  // Validate Language
  const langResult = validateLanguage((value as any).language, `${path}.language`);
  errors.push(...langResult.errors);
  
  // Check node_type
  if (typeof (value as any).node_type !== "string" || (value as any).node_type.length === 0) {
    errors.push({
      path: `${path}.node_type`,
      expected: "non-empty string",
      actual: (value as any).node_type,
      message: "node_type must be a non-empty string"
    });
  }
  
  return { valid: errors.length === 0, value, errors, warnings };
}

/**
 * Deep validation for UnifiedCallInfo
 */
export function validateUnifiedCallInfo(value: unknown, path = "call"): ValidationResult<any> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (!isUnifiedCallInfo(value)) {
    errors.push({
      path,
      expected: "UnifiedCallInfo",
      actual: value,
      message: "Value is not a valid UnifiedCallInfo"
    });
    return { valid: false, errors, warnings };
  }
  
  const call = value as any;
  
  // Validate base fields
  if (!isCallerContext(call.caller)) {
    errors.push({
      path: `${path}.caller`,
      expected: "CallerContext",
      actual: call.caller,
      message: "Invalid caller context"
    });
  }
  
  const locResult = validateLocation(call.location, `${path}.location`);
  errors.push(...locResult.errors);
  
  if (typeof call.arguments_count !== "number" || call.arguments_count < 0) {
    warnings.push({
      path: `${path}.arguments_count`,
      message: "arguments_count should be a non-negative number",
      suggestion: "Set to 0 if unknown"
    });
  }
  
  // Validate specific call type fields
  if (isFunctionCall(value)) {
    if (!isCalleeName(value.callee)) {
      errors.push({
        path: `${path}.callee`,
        expected: "CalleeName",
        actual: value.callee,
        message: "Invalid callee name"
      });
    }
  } else if (isMethodCall(value)) {
    if (!isCalleeName(value.method_name)) {
      errors.push({
        path: `${path}.method_name`,
        expected: "CalleeName",
        actual: value.method_name,
        message: "Invalid method name"
      });
    }
    if (!isReceiverName(value.receiver)) {
      errors.push({
        path: `${path}.receiver`,
        expected: "ReceiverName",
        actual: value.receiver,
        message: "Invalid receiver name"
      });
    }
  } else if (isConstructorCall(value)) {
    if (typeof value.class_name !== "string" || value.class_name.length === 0) {
      errors.push({
        path: `${path}.class_name`,
        expected: "non-empty string",
        actual: value.class_name,
        message: "class_name must be a non-empty string"
      });
    }
  }
  
  return { valid: errors.length === 0, value, errors, warnings };
}

/**
 * Deep validation for UnifiedSymbol
 */
export function validateUnifiedSymbol(value: unknown, path = "symbol"): ValidationResult<any> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (!isUnifiedSymbol(value)) {
    errors.push({
      path,
      expected: "UnifiedSymbol",
      actual: value,
      message: "Value is not a valid UnifiedSymbol"
    });
    return { valid: false, errors, warnings };
  }
  
  const symbol = value as any;
  
  // Validate branded types
  if (!isSymbolId(symbol.id)) {
    errors.push({
      path: `${path}.id`,
      expected: "SymbolId",
      actual: symbol.id,
      message: "Invalid symbol ID format"
    });
  }
  
  if (!isSymbolName(symbol.name)) {
    errors.push({
      path: `${path}.name`,
      expected: "SymbolName",
      actual: symbol.name,
      message: "Invalid symbol name"
    });
  }
  
  // Validate visibility if present
  if (symbol.visibility !== undefined && !isVisibility(symbol.visibility)) {
    errors.push({
      path: `${path}.visibility`,
      expected: "Visibility",
      actual: symbol.visibility,
      message: "Invalid visibility modifier"
    });
  }
  
  // Validate nested ASTNode fields
  const astResult = validateASTNode(symbol, path);
  errors.push(...astResult.errors);
  
  return { valid: errors.length === 0, value, errors, warnings };
}

// ============================================================================
// Strict Mode Validation
// ============================================================================

/**
 * Options for strict validation
 */
export interface StrictValidationOptions {
  readonly allow_extra_fields?: boolean;   // Allow unknown fields
  readonly require_all_fields?: boolean;   // Require all optional fields
  readonly check_references?: boolean;     // Validate ID references
  readonly max_depth?: number;            // Maximum validation depth
}

/**
 * Perform strict validation with TypeScript strict mode compliance
 */
export function strictValidate<T>(
  value: unknown,
  validator: (v: unknown) => v is T,
  deepValidator?: (v: unknown, path?: string) => ValidationResult<T>,
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
      message: "Type guard validation failed"
    });
    return { valid: false, errors, warnings };
  }
  
  // Then perform deep validation if provided
  if (deepValidator) {
    const deepResult = deepValidator(value);
    errors.push(...deepResult.errors);
    warnings.push(...deepResult.warnings);
  }
  
  // Check for extra fields if strict
  if (!options.allow_extra_fields && typeof value === "object" && value !== null) {
    // This would require knowing expected fields - implementation depends on type
    // For now, we'll add a warning
    warnings.push({
      path: "",
      message: "Extra field checking not implemented for this type"
    });
  }
  
  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? value : undefined,
    errors,
    warnings
  };
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate an array of items
 */
export function validateArray<T>(
  values: unknown,
  itemValidator: (v: unknown, path?: string) => ValidationResult<T>,
  path = "array"
): ValidationResult<T[]> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (!Array.isArray(values)) {
    errors.push({
      path,
      expected: "array",
      actual: values,
      message: "Value must be an array"
    });
    return { valid: false, errors, warnings };
  }
  
  const validItems: T[] = [];
  
  for (let i = 0; i < values.length; i++) {
    const itemResult = itemValidator(values[i], `${path}[${i}]`);
    if (itemResult.valid && itemResult.value) {
      validItems.push(itemResult.value);
    }
    errors.push(...itemResult.errors);
    warnings.push(...itemResult.warnings);
  }
  
  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? validItems : undefined,
    errors,
    warnings
  };
}

/**
 * Validate a map of items
 */
export function validateMap<K, V>(
  value: unknown,
  keyValidator: (v: unknown) => v is K,
  valueValidator: (v: unknown, path?: string) => ValidationResult<V>,
  path = "map"
): ValidationResult<Map<K, V>> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  if (!(value instanceof Map)) {
    errors.push({
      path,
      expected: "Map",
      actual: value,
      message: "Value must be a Map"
    });
    return { valid: false, errors, warnings };
  }
  
  const validMap = new Map<K, V>();
  
  for (const [key, val] of value.entries()) {
    if (!keyValidator(key)) {
      errors.push({
        path: `${path}.keys`,
        expected: "valid key",
        actual: key,
        message: "Invalid map key"
      });
      continue;
    }
    
    const valResult = valueValidator(val, `${path}[${String(key)}]`);
    if (valResult.valid && valResult.value) {
      validMap.set(key, valResult.value);
    }
    errors.push(...valResult.errors);
    warnings.push(...valResult.warnings);
  }
  
  return {
    valid: errors.length === 0,
    value: errors.length === 0 ? validMap : undefined,
    errors,
    warnings
  };
}

// ============================================================================
// Composite Validators
// ============================================================================

/**
 * Create a composite validator from multiple validators
 */
export function combineValidators<T>(
  ...validators: Array<(v: unknown) => v is T>
): (v: unknown) => v is T {
  return (value: unknown): value is T => {
    return validators.every(validator => validator(value));
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
export function assertType<T>(
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
export function assertValid<T>(
  result: ValidationResult<T>,
  message?: string
): asserts result is ValidationResult<T> & { valid: true; value: T } {
  if (!result.valid) {
    const errorMessages = result.errors.map(e => e.message).join(", ");
    throw new TypeError(message || `Validation failed: ${errorMessages}`);
  }
}

// ============================================================================
// Export All Type Guards
// ============================================================================

export const TypeGuards = {
  // Branded types
  isSymbolName,
  isSymbolId,
  isCallerName,
  isCalleeName,
  isReceiverName,
  isModuleContext,
  isCallerContext,
  isVisibility,
  isResolutionReason,
  
  // Base query types
  isASTNode,
  isSemanticNode,
  isQueryCapture,
  isQueryResult,
  isResolution,
  isQueryError,
  
  // Unified call types
  isFunctionCall,
  isMethodCall,
  isConstructorCall,
  isUnifiedCallInfo,
  
  // Unified symbol/scope types
  isUnifiedSymbol,
  isUnifiedScope,
  isSymbolUsage,
  
  // Unified import/export types
  isNamedImport,
  isDefaultImport,
  isNamespaceImport,
  isSideEffectImport,
  isNamedExport,
  isDefaultExport,
  isNamespaceExport,
  isReExport,
  
  // Unified type analysis types
  isUnifiedType,
  isTypeMember,
  isTrackedType,
  isInferredType,
  
  // Unified inheritance types
  isUnifiedTypeEntity,
  isUnifiedMember,
  isInheritanceRelation,
  
  // Query integration types
  isTypedQueryCapture,
  isQueryProcessor,
  isLanguageConfiguration,
} as const;