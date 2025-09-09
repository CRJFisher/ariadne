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

import { FilePath, Language, Location, SourceCode } from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";

/**
 * Type information for a variable at a specific position
 */
export interface TypeInfo {
  variable_name?: string; // The variable name (for tracking assignments)
  type_name: string; // The type name (e.g., "string", "MyClass")
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
  is_return_value?: boolean; // Whether this type is from a return statement
  is_property_assignment?: boolean; // Whether this is a property assignment (this.prop, self.prop)
}

/**
 * Information about an imported class/type
 */
export interface ImportedClassInfo {
  class_name: string;
  source_module: string;
  local_name: string;
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
  variable_types: Map<string, TypeInfo[]>; // Variable name -> type history
  imported_classes: Map<string, ImportedClassInfo>; // Local name -> import info
  exported_definitions: Set<string>; // Names of exported definitions
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
 * Set the type of a variable at a specific position
 */
export function set_variable_type(
  tracker: FileTypeTracker,
  var_name: string,
  type_info: TypeInfo
): FileTypeTracker {
  const existing_types = tracker.variable_types.get(var_name) || [];

  // Add new type and sort by position
  const new_types = [...existing_types, type_info].sort((a, b) => {
    if (a.location.line !== b.location.line) {
      return a.location.line - b.location.line;
    }
    return a.location.column - b.location.column;
  });

  // Create new tracker with updated types
  const new_variable_types = new Map(tracker.variable_types);
  new_variable_types.set(var_name, new_types);

  return {
    ...tracker,
    variable_types: new_variable_types,
  };
}

/**
 * Track an imported class/type
 */
export function set_imported_class(
  tracker: FileTypeTracker,
  local_name: string,
  class_info: ImportedClassInfo
): FileTypeTracker {
  const new_imported_classes = new Map(tracker.imported_classes);
  new_imported_classes.set(local_name, class_info);

  return {
    ...tracker,
    imported_classes: new_imported_classes,
  };
}

/**
 * Get imported class information
 */
export function get_imported_class(
  tracker: FileTypeTracker,
  local_name: string
): ImportedClassInfo | undefined {
  return tracker.imported_classes.get(local_name);
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
): TypeInfo["type_kind"] {
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
    return "primitive";
  }

  // Array types
  if (type_name.includes("[]") || type_name.startsWith("Array<")) {
    return "array";
  }

  // Function types
  if (type_name.includes("=>") || type_name.includes("Function")) {
    return "function";
  }

  // Interface (TypeScript)
  if (language === "typescript" && type_name.startsWith("I")) {
    // Convention: interfaces often start with I
    return "interface";
  }

  // Object literals
  if (type_name.includes("{") || type_name === "object") {
    return "object";
  }

  // Assume class for capitalized names
  if (type_name[0] === type_name[0].toUpperCase()) {
    return "class";
  }

  return "unknown";
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
): TypeInfo | undefined {
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
        type_kind: "primitive",
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
      type_kind: "function",
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
        type_kind: "class",
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
          type_kind: "class",
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
): TypeInfo | undefined {
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
              full_type.startsWith("List") || full_type.startsWith("list")
                ? "array"
                : full_type.startsWith("Dict") || full_type.startsWith("dict")
                ? "object"
                : "unknown",
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
      type_kind: "primitive",
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
      type_kind: infer_type_kind(type_name, context.language),
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
      type_kind: "array",
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
        full_type.toLowerCase().includes("array") ||
        full_type.toLowerCase().includes("list") ||
        full_type.toLowerCase().includes("vec")
          ? "array"
          : "class",
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
      type_kind: "unknown",
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
      type_kind: "array",
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

                  tracker = set_imported_class(tracker, local_name, {
                    class_name: import_name,
                    source_module: module_name,
                    local_name: local_name,
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
            tracker = set_imported_class(tracker, import_name, {
              class_name: import_name,
              source_module: module_name,
              local_name: import_name,
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
            tracker = set_imported_class(tracker, import_name, {
              class_name: "*",
              source_module: module_name,
              local_name: import_name,
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

              tracker = set_imported_class(tracker, local_name, {
                class_name: class_name,
                source_module: module_name,
                local_name: local_name,
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

                tracker = set_imported_class(tracker, local_name, {
                  class_name: class_name,
                  source_module: module_name,
                  local_name: local_name,
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
            tracker = set_imported_class(tracker, import_name, {
              class_name: import_name,
              source_module: module_name,
              local_name: import_name,
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
            tracker = set_imported_class(tracker, module_name, {
              class_name: module_name,
              source_module: module_name,
              local_name: module_name,
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
    return set_imported_class(tracker, name, {
      class_name: name,
      source_module: full_path,
      local_name: name,
    });
  }

  // Scoped identifier: use std::collections::HashMap;
  if (node.type === "scoped_identifier") {
    const full_path = context.source_code.substring(node.startIndex, node.endIndex);
    const parts = full_path.split("::");
    const name = parts[parts.length - 1];
    return set_imported_class(tracker, name, {
      class_name: name,
      source_module: full_path,
      local_name: name,
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

      return set_imported_class(tracker, alias, {
        class_name: original_name,
        source_module: full_path,
        local_name: alias,
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
