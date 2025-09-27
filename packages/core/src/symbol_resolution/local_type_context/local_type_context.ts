/**
 * Local Type Context - Minimal type tracking for method resolution
 *
 * Provides lightweight, local-scope type information without full type flow analysis.
 * Focuses on the most common patterns that provide high-confidence type hints.
 */

import type {
  FilePath,
  Location,
  LocationKey,
  SymbolId,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";

/**
 * Local type information for a single file
 */
export interface LocalTypeContext {
  // Variable name -> Type (for simple variable tracking)
  variable_types: Map<string, SymbolId>;

  // Location -> Type (for expression results)
  expression_types: Map<LocationKey, SymbolId>;

  // Scope-specific type narrowing (e.g., instanceof checks)
  type_guards: Array<TypeGuard>;

  // Constructor calls for tracking new instances
  constructor_calls: Array<ConstructorCall>;
}

/**
 * Constructor call information
 */
export interface ConstructorCall {
  class_id: SymbolId;
  location: Location;
  assigned_to?: string; // Variable name if assigned
  scope_id: ScopeId;
}

/**
 * Type guard/narrowing information
 */
export interface TypeGuard {
  variable_name: string;
  narrowed_type: SymbolId;
  scope_id: ScopeId;
  guard_location: Location;
  // Range where the narrowing applies (e.g., inside if block)
  applies_in_range?: Location;
}

/**
 * Build local type context from semantic indices
 *
 * This should be called after import resolution but before method resolution
 */
export function build_local_type_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): Map<FilePath, LocalTypeContext> {
  const contexts = new Map<FilePath, LocalTypeContext>();

  for (const [file_path, index] of indices) {
    const context = build_file_type_context(index, imports.get(file_path));
    contexts.set(file_path, context);
  }

  return contexts;
}

/**
 * Build type context for a single file
 */
function build_file_type_context(
  index: SemanticIndex,
  imports?: ReadonlyMap<SymbolName, SymbolId>
): LocalTypeContext {
  const variable_types = new Map<string, SymbolId>();
  const expression_types = new Map<LocationKey, SymbolId>();
  const type_guards: TypeGuard[] = [];
  const constructor_calls: ConstructorCall[] = [];

  // Process constructor calls (new ClassName())
  if (index.local_type_flow?.constructor_calls) {
    for (const call of index.local_type_flow.constructor_calls) {
      // Try to resolve the class name to a SymbolId
      const class_id = resolve_class_name(call.class_name, index, imports);

      if (class_id) {
        constructor_calls.push({
          class_id,
          location: call.location,
          assigned_to: call.assigned_to,
          scope_id: call.scope_id || ("" as ScopeId),
        });

        // Track the variable if it's assigned
        if (call.assigned_to) {
          variable_types.set(call.assigned_to, class_id);
        }

        // Track the expression location
        expression_types.set(location_key(call.location), class_id);
      }
    }
  }

  // Process type annotations (let x: TypeName)
  if (index.local_type_annotations) {
    for (const annotation of index.local_type_annotations) {
      // Extract variable name and type from annotation
      const { variable_name, type_name } = parse_type_annotation(annotation);

      if (variable_name && type_name) {
        const type_id = resolve_type_name(type_name, index, imports);
        if (type_id) {
          variable_types.set(variable_name, type_id);
        }
      }
    }
  }

  // Process type guards (instanceof, type predicates)
  if (index.references?.type_guards) {
    for (const guard of index.references.type_guards) {
      const type_id = resolve_type_name(guard.type_name, index, imports);
      if (type_id) {
        type_guards.push({
          variable_name: guard.variable_name,
          narrowed_type: type_id,
          scope_id: guard.scope_id,
          guard_location: guard.location,
          applies_in_range: guard.applies_in_range,
        });
      }
    }
  }

  // Process method return types for common getter patterns
  // e.g., getUser() probably returns User
  process_getter_patterns(index, variable_types, imports);

  return {
    variable_types,
    expression_types,
    type_guards,
    constructor_calls,
  };
}

/**
 * Resolve a class name to its SymbolId
 */
function resolve_class_name(
  class_name: SymbolName,
  index: SemanticIndex,
  imports?: ReadonlyMap<SymbolName, SymbolId>
): SymbolId | null {
  // First check imports
  if (imports?.has(class_name)) {
    return imports.get(class_name) || null;
  }

  // Then check local classes
  if (index.classes) {
    for (const [id, class_def] of index.classes) {
      if (class_def.name === class_name) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Resolve a type name to its SymbolId
 */
function resolve_type_name(
  type_name: SymbolName,
  index: SemanticIndex,
  imports?: ReadonlyMap<SymbolName, SymbolId>
): SymbolId | null {
  // Try as class first
  const class_id = resolve_class_name(type_name, index, imports);
  if (class_id) return class_id;

  // Then try interfaces
  if (index.interfaces) {
    for (const [id, interface_def] of index.interfaces) {
      if (interface_def.name === type_name) {
        return id;
      }
    }
  }

  // Then try type aliases
  if (index.types) {
    for (const [id, type_def] of index.types) {
      if (type_def.name === type_name) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Parse type annotation to extract variable name and type
 */
function parse_type_annotation(annotation: any): {
  variable_name?: string;
  type_name?: SymbolName;
} {
  // This is simplified - would need language-specific parsing
  // For now, assume annotation_text is like "User" or "Array<User>"

  // Extract the main type name (before any generics)
  const match = annotation.annotation_text?.match(/^(\w+)/);
  if (match) {
    return {
      variable_name: annotation.variable_name,
      type_name: match[1] as SymbolName,
    };
  }

  return {};
}

/**
 * Infer types from common getter patterns
 */
function process_getter_patterns(
  index: SemanticIndex,
  variable_types: Map<string, SymbolId>,
  imports?: ReadonlyMap<SymbolName, SymbolId>
): void {
  // Look for patterns like getUser(), fetchAdmin(), loadConfig()
  if (index.functions) {
    for (const [func_id, func_def] of index.functions) {
      const name = func_def.name;

      // Check for common getter prefixes
      const getterMatch = name.match(/^(?:get|fetch|load|find|create)(\w+)/);
      if (getterMatch) {
        const probable_type = getterMatch[1] as SymbolName;
        const type_id = resolve_type_name(probable_type, index, imports);

        if (type_id) {
          // This is a heuristic - track that calls to this function
          // likely return instances of this type
          // (Would need to track actual call sites for this to be useful)
        }
      }
    }
  }
}

/**
 * Get type hint for a variable at a specific location
 */
export function get_variable_type(
  variable_name: string,
  location: Location,
  context: LocalTypeContext,
  scope_id?: ScopeId
): SymbolId | null {
  // First check if there's a type guard in effect
  if (scope_id) {
    for (const guard of context.type_guards) {
      if (guard.variable_name === variable_name &&
          guard.scope_id === scope_id &&
          is_location_in_range(location, guard.applies_in_range)) {
        return guard.narrowed_type;
      }
    }
  }

  // Then check basic variable types
  return context.variable_types.get(variable_name) || null;
}

/**
 * Get type hint for an expression at a location
 */
export function get_expression_type(
  location: Location,
  context: LocalTypeContext
): SymbolId | null {
  return context.expression_types.get(location_key(location)) || null;
}

/**
 * Check if a location is within a range
 */
function is_location_in_range(
  location: Location,
  range?: Location
): boolean {
  if (!range) return false;

  // Check if location is within the range
  // This is simplified - would need proper position comparison
  return location.file_path === range.file_path &&
         location.start_position.row >= range.start_position.row &&
         location.end_position.row <= range.end_position.row;
}