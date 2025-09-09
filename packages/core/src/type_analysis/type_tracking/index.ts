/**
 * Type tracking module
 *
 * Provides functionality for tracking variable types, imported classes,
 * and type information across codebases.
 *
 * Uses configuration-driven generic processing with language-specific
 * bespoke handlers for unique features.
 */

import { SyntaxNode } from "tree-sitter";
import { Language, ImportInfo } from "@ariadnejs/types";

// Re-export public API types and functions
export {
  // Core Types
  TypeInfo,
  ImportedClassInfo,
  TypeTrackingContext,
  FileTypeTracker,

  // Core tracker operations
  create_file_type_tracker,
  set_variable_type,
  get_imported_class,
  set_imported_class,
  
  // Export tracking
  mark_as_exported,
  is_exported,

  // Type utilities
  infer_type_kind,
} from "./type_tracking";

// Re-export configuration system
export {
  TypeTrackingLanguageConfig,
  get_type_tracking_config as getTypeTrackingConfig,
  is_assignment_node as isAssignmentNode,
  get_literal_type as getLiteralType,
  get_collection_type as getCollectionType,
} from "./language_configs";

// Import bespoke handlers
import {
  track_typescript_interface,
  track_typescript_type_alias,
  extract_typescript_complex_generics,
  track_typescript_enum,
  extract_decorator_type_metadata,
  extract_typescript_conditional_type,
  extract_typescript_mapped_type,
  track_typescript_namespace,
} from "./type_tracking.typescript.bespoke";

import {
  track_javascript_constructor_function,
  track_javascript_prototype_assignment,
  track_javascript_require,
  track_javascript_dynamic_property,
  infer_javascript_instanceof,
  track_javascript_object_create,
} from "./type_tracking.javascript.bespoke";

import {
  extract_python_union_type,
  track_python_dataclass,
  track_python_property,
  track_python_context_manager,
  track_python_comprehension,
  track_python_multiple_inheritance,
  track_python_typing_imports,
} from "./type_tracking.python.bespoke";

import {
  track_rust_ownership,
  track_rust_lifetimes,
  track_rust_trait,
  track_rust_impl,
  track_rust_pattern_match,
  track_rust_associated_type,
  track_rust_enum,
  track_rust_if_let,
  track_rust_macro_types,
  infer_rust_typed_literal,
} from "./type_tracking.rust.bespoke";

// Import generic functions and types
import {
  FileTypeTracker,
  TypeTrackingContext,
  TypeInfo,
  track_assignment_generic,
  track_imports_generic,
  track_exports_generic,
  infer_type_generic,
  extract_type_annotation_generic,
  create_file_type_tracker,
  set_variable_type,
} from "./type_tracking";

import { get_type_tracking_config } from "./language_configs";
import { merge_imported_types } from "./import_type_resolver";

/**
 * Main entry point for tracking type assignments
 * Combines generic processing with language-specific bespoke handlers
 */
export function track_assignment(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  const source_code = context.source_code;
  // For Rust, we need custom assignment handling to use proper type inference
  if (context.language === "rust") {
    const config = get_type_tracking_config(context.language);

    // Handle Rust let declarations with typed literals
    if (node.type === config.assignment_nodes.variable_declaration) {
      const name_node = node.childForFieldName(config.field_names.name);
      const value_node = node.childForFieldName(config.field_names.value);
      const type_node = node.childForFieldName(config.field_names.type || "");

      if (name_node) {
        const var_name = source_code.substring(
          name_node.startIndex,
          name_node.endIndex
        );
        let handled = false;

        // First check for explicit type annotation
        if (type_node) {
          const type_info = extract_type_annotation_generic(type_node, context);
          if (type_info) {
            tracker = set_variable_type(tracker, var_name, {
              ...type_info,
              variable_name: var_name,
            });
            handled = true;
          }
        }
        // Otherwise infer from value using full infer_type (including bespoke)
        if (!handled && value_node) {
          const type_info = infer_type(value_node, context);
          if (type_info) {
            tracker = set_variable_type(tracker, var_name, {
              ...type_info,
              variable_name: var_name,
            });
            handled = true;
          }
        }

        // If we handled it, apply Rust bespoke handlers and return
        if (handled) {
          tracker = track_rust_trait(tracker, node, context);
          tracker = track_rust_impl(tracker, node, context);
          tracker = track_rust_enum(tracker, node, context);
          tracker = track_rust_pattern_match(
            tracker,
            node,
            context
          );
          tracker = track_rust_if_let(tracker, node, context);
          tracker = track_rust_associated_type(
            tracker,
            node,
            context
          );
          tracker = track_rust_macro_types(tracker, node, context);
          return tracker;
        }
      }
    }
  }

  // Apply generic processing for other cases
  let updated_tracker = track_assignment_generic(
    tracker,
    node,
    context
  );

  // Then apply language-specific bespoke processing
  switch (context.language) {
    case "typescript":
      updated_tracker = track_typescript_interface(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_typescript_type_alias(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_typescript_enum(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_typescript_namespace(
        updated_tracker,
        node,
        context
      );
      break;

    case "javascript":
      updated_tracker = track_javascript_constructor_function(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_javascript_prototype_assignment(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_javascript_require(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_javascript_dynamic_property(
        updated_tracker,
        node,
        context
      );
      break;

    case "python":
      updated_tracker = track_python_dataclass(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_python_context_manager(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_python_multiple_inheritance(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_python_typing_imports(
        updated_tracker,
        node,
        context
      );
      break;

    case "rust":
      updated_tracker = track_rust_trait(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_rust_impl(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_rust_enum(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_rust_pattern_match(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_rust_if_let(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_rust_associated_type(
        updated_tracker,
        node,
        context
      );
      updated_tracker = track_rust_macro_types(
        updated_tracker,
        node,
        context
      );
      break;
  }

  return updated_tracker;
}

/**
 * Main entry point for tracking imports
 */
export function track_imports(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  // Apply generic import tracking
  let updated_tracker = track_imports_generic(
    tracker,
    node,
    context
  );

  // Apply language-specific import handling
  switch (context.language) {
    case "javascript":
      // CommonJS require() is handled in bespoke
      updated_tracker = track_javascript_require(
        updated_tracker,
        node,
        context
      );
      break;

    case "python":
      // typing module imports get special handling
      updated_tracker = track_python_typing_imports(
        updated_tracker,
        node,
        context
      );
      break;
  }

  return updated_tracker;
}

/**
 * Process imports from import_resolution layer
 *
 * Instead of extracting imports from AST (which was duplicate work),
 * this now uses the ImportInfo[] already extracted by import_resolution.
 */
export function process_imports_for_types(
  tracker: FileTypeTracker,
  imports: ImportInfo[],
  context: TypeTrackingContext
): FileTypeTracker {
  // Use the import type resolver to merge imports into tracker
  merge_imported_types(tracker, imports);
  return tracker;
}

/**
 * Main entry point for tracking exports
 */
export function track_exports(
  tracker: FileTypeTracker,
  node: SyntaxNode,
  context: TypeTrackingContext
): FileTypeTracker {
  return track_exports_generic(tracker, node, context);
}

/**
 * Infer type from expression based on language
 */
export function infer_type(
  node: SyntaxNode,
  context: TypeTrackingContext
): TypeInfo | undefined {
  // For Rust, check typed literals first (before generic inference)
  if (context.language === "rust") {
    const rust_typed_literal = infer_rust_typed_literal(
      node,
      context
    );
    if (rust_typed_literal) return rust_typed_literal;
  }

  // Try generic inference
  const generic_type = infer_type_generic(node, context);
  if (generic_type) {
    return generic_type;
  }

  // Try language-specific bespoke inference
  switch (context.language) {
    case "javascript":
      const js_instanceof = infer_javascript_instanceof(
        node,
        context
      );
      if (js_instanceof) return js_instanceof;

      const js_object_create = track_javascript_object_create(
        node,
        context
      );
      if (js_object_create) return js_object_create;
      break;

    case "typescript":
      const ts_conditional = extract_typescript_conditional_type(
        node,
        context
      );
      if (ts_conditional) return ts_conditional;

      const ts_mapped = extract_typescript_mapped_type(
        node,
        context
      );
      if (ts_mapped) return ts_mapped;

      const ts_decorator = extract_decorator_type_metadata(
        node,
        context
      );
      if (ts_decorator) return ts_decorator;
      break;

    case "python":
      const py_union = extract_python_union_type(node, context);
      if (py_union) return py_union;

      const py_property = track_python_property(node, context);
      if (py_property) return py_property;

      const py_comprehension = track_python_comprehension(
        node,
        context
      );
      if (py_comprehension) return py_comprehension;
      break;

    case "rust":
      const rust_ownership = track_rust_ownership(node, context);
      if (rust_ownership) return rust_ownership;

      const rust_lifetime = track_rust_lifetimes(node, context);
      if (rust_lifetime) return rust_lifetime;
      break;
  }

  return undefined;
}

/**
 * Process an entire file for type tracking
 */
export function process_file_for_types(
  tree: SyntaxNode,
  context: TypeTrackingContext,
  imports?: ImportInfo[]
): FileTypeTracker {
  let tracker = create_file_type_tracker();

  // Process imports from import_resolution layer
  if (imports && imports.length > 0) {
    tracker = process_imports_for_types(tracker, imports, context);
  }

  // Walk the tree and track types
  function visit(node: SyntaxNode) {
    // Track assignments and type definitions
    tracker = track_assignment(tracker, node, context);
    tracker = track_imports(tracker, node, context);
    tracker = track_exports(tracker, node, context);

    // Recurse
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        visit(child);
      }
    }
  }

  visit(tree);
  return tracker;
}
