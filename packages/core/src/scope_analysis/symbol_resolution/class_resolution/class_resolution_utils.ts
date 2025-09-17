/**
 * Shared utilities for class resolution (used by constructor and method resolution)
 */

import {
  ClassDefinition,
  FilePath,
  SymbolName,
  Import,
  Export,
  ModulePath,
  ScopeTree,
  ScopeNode,
  ScopeId,
  Location,
} from "@ariadnejs/types";
import { FileResolutionContext } from "./symbol_resolution";
import { find_scope_at_location } from "../scope_tree";
import { dirname, join } from "path";

/**
 * Find class in a file
 */
export function find_class_in_file(
  class_name: SymbolName,
  file_path: FilePath,
  definitions_by_file: FileResolutionContext["definitions_by_file"]
): ClassDefinition | undefined {
  const file_defs = definitions_by_file.get(file_path);
  if (!file_defs) return undefined;

  for (const [, class_def] of file_defs.classes) {
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
            // Resolve to the source file
            const source_file = resolve_module_to_file(imp.source, file_path, context);
            if (source_file) {
              return find_class_in_file(item.name, source_file, context.definitions_by_file);
            }
          }
        }
        break;

      case "default":
        if (imp.name === class_name) {
          const source_file = resolve_module_to_file(imp.source, file_path, context);
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
      const file_defs = context.definitions_by_file.get(file_path);
      if (file_defs) {
        for (const [, class_def] of file_defs.classes) {
          if (class_def.name === exp.symbol) {
            return class_def;
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Resolve a module path to a file path
 */
export function resolve_module_to_file(
  module_path: ModulePath,
  from_file: FilePath,
  context: FileResolutionContext
): FilePath | undefined {
  // 1. If we have a module graph, use it
  if (context.module_graph) {
    const modules = Array.from(context.module_graph.modules.entries());
    for (const [file_path] of modules) {
      if (file_path === (module_path as unknown as FilePath)) {
        return file_path;
      }
    }
  }

  // 2. Try to resolve as a relative path
  const module_str = module_path as string;
  if (module_str.startsWith('./') || module_str.startsWith('../')) {
    const from_dir = dirname(from_file as string);

    let resolved: string;
    if (module_str.startsWith('./')) {
      resolved = from_dir + '/' + module_str.slice(2);
    } else if (module_str.startsWith('../')) {
      const parts = from_dir.split('/');
      const module_parts = module_str.split('/');

      for (const part of module_parts) {
        if (part === '..') {
          parts.pop();
        } else if (part !== '.') {
          parts.push(part);
        }
      }
      resolved = parts.join('/');
    } else {
      resolved = from_dir + '/' + module_str;
    }

    // Try with common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs'];

    if (context.exports_by_file.has(resolved as FilePath)) {
      return resolved as FilePath;
    }

    for (const ext of extensions) {
      const with_ext = resolved + ext;
      if (context.exports_by_file.has(with_ext as FilePath)) {
        return with_ext as FilePath;
      }
    }

    // Also check if the resolved path matches any export file paths
    // Sometimes paths are stored with leading './'
    const normalizedResolved = resolved.replace(/^\.\//, '');
    for (const ext of extensions) {
      const with_ext = normalizedResolved + ext;
      if (context.exports_by_file.has(with_ext as FilePath)) {
        return with_ext as FilePath;
      }
    }

    // Try index files
    const index_files = ['index.ts', 'index.js', '__init__.py', 'mod.rs'];
    for (const index of index_files) {
      const index_path = join(resolved, index);
      if (context.exports_by_file.has(index_path as FilePath)) {
        return index_path as FilePath;
      }
    }
  }

  // 3. For non-relative imports, check special cases by language
  if (context.language === "rust") {
    if (!module_str.includes('/') && !module_str.includes('::')) {
      const lib_path = "src/lib.rs" as FilePath;
      if (context.exports_by_file.has(lib_path)) {
        return lib_path;
      }
    }
  }

  // 4. For Python, handle dotted module paths
  if (context.language === "python" && module_str.includes('.')) {
    // Convert dots to slashes for Python module paths
    const path_with_slashes = module_str.replace(/\./g, '/');

    // Try with .py extension
    const py_path = path_with_slashes + '.py';
    if (context.exports_by_file.has(py_path as FilePath)) {
      return py_path as FilePath;
    }

    // Try __init__.py in the module directory
    const init_path = path_with_slashes + '/__init__.py';
    if (context.exports_by_file.has(init_path as FilePath)) {
      return init_path as FilePath;
    }
  }

  // 5. Check known files
  const file_paths = Array.from(context.exports_by_file.keys());
  for (const file_path of file_paths) {
    const file_str = file_path as string;
    if (file_str.endsWith(module_str) ||
        file_str.endsWith(module_str + '.ts') ||
        file_str.endsWith(module_str + '.js') ||
        file_str.endsWith(module_str + '.py') ||
        file_str.endsWith(module_str + '.rs')) {
      return file_path;
    }

    // For Python, also check if module path matches with dots replaced by slashes
    if (context.language === "python" && module_str.includes('.')) {
      const path_with_slashes = module_str.replace(/\./g, '/');
      if (file_str.endsWith(path_with_slashes + '.py') ||
          file_str === path_with_slashes + '.py') {
        return file_path;
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

    current_id = scope_node.parent_id;
  }

  return undefined;
}

/**
 * Get class definition from a class scope
 */
export function get_class_from_scope(
  class_scope: ScopeNode,
  definitions_by_file: FileResolutionContext["definitions_by_file"]
): ClassDefinition | undefined {
  // Use the scope's location to find the matching class definition
  const file_path = class_scope.location.file_path;
  const file_defs = definitions_by_file.get(file_path);
  if (!file_defs) return undefined;

  // Find class at the scope's location
  for (const [, class_def] of file_defs.classes) {
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
  const local_class = find_class_in_file(parent_name, file_path, context.definitions_by_file);
  if (local_class) return local_class;

  // 2. Check imports
  return resolve_imported_class(parent_name, file_path, context);
}