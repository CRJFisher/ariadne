/**
 * Common type tracking logic
 *
 * Provides functionality for tracking variable types, imported classes,
 * and type information across codebases.
 *
 * Migrated from: src_old/call_graph/type_tracker.ts
 */

// TODO: Integration with Constructor Calls
// - Update type map on construction
// TODO: Integration with Method Calls
// - Provide type context for method resolution
// TODO: Integration with Import Resolution
// - Add import type tracking

import { 
  FilePath, 
  Language, 
  Location, 
  SourceCode,
  TypeInfo,
  SymbolId,
  TypeName,
  TypeKind,
  FileAnalysis,
  TypeIndex,
  VariableType,
  FunctionSignature,
  TypeDefinition,
  TypeGraph,
  TypeString,
  ScopeType,
  symbol_string,
  Symbol,
  SymbolName,
} from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";

/**
 * Legacy type information interface - for internal use only
 * The actual TypeInfo type is imported from @ariadnejs/types
 */
interface LegacyTypeInfo {
  variable_name?: string; // Legacy: use SymbolId instead
  type_name: string; // TODO: migrate to SymbolId
  type_kind?:
    | "primitive"
    | "class"
    | "interface"
    | "function"
    | "object"
    | "array"
    | "unknown";
  location: Location;
  confidence?: "explicit" | "inferred" | "assumed" | number;
  source?: "annotation" | "assignment" | "constructor" | "return" | "parameter";
  is_return_value?: boolean;
  is_property_assignment?: boolean;
}

/**
 * Information about an imported class/type
 */
export interface ImportedClassInfo {
  class_name: string; // Legacy: use class_symbol for new code
  source_module: string;
  local_name: string; // Legacy: use local_symbol for new code
  class_symbol?: SymbolId; // Symbol for the imported class/type
  local_symbol?: SymbolId; // Symbol for the local alias
  is_default?: boolean;
  is_type_only?: boolean; // TypeScript type-only import
}

/**
 * Type tracking context
 */
export interface TypeTrackingContext {
  language: Language;
  file_path: FilePath;
  source_code: SourceCode;
  debug?: boolean;
}

/**
 * File-level type tracking data
 */
export interface FileTypeTracker {
  variable_types: Map<SymbolId, TypeInfo>; // Symbol ID -> type info
  imported_classes: Map<SymbolId, ImportedClassInfo>; // Local symbol -> import info
  exported_definitions: Set<string>; // Names of exported definitions
  file_path?: FilePath; // File path for creating SymbolIds
  // Legacy compatibility
  legacy_types?: Map<string, LegacyTypeInfo[]>; // Variable name -> type history
  legacy_imports?: Map<string, ImportedClassInfo>; // Local name -> import info (for backward compatibility)
}

/**
 * Create a new file type tracker
 */
export function create_file_type_tracker(): FileTypeTracker {
  return {
    variable_types: new Map(),
    imported_classes: new Map(),
    exported_definitions: new Set(),
  };
}

/**
 * Set the type of a variable using TypeInfo
 */
export function set_variable_type(
  tracker: FileTypeTracker,
  variable_symbol: SymbolId,
  type_info: LegacyTypeInfo
): FileTypeTracker;

// Legacy overload for migration compatibility
export function set_variable_type(
  tracker: FileTypeTracker,
  var_name: string,
  type_info: LegacyTypeInfo
): FileTypeTracker;

export function set_variable_type(
  tracker: FileTypeTracker,
  var_name_or_symbol: string | SymbolId,
  type_info: LegacyTypeInfo
): FileTypeTracker {
  // Convert to SymbolId if needed
  let symbol_id: SymbolId;
  let var_name: string;
  
  if (typeof var_name_or_symbol === 'string' && !var_name_or_symbol.includes(':')) {
    // Legacy string parameter - convert to SymbolId
    var_name = var_name_or_symbol;
    symbol_id = `variable:${tracker.file_path || 'unknown'}:${var_name}` as SymbolId;
  } else {
    // SymbolId parameter
    symbol_id = var_name_or_symbol as SymbolId;
    // Extract variable name for legacy compatibility
    const parts = symbol_id.split(':');
    var_name = parts[parts.length - 1];
  }
  
  // Convert to TypeInfo from packages/types
  const api_type_info: TypeInfo = {
    type_name: (type_info.type_name || 'unknown') as TypeName,
    type_kind: (type_info.type_kind || 'unknown') as TypeKind,
    location: type_info.location,
    confidence: normalize_confidence(type_info.confidence),
    source: type_info.source
  };
  
  // Store in variable_types map
  const new_variable_types = new Map(tracker.variable_types);
  new_variable_types.set(symbol_id, api_type_info);
  
  // Also maintain legacy types if needed
  const legacy_types = tracker.legacy_types || new Map();
  const existing = legacy_types.get(var_name) || [];
  legacy_types.set(var_name, [...existing, type_info]);

  return {
    ...tracker,
    variable_types: new_variable_types,
    legacy_types,
  };
}

/**
 * Normalize confidence value to TypeInfo's expected format
 */
function normalize_confidence(
  confidence?: "explicit" | "inferred" | "assumed" | number
): "explicit" | "inferred" | "assumed" {
  if (typeof confidence === 'number') {
    return confidence >= 0.8 ? "explicit" : confidence >= 0.5 ? "inferred" : "assumed";
  }
  return confidence || "assumed";
}

/**
 * Track an imported class/type using SymbolId
 */
export function set_imported_class(
  tracker: FileTypeTracker,
  local_symbol: SymbolId,
  class_info: ImportedClassInfo
): FileTypeTracker;

// Legacy overload for migration compatibility
export function set_imported_class(
  tracker: FileTypeTracker,
  local_name: string,
  class_info: ImportedClassInfo
): FileTypeTracker;

export function set_imported_class(
  tracker: FileTypeTracker,
  local_name_or_symbol: string | SymbolId,
  class_info: ImportedClassInfo
): FileTypeTracker {
  const new_imported_classes = new Map(tracker.imported_classes);
  const legacy_imports = new Map(tracker.legacy_imports || new Map());
  
  // Handle SymbolId parameter
  if (typeof local_name_or_symbol === 'string' && local_name_or_symbol.includes(':')) {
    new_imported_classes.set(local_name_or_symbol as SymbolId, class_info);
    
    // Also maintain legacy map for backward compatibility - extract the local name from the symbol
    // SymbolId format: "kind:file_path:line:column:end_line:end_column:name[:qualifier]"
    const symbol_parts = local_name_or_symbol.split(':');
    // Name is at position 6 (0-indexed)
    const local_name = symbol_parts.length > 7 ? symbol_parts[7] : symbol_parts[6];
    legacy_imports.set(local_name, class_info);
  } else {
    // Legacy string parameter - maintain backward compatibility
    const local_name = local_name_or_symbol as string;
    legacy_imports.set(local_name, class_info);
  }

  return {
    ...tracker,
    imported_classes: new_imported_classes,
    legacy_imports,
  };
}

/**
 * Get imported class information using SymbolId
 */
export function get_imported_class(
  tracker: FileTypeTracker,
  local_symbol: SymbolId
): ImportedClassInfo | undefined;

// Legacy overload for migration compatibility
export function get_imported_class(
  tracker: FileTypeTracker,
  local_name: string
): ImportedClassInfo | undefined;

export function get_imported_class(
  tracker: FileTypeTracker,
  local_name_or_symbol: string | SymbolId
): ImportedClassInfo | undefined {
  // Handle SymbolId parameter
  if (typeof local_name_or_symbol === 'string' && local_name_or_symbol.includes(':')) {
    return tracker.imported_classes.get(local_name_or_symbol as SymbolId);
  }
  
  // Legacy string parameter - check legacy imports
  const local_name = local_name_or_symbol as string;
  return tracker.legacy_imports?.get(local_name);
}

/**
 * Mark a definition as exported
 */
export function mark_as_exported(
  tracker: FileTypeTracker,
  def_name: string
): FileTypeTracker {
  const new_exported_definitions = new Set(tracker.exported_definitions);
  new_exported_definitions.add(def_name);

  return {
    ...tracker,
    exported_definitions: new_exported_definitions,
  };
}

/**
 * Check if a definition is exported
 */
export function is_exported(
  tracker: FileTypeTracker,
  def_name: string
): boolean {
  return tracker.exported_definitions.has(def_name);
}


/**
 * Determine type kind from type name
 */
export function infer_type_kind(
  type_name: string,
  language: Language
): TypeKind {
  // Primitive types
  const primitives = [
    "string",
    "number",
    "boolean",
    "null",
    "undefined",
    "void",
    "any",
    "unknown",
  ];
  if (primitives.includes(type_name.toLowerCase())) {
    return TypeKind.PRIMITIVE;
  }

  // Array types
  if (type_name.includes("[]") || type_name.startsWith("Array<")) {
    return TypeKind.ARRAY;
  }

  // Function types
  if (type_name.includes("=>") || type_name.includes("Function")) {
    return TypeKind.FUNCTION;
  }

  // Interface (TypeScript)
  if (language === "typescript" && type_name.startsWith("I")) {
    // Convention: interfaces often start with I
    return TypeKind.INTERFACE;
  }

  // Object literals
  if (type_name.includes("{") || type_name === "object") {
    return TypeKind.OBJECT;
  }

  // Assume class for capitalized names
  if (type_name[0] === type_name[0].toUpperCase()) {
    return TypeKind.CLASS;
  }

  return TypeKind.UNKNOWN;
}

// =============================================================================
// GENERIC CONFIGURATION-DRIVEN PROCESSING
// =============================================================================

import { SyntaxNode } from "tree-sitter";
import {
  get_type_tracking_config,
  is_assignment_node,
  get_literal_type,
  get_collection_type,
} from "./language_configs";

/**
 * MODULE_CONTEXT constant for logging and debugging
 */
export const MODULE_CONTEXT = "type_tracking" as const;

/**
 * Generic assignment tracking using configuration
 */
export function track_assignment_generic(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  const source_code = context.source_code;
  const config = get_type_tracking_config(context.language);

  // Check if this is an assignment node
  if (!is_assignment_node(node.type, config)) {
    return tracker;
  }

  // Handle variable declarations
  if (node.type === config.assignment_nodes.variable_declaration) {
    const name_node = node.childForFieldName(config.field_names.name);
    const value_node = node.childForFieldName(config.field_names.value);
    // For Python, check both 'annotation' and 'type' field names
    let type_node = config.field_names.type
      ? node.childForFieldName(config.field_names.type)
      : undefined;
    if (!type_node && context.language === "python") {
      // Python uses 'type' field directly in assignment nodes
      type_node = node.childForFieldName("type");
    }

    if (name_node) {
      const var_name = source_code.substring(
        name_node.startIndex,
        name_node.endIndex
      );

      // First check for explicit type annotation
      if (type_node) {
        const type_info = extract_type_annotation_generic(type_node, context);
        if (type_info) {
          return set_variable_type(tracker, var_name, {
            ...type_info,
            variable_name: var_name,
          });
        }
      }

      // Otherwise infer from value
      if (value_node) {
        const type_info = infer_type_generic(value_node, context);
        if (type_info) {
          return set_variable_type(tracker, var_name, {
            ...type_info,
            variable_name: var_name,
          });
        }
      }
    }
  }

  // Handle assignment expressions
  if (node.type === config.assignment_nodes.assignment_expression) {
    const left_node = node.childForFieldName("left");
    const right_node = node.childForFieldName("right");

    if (left_node && right_node && left_node.type === "identifier") {
      const var_name = source_code.substring(
        left_node.startIndex,
        left_node.endIndex
      );
      const type_info = infer_type_generic(right_node, context);

      if (type_info) {
        return set_variable_type(tracker, var_name, {
          ...type_info,
          variable_name: var_name,
        });
      }
    }
  }

  // Handle annotated assignments (Python)
  if (
    config.assignment_nodes.annotated_assignment &&
    node.type === config.assignment_nodes.annotated_assignment
  ) {
    const target_node = node.childForFieldName("target");
    const annotation_node = node.childForFieldName(
      config.field_names?.type || ""
    );

    if (target_node && annotation_node) {
      const var_name = source_code.substring(
        target_node.startIndex,
        target_node.endIndex
      );
      const type_info = extract_type_annotation_generic(
        annotation_node,
        context
      );

      if (type_info) {
        return set_variable_type(tracker, var_name, {
          ...type_info,
          variable_name: var_name,
        });
      }
    }
  }

  return tracker;
}

/**
 * Generic type inference from expressions
 */
export function infer_type_generic(
  node: SyntaxNode,
  context: TypeTrackingContext
): LegacyTypeInfo | undefined {
  const config = get_type_tracking_config(context.language);
  const location = node_to_location(node, context.file_path);

  // Check for literal types
  const literal_type = get_literal_type(node.type, config);
  if (literal_type) {
    // Special handling for numbers in Python (int vs float)
    if (
      context.language === "python" &&
      (node.type === "integer" || node.type === "float")
    ) {
      const text = context.source_code.substring(
        node.startIndex,
        node.endIndex
      );
      const type_name = text.includes(".") ? "float" : "int";
      return {
        type_name,
        type_kind: "primitive" as LegacyTypeInfo["type_kind"],
        location,
        confidence: "explicit",
        source: "assignment",
      };
    }

    return {
      type_name: literal_type.type_name,
      type_kind: literal_type.type_kind,
      location,
      confidence: "explicit",
      source: "assignment",
    };
  }

  // Check for collection types
  const collection_type = get_collection_type(node.type, config);
  if (collection_type) {
    return {
      type_name: collection_type.type_name,
      type_kind: collection_type.type_kind,
      location,
      confidence: "explicit",
      source: "assignment",
    };
  }

  // Check for function types
  if (
    config.function_patterns.function_declaration === node.type ||
    config.function_patterns.arrow_function === node.type ||
    config.function_patterns.anonymous_function === node.type
  ) {
    return {
      type_name: "function",
      type_kind: "function" as LegacyTypeInfo["type_kind"],
      location,
      confidence: "inferred",
      source: "assignment",
    };
  }

  // Check for class instantiation (new ClassName())
  if (node.type === "new_expression") {
    const constructor = node.childForFieldName("constructor");
    if (constructor) {
      const class_name = context.source_code.substring(
        constructor.startIndex,
        constructor.endIndex
      );
      return {
        type_name: class_name,
        type_kind: "class" as LegacyTypeInfo["type_kind"],
        location,
        confidence: "explicit",
        source: "constructor",
      };
    }
  }

  // Check for call expressions (might be constructor in Python/Rust)
  if (node.type === "call_expression" || node.type === "call") {
    const function_node = node.childForFieldName("function");
    if (function_node && function_node.type === "identifier") {
      const func_name = context.source_code.substring(
        function_node.startIndex,
        function_node.endIndex
      );
      // Heuristic: Capitalized names are likely constructors
      if (func_name[0] === func_name[0].toUpperCase()) {
        return {
          type_name: func_name,
          type_kind: "class" as LegacyTypeInfo["type_kind"],
          location,
          confidence: "inferred",
          source: "constructor",
        };
      }
    }
  }

  return undefined;
}

/**
 * Generic type annotation extraction
 */
export function extract_type_annotation_generic(
  type_node: SyntaxNode,
  context: TypeTrackingContext
): LegacyTypeInfo | undefined {
  const location = node_to_location(type_node, context.file_path);
  const config = get_type_tracking_config(context.language);

  if (!config.type_annotations) {
    return undefined;
  }

  // Handle type annotations (: type)
  if (type_node.type === config.type_annotations.type_annotation) {
    // Skip the colon and get the actual type
    const actual_type = type_node.child(1);
    if (actual_type) {
      return extract_type_annotation_generic(actual_type, context);
    }
  }

  // Handle Python type node (which wraps the actual type)
  if (type_node.type === "type") {
    // Python wraps types in a 'type' node
    if (type_node.childCount > 0) {
      const actual_type = type_node.child(0);
      if (actual_type) {
        // For generic types in Python, just extract the full text
        if (
          actual_type.type === "generic_type" ||
          actual_type.type === "subscript"
        ) {
          const full_type = context.source_code.substring(
            type_node.startIndex,
            type_node.endIndex
          );
          return {
            type_name: full_type,
            type_kind:
              (full_type.startsWith("List") || full_type.startsWith("list")
                ? "array"
                : full_type.startsWith("Dict") || full_type.startsWith("dict")
                ? "object"
                : "unknown") as LegacyTypeInfo["type_kind"],
            location,
            confidence: "explicit",
            source: "annotation",
          };
        }
        // Otherwise recurse
        return extract_type_annotation_generic(actual_type, context);
      }
    }
  }

  // Handle predefined types
  if (
    config.type_annotations.predefined_type &&
    type_node.type === config.type_annotations.predefined_type
  ) {
    const type_name = context.source_code.substring(
      type_node.startIndex,
      type_node.endIndex
    );
    return {
      type_name,
      type_kind: "primitive" as LegacyTypeInfo["type_kind"],
      location,
      confidence: "explicit",
      source: "annotation",
    };
  }

  // Handle type identifiers
  if (
    type_node.type === config.type_annotations.type_identifier ||
    type_node.type === "identifier"
  ) {
    const type_name = context.source_code.substring(
      type_node.startIndex,
      type_node.endIndex
    );
    return {
      type_name,
      type_kind: infer_type_kind(type_name, context.language) as LegacyTypeInfo["type_kind"],
      location,
      confidence: "explicit",
      source: "annotation",
    };
  }

  // Handle array types
  if (
    config.type_annotations.array_type &&
    type_node.type === config.type_annotations.array_type
  ) {
    // Just extract the full text for array types
    const full_type = context.source_code.substring(
      type_node.startIndex,
      type_node.endIndex
    );
    return {
      type_name: full_type,
      type_kind: "array" as LegacyTypeInfo["type_kind"],
      location,
      confidence: "explicit",
      source: "annotation",
    };
  }

  // Handle generic types
  if (
    config.type_annotations.generic_type &&
    type_node.type === config.type_annotations.generic_type
  ) {
    // Extract the full generic type string
    const full_type = context.source_code.substring(
      type_node.startIndex,
      type_node.endIndex
    );
    return {
      type_name: full_type,
      type_kind:
        (full_type.toLowerCase().includes("array") ||
        full_type.toLowerCase().includes("list") ||
        full_type.toLowerCase().includes("vec")
          ? "array"
          : "class") as LegacyTypeInfo["type_kind"],
      location,
      confidence: "explicit",
      source: "annotation",
    };
  }

  // Handle union types
  if (
    config.type_annotations.union_type &&
    type_node.type === config.type_annotations.union_type
  ) {
    const full_type = context.source_code.substring(
      type_node.startIndex,
      type_node.endIndex
    );
    return {
      type_name: full_type,
      type_kind: "unknown" as LegacyTypeInfo["type_kind"],
      location,
      confidence: "explicit",
      source: "annotation",
    };
  }

  // Handle tuple types
  if (type_node.type === "tuple_type") {
    // For tuples, we need to wrap in parentheses for consistency
    const full_type = context.source_code.substring(
      type_node.startIndex,
      type_node.endIndex
    );
    // Check if it already starts with '['
    const formatted_type = full_type.startsWith("[")
      ? `(${full_type.substring(1, full_type.length - 1)})` // Convert [a, b] to (a, b)
      : full_type;
    return {
      type_name: formatted_type,
      type_kind: "array" as LegacyTypeInfo["type_kind"],
      location,
      confidence: "explicit",
      source: "annotation",
    };
  }

  return undefined;
}

/**
 * Generic import tracking
 */
export function track_imports_generic(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  const config = get_type_tracking_config(context.language);

  // Check for import statements
  if (
    node.type !== config.import_patterns.import_statement &&
    node.type !== config.import_patterns.import_specifier
  ) {
    return tracker;
  }

  // JavaScript/TypeScript ES6 imports
  if (context.language === "javascript" || context.language === "typescript") {
    if (node.type === "import_statement") {
      const source_node = node.childForFieldName("source");
      if (!source_node) return tracker;

      const module_name = context.source_code.substring(
        source_node.startIndex + 1, // Skip opening quote
        source_node.endIndex - 1 // Skip closing quote
      );

      // Check if it's a type-only import
      let is_type_only = false;
      const first_child = node.child(0);
      if (first_child && first_child.type === "import") {
        const second_child = node.child(1);
        if (second_child && second_child.type === "type") {
          is_type_only = true;
        }
      }

      // Look for import clauses
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (!child) continue;

        // Named imports: import { Component, useState } from 'react'
        if (child.type === "import_clause") {
          // Check for named imports - it might be a field or just a child
          let named_imports = child.childForFieldName("named_imports");
          if (!named_imports) {
            // Look for named_imports as a direct child
            for (let j = 0; j < child.childCount; j++) {
              const clause_child = child.child(j);
              if (clause_child && clause_child.type === "named_imports") {
                named_imports = clause_child;
                break;
              }
            }
          }
          if (named_imports) {
            for (let j = 0; j < named_imports.childCount; j++) {
              const import_spec = named_imports.child(j);
              if (import_spec && import_spec.type === "import_specifier") {
                // The name might be under 'name' field or just be the first identifier child
                let name_node = import_spec.childForFieldName("name");
                if (!name_node && import_spec.childCount > 0) {
                  // Look for the first identifier child
                  for (let k = 0; k < import_spec.childCount; k++) {
                    const child = import_spec.child(k);
                    if (child && child.type === "identifier") {
                      name_node = child;
                      break;
                    }
                  }
                }

                const alias_node = import_spec.childForFieldName("alias");

                if (name_node) {
                  const import_name = context.source_code.substring(
                    name_node.startIndex,
                    name_node.endIndex
                  );
                  const local_name = alias_node
                    ? context.source_code.substring(
                        alias_node.startIndex,
                        alias_node.endIndex
                      )
                    : import_name;

                  // Create SymbolIds for the import
                  const import_location: Location = node_to_location(name_node, context.file_path);
                  const class_symbol_id = symbol_string({
                    kind: "class",
                    name: import_name as SymbolName,
                    location: import_location,
                  });
                  const local_symbol_id = symbol_string({
                    kind: "class",
                    name: local_name as SymbolName,
                    location: import_location,
                  });

                  tracker = set_imported_class(tracker, local_symbol_id, {
                    class_name: import_name, // Legacy
                    local_name: local_name, // Legacy
                    class_symbol: class_symbol_id,
                    source_module: module_name,
                    local_symbol: local_symbol_id,
                    is_type_only: is_type_only,
                  });
                }
              }
            }
          }

          // Default import: import React from 'react'
          const default_import = child.child(0);
          if (default_import && default_import.type === "identifier") {
            const import_name = context.source_code.substring(
              default_import.startIndex,
              default_import.endIndex
            );
            // Create SymbolIds for the default import
            const default_location: Location = node_to_location(default_import, context.file_path);
            const class_symbol_id = symbol_string({
              kind: "class",
              name: import_name as SymbolName,
              location: default_location,
            });
            const local_symbol_id = symbol_string({
              kind: "class",
              name: import_name as SymbolName,
              location: default_location,
            });

            tracker = set_imported_class(tracker, local_symbol_id, {
              class_name: import_name, // Legacy
              local_name: import_name, // Legacy
              class_symbol: class_symbol_id,
              source_module: module_name,
              local_symbol: local_symbol_id,
              is_default: true,
              is_type_only: is_type_only,
            });
          }
        }

        // Namespace import: import * as utils from './utils'
        if (child.type === "namespace_import") {
          const namespace_name = child.child(2); // Skip '* as'
          if (namespace_name) {
            const import_name = context.source_code.substring(
              namespace_name.startIndex,
              namespace_name.endIndex
            );
            // Create SymbolIds for the namespace import
            const namespace_location: Location = node_to_location(namespace_name, context.file_path);
            const namespace_symbol_id = symbol_string({
              kind: "namespace",
              name: "*" as SymbolName,
              location: namespace_location,
            });
            const local_symbol_id = symbol_string({
              kind: "namespace",
              name: import_name as SymbolName,
              location: namespace_location,
            });

            tracker = set_imported_class(tracker, local_symbol_id, {
              class_name: "*", // Legacy
              local_name: import_name, // Legacy
              class_symbol: namespace_symbol_id,
              source_module: module_name,
              local_symbol: local_symbol_id,
            });
          }
        }
      }
    }
  }

  // Python imports
  if (context.language === "python") {
    // from module import name
    if (node.type === "import_from_statement") {
      // Get module name - could be 'module_name' field or just a dotted_name
      let module_node = node.childForFieldName("module_name");
      let module_name = "";

      // Look for dotted_name after 'from'
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === "from") {
          const next_child = node.child(i + 1);
          if (
            next_child &&
            (next_child.type === "dotted_name" ||
              next_child.type === "identifier")
          ) {
            module_node = next_child;
            module_name = context.source_code.substring(
              next_child.startIndex,
              next_child.endIndex
            );
            break;
          }
        }
      }

      if (!module_name && module_node) {
        module_name = context.source_code.substring(
          module_node.startIndex,
          module_node.endIndex
        );
      }

      // Look for imported names after 'import'
      let found_import = false;
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);

        if (child && child.type === "import") {
          found_import = true;
          continue;
        }

        if (found_import && child) {
          // Handle aliased imports (SomeClass as Alias)
          if (child.type === "aliased_import") {
            const name_node = child.childForFieldName("name");
            const alias_node = child.childForFieldName("alias");

            if (name_node && alias_node) {
              // Use field names if available
              const class_name = context.source_code.substring(
                name_node.startIndex,
                name_node.endIndex
              );
              const local_name = context.source_code.substring(
                alias_node.startIndex,
                alias_node.endIndex
              );

              // Create SymbolIds for the aliased import
              const import_location: Location = node_to_location(alias_node || name_node, context.file_path);
              const class_symbol_id = symbol_string({
                kind: "class",
                name: class_name as SymbolName,
                location: import_location,
              });
              const local_symbol_id = symbol_string({
                kind: "class",
                name: local_name as SymbolName,
                location: import_location,
              });

              tracker = set_imported_class(tracker, local_symbol_id, {
                class_name: class_name, // Legacy
                local_name: local_name, // Legacy
                class_symbol: class_symbol_id,
                source_module: module_name,
                local_symbol: local_symbol_id,
              });
            } else if (child.childCount >= 3) {
              // Fallback: Structure is: name as alias
              const actual_name = child.child(0);
              const alias = child.child(2); // Skip 'as'

              if (actual_name && alias) {
                const class_name = context.source_code.substring(
                  actual_name.startIndex,
                  actual_name.endIndex
                );
                const local_name = context.source_code.substring(
                  alias.startIndex,
                  alias.endIndex
                );

                // Create SymbolIds for the aliased import
                const import_location: Location = node_to_location(alias || actual_name, context.file_path);
                const class_symbol_id = symbol_string({
                  kind: "class",
                  name: class_name as SymbolName,
                  location: import_location,
                });
                const local_symbol_id = symbol_string({
                  kind: "class",
                  name: local_name as SymbolName,
                  location: import_location,
                });

                tracker = set_imported_class(tracker, local_symbol_id, {
                  class_name: class_name, // Legacy
                  local_name: local_name, // Legacy
                  class_symbol: class_symbol_id,
                  source_module: module_name,
                  local_symbol: local_symbol_id,
                });
              }
            }
          }
          // Handle regular imports
          else if (
            child.type === "dotted_name" ||
            child.type === "identifier"
          ) {
            const import_name = context.source_code.substring(
              child.startIndex,
              child.endIndex
            );
            // Create SymbolIds for the regular import
            const import_location: Location = node_to_location(child, context.file_path);
            const class_symbol_id = symbol_string({
              kind: "class",
              name: import_name as SymbolName,
              location: import_location,
            });
            const local_symbol_id = symbol_string({
              kind: "class",
              name: import_name as SymbolName,
              location: import_location,
            });

            tracker = set_imported_class(tracker, local_symbol_id, {
              class_name: import_name, // Legacy
              local_name: import_name, // Legacy
              class_symbol: class_symbol_id,
              source_module: module_name,
              local_symbol: local_symbol_id,
            });
          }
        }
      }
    }

    // import module
    if (node.type === "import_statement") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (
          child &&
          (child.type === "dotted_name" || child.type === "identifier")
        ) {
          const module_name = context.source_code.substring(
            child.startIndex,
            child.endIndex
          );
          if (module_name !== "import") {
            // Create SymbolIds for the module import
            const import_location: Location = node_to_location(child, context.file_path);
            const class_symbol_id = symbol_string({
              kind: "module",
              name: module_name as SymbolName,
              location: import_location,
            });
            const local_symbol_id = symbol_string({
              kind: "module",
              name: module_name as SymbolName,
              location: import_location,
            });

            tracker = set_imported_class(tracker, local_symbol_id, {
              class_name: module_name, // Legacy
              local_name: module_name, // Legacy
              class_symbol: class_symbol_id,
              source_module: module_name,
              local_symbol: local_symbol_id,
            });
          }
        }
      }
    }
  }

  // Rust imports
  if (context.language === "rust") {
    if (node.type === "use_declaration") {
      // Extract the use path
      const use_tree = node.childForFieldName("argument");
      if (use_tree) {
        tracker = extract_rust_imports(use_tree, tracker, context, "");
      }
    }
  }

  return tracker;
}

/**
 * Helper to extract Rust use paths and imports
 */
function extract_rust_imports(
  node: SyntaxNode,
  tracker: FileTypeTracker,
  context: TypeTrackingContext,
  path_prefix: string
): FileTypeTracker {
  // Simple identifier: use std;
  if (node.type === "identifier") {
    const name = context.source_code.substring(node.startIndex, node.endIndex);
    const full_path = path_prefix ? `${path_prefix}::${name}` : name;
    // Create SymbolIds for the simple import
    const import_location: Location = node_to_location(node, context.file_path);
    const class_symbol_id = symbol_string({
      kind: "class",
      name: name as SymbolName,
      location: import_location,
    });
    const local_symbol_id = symbol_string({
      kind: "class",
      name: name as SymbolName,
      location: import_location,
    });
    
    return set_imported_class(tracker, local_symbol_id, {
      class_name: name, // Legacy
      local_name: name, // Legacy
      class_symbol: class_symbol_id,
      source_module: full_path,
      local_symbol: local_symbol_id,
    });
  }

  // Scoped identifier: use std::collections::HashMap;
  if (node.type === "scoped_identifier") {
    const full_path = context.source_code.substring(node.startIndex, node.endIndex);
    const parts = full_path.split("::");
    const name = parts[parts.length - 1];
    // Create SymbolIds for the scoped import
    const import_location: Location = node_to_location(node, context.file_path);
    const class_symbol_id = symbol_string({
      kind: "class",
      name: name as SymbolName,
      location: import_location,
    });
    const local_symbol_id = symbol_string({
      kind: "class",
      name: name as SymbolName,
      location: import_location,
    });
    
    return set_imported_class(tracker, local_symbol_id, {
      class_name: name, // Legacy
      local_name: name, // Legacy
      class_symbol: class_symbol_id,
      source_module: full_path,
      local_symbol: local_symbol_id,
    });
  }

  // Use list: use std::io::{Read, Write};
  if (node.type === "scoped_use_list") {
    const path_node = node.childForFieldName("path");
    const base_path = path_node
      ? context.source_code.substring(path_node.startIndex, path_node.endIndex)
      : path_prefix;

    // Find the use_list child
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === "use_list") {
        // Process each item in the list
        for (let j = 0; j < child.childCount; j++) {
          const item = child.child(j);
          if (
            item &&
            (item.type === "identifier" || item.type === "use_as_clause")
          ) {
            tracker = extract_rust_imports(
              item,
              tracker,
              context,
              base_path
            );
          }
        }
      }
    }
    return tracker;
  }

  // Aliased import: use crate::utils::helper as h;
  if (node.type === "use_as_clause") {
    const path_node = node.childForFieldName("path");
    const alias_node = node.childForFieldName("alias");

    if (path_node) {
      const full_path = context.source_code.substring(
        path_node.startIndex,
        path_node.endIndex
      );
      const parts = full_path.split("::");
      const original_name = parts[parts.length - 1];
      const alias = alias_node
        ? context.source_code.substring(alias_node.startIndex, alias_node.endIndex)
        : original_name;

      // Create SymbolIds for the aliased import
      const import_location: Location = node_to_location(alias_node || path_node, context.file_path);
      const class_symbol_id = symbol_string({
        kind: "class",
        name: original_name as SymbolName,
        location: import_location,
      });
      const local_symbol_id = symbol_string({
        kind: "class",
        name: alias as SymbolName,
        location: import_location,
      });
      
      return set_imported_class(tracker, local_symbol_id, {
        class_name: original_name, // Legacy
        local_name: alias, // Legacy
        class_symbol: class_symbol_id,
        source_module: full_path,
        local_symbol: local_symbol_id,
      });
    }
  }

  return tracker;
}

/**
 * Generic export tracking
 */
export function track_exports_generic(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  const config = get_type_tracking_config(context.language);

  if (!config.export_patterns.export_statement) {
    return tracker;
  }

  if (node.type === config.export_patterns.export_statement) {
    // Extract exported names and mark them
    // This will be expanded based on language-specific needs
  }

  return tracker;
}

/**
 * Build type index from file analyses
 */
export function build_type_index(analyses: FileAnalysis[]): TypeIndex {
  const variables = new Map<string, VariableType>();
  const functions = new Map<string, FunctionSignature>();
  const definitions = new Map<string, TypeDefinition>();
  const type_graph: TypeGraph = {
    nodes: new Map(),
    edges: [],
  };

  // Build variable types
  for (const analysis of analyses) {
    if (analysis.type_info) {
      for (const [var_name, type_info] of analysis.type_info.entries()) {
        // Skip entries that are not variables (e.g., Python instance attributes like self.count)
        // These are tracked in type_info for type analysis but aren't standalone variables
        if (var_name.includes(".")) {
          continue;
        }

        const key = `${analysis.file_path}#${var_name}`;

        // Find the scope containing this variable
        let var_scope = null;
        let scope_type = "unknown";

        for (const [scope_id, scope] of analysis.scopes.nodes) {
          if (scope.symbols.has(var_name)) {
            var_scope = scope;
            scope_type = scope.type;
            break;
          }
        }

        if (!var_scope) {
          // Some type_info entries might not be in the scope tree (e.g., builtin types)
          // Skip them instead of throwing an error
          console.warn(
            `Variable ${var_name} has type info but not found in scope tree`
          );
          continue;
        }

        variables.set(key, {
          name: var_name,
          type: (type_info.type_name || "unknown") as TypeString,
          scope_kind: scope_type as ScopeType,
          location: type_info.location,
        });
      }
    }
  }

  // TODO: Build function signatures, type definitions, and type graph

  return {
    variables,
    functions,
    definitions,
    type_graph,
  };
}
