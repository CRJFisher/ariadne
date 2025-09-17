/**
 * Shared utilities for class resolution (used by constructor and method resolution)
 */

import {
  ClassDefinition,
  FilePath,
  SymbolName,
  ModulePath,
  ScopeTree,
  ScopeNode,
  ScopeId,
  SymbolId,
} from "@ariadnejs/types";
import { DefinitionIndex, FileResolutionContext } from "../symbol_resolution";

/**
 * Find class in a file
 */
export function find_class_in_file(
  class_name: SymbolName,
  file_path: FilePath,
  definitions: DefinitionIndex
): ClassDefinition | undefined {
  const file_defs = definitions.classes_by_file.get(file_path);
  if (!file_defs) return undefined;

  for (const [, class_def] of file_defs) {
    if (class_def.name === class_name) {
      return class_def;
    }
  }

  return undefined;
}

/**
 * Resolve an imported class
 */
export function resolve_imported_class(
  class_name: SymbolName,
  file_path: FilePath,
  context: FileResolutionContext
): ClassDefinition | undefined {
  const imports = context.imports_by_file.get(file_path);
  if (!imports) return undefined;

  // Find import that might provide this class
  for (const imp of imports) {
    switch (imp.kind) {
      case "named":
        // Check if class is in named imports
        for (const item of imp.imports) {
          const local_name = item.alias || item.name;
          if (local_name === class_name) {
            return find_class_in_file(item.name, imp.source, context.definitions);
          }
        }
        break;

      case "default":
        if (imp.name === class_name) {
          const source_file = imp.source;
          if (source_file) {
            // Look for default exported class
            return find_default_exported_class(source_file, context);
          }
        }
        break;

      case "namespace":
        // Namespace imports would be handled differently
        break;
    }
  }

  return undefined;
}

/**
 * Find the default exported class from a file
 */
export function find_default_exported_class(
  file_path: FilePath,
  context: FileResolutionContext
): ClassDefinition | undefined {
  const exports = context.exports_by_file.get(file_path);
  if (!exports) return undefined;

  for (const exp of exports) {
    if (exp.kind === "default") {
      // Find the class with this symbol
      const file_defs = context.definitions.classes_by_file.get(file_path);
      if (file_defs) {
        for (const [, class_def] of file_defs) {
          if (class_def.name === exp.symbol_name) {
            return class_def;
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Find the containing class scope
 */
export function find_containing_class_scope(
  scope_id: ScopeId,
  scope_tree: ScopeTree
): ScopeNode | undefined {
  let current_id = scope_id;

  while (current_id) {
    const scope_node = scope_tree.nodes.get(current_id);
    if (!scope_node) break;

    if (scope_node.type === "class") {
      return scope_node;
    }

    if (scope_node.parent_id) {
      current_id = scope_node.parent_id;
    } else {
      break;
    }
  }

  return undefined;
}

/**
 * Get class definition from a class scope
 */
export function get_class_from_scope(
  class_scope: ScopeNode,
  definitions: FileResolutionContext["definitions"]
): ClassDefinition | undefined {
  // Use the scope's location to find the matching class definition
  const file_path = class_scope.location.file_path;
  const file_defs = definitions.classes_by_file.get(file_path);
  if (!file_defs) return undefined;

  // Find class at the scope's location
  for (const [, class_def] of file_defs) {
    // Check if class location matches scope location
    // Classes should be defined at the same location as their scope
    if (
      class_def.location.file_path === class_scope.location.file_path &&
      class_def.location.line === class_scope.location.line &&
      class_def.location.column === class_scope.location.column
    ) {
      return class_def;
    }
  }

  return undefined;
}

/**
 * Check if scope_a is an ancestor of scope_b or the same scope
 */
export function is_scope_ancestor_or_same(
  scope_a: ScopeId,
  scope_b: ScopeId,
  scope_tree: ScopeTree
): boolean {
  if (scope_a === scope_b) return true;

  let current = scope_b;
  while (current) {
    if (current === scope_a) return true;

    // Get parent scope
    const current_node = scope_tree.nodes.get(current);
    if (!current_node || !current_node.parent_id) break;

    current = current_node.parent_id;
  }

  return false;
}

/**
 * Find parent class definition
 */
export function find_parent_class(
  parent_name: SymbolName,
  file_path: FilePath,
  context: FileResolutionContext
): ClassDefinition | undefined {
  // 1. Check local file
  const local_class = find_class_in_file(parent_name, file_path, context.definitions);
  if (local_class) return local_class;

  // 2. Check imports
  return resolve_imported_class(parent_name, file_path, context);
}