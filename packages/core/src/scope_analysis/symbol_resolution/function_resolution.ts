import {
  FunctionCall,
  FunctionDefinition,
  FilePath,
  SymbolName,
  Import,
  SymbolId,
  function_symbol,
  NamedImport,
  ScopeNode,
  ScopeId,
  Location,
  ModulePath,
  ModuleGraph,
  ScopeTree,
} from "@ariadnejs/types";
import { FileResolutionContext } from "./symbol_resolution";
import { find_scope_at_location } from "../scope_tree";
import { resolve, dirname, join } from "path";

/**
 * Resolve a function call to its definition using configuration-driven patterns
 */
export function resolve_function_call(
  call: FunctionCall,
  context: FileResolutionContext
): FunctionDefinition | undefined {
  const { scope_tree } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_location(scope_tree, call.location);

  // 1. Try local resolution first (check if defined in current or parent scopes)
  // Look for function in the same file's definitions
  const file_definitions = context.definitions.get(
    call.location.file_path as FilePath
  );
  if (file_definitions) {
    // Check all functions in the file to see if any match the callee name
    const functions = Array.from(file_definitions.functions.entries());
    for (const [symbol_id, func_def] of functions) {
      if (func_def.name === call.callee) {
        // If we have a scope, check accessibility; otherwise assume it's accessible (for testing)
        if (
          !call_scope ||
          is_function_accessible_from_scope(
            func_def,
            call_scope,
            call.location,
            context
          )
        ) {
          return func_def;
        }
      }
    }
  }

  // 2. Parse the callee to check for namespace access
  const { namespace, member } = parse_qualified_name(call.callee);

  if (namespace) {
    // Handle namespace member access (e.g., "math.sqrt")
    // In Rust, also handle :: separators
    const namespace_def = resolve_namespace_member_call(
      namespace,
      member,
      call.location.file_path,
      context
    );
    if (namespace_def) return namespace_def;
  }

  // 3. Try import resolution
  const imports = context.imports_by_file.get(
    call.location.file_path as FilePath
  );
  if (imports) {
    const match = match_callee_to_import(call.callee, imports);
    if (match) {
      const import_def = resolve_import_to_definition(
        match.import,
        match.exported_name,
        context,
        call.location.file_path as FilePath
      );
      if (import_def) return import_def;
    }
  }

  // 4. Fall back to language-specific or global resolution
  // This would handle built-ins, globals, etc.
  // For now, return undefined - can be extended later

  return undefined;
}

/**
 * Match a callee name to an import in the file
 */
function match_callee_to_import(
  callee: SymbolName,
  imports: readonly Import[]
): { import: Import; exported_name: SymbolName } | undefined {
  for (const imp of imports) {
    switch (imp.kind) {
      case "named":
        // Check each named import
        for (const item of imp.imports) {
          const local_name = item.alias || item.name;
          if (local_name === callee) {
            return { import: imp, exported_name: item.name };
          }
        }
        break;

      case "default":
        // Check if callee matches the default import name
        if (imp.name === callee) {
          return { import: imp, exported_name: "default" as SymbolName };
        }
        break;

      case "namespace":
        // Namespace imports are handled in resolve_namespace_member_call
        // for qualified calls like `ns.foo()`
        break;
    }
  }
  return undefined;
}

/**
 * Resolve a module path to a file path using module graph or file system conventions
 */
function resolve_module_to_file(
  module_path: FilePath,
  from_file: FilePath,
  context: FileResolutionContext
): FilePath | undefined {
  // 1. If we have a module graph, use it to find the actual file
  if (context.module_graph) {
    // Check if the module is already in the graph (absolute path)
    const modules = Array.from(context.module_graph.modules.entries());
    for (const [file_path, module_node] of modules) {
      if (file_path === (module_path as unknown as FilePath)) {
        return file_path;
      }
      // Check if any imports match this module path
      const imports = Array.from(module_node.imports.entries());
      for (const [import_path] of imports) {
        if (import_path === module_path) {
          // Found a match - but we need to resolve it properly
          // This is a known import, so it should be resolvable
          break;
        }
      }
    }
  }

  // 2. Try to resolve as a relative path
  const module_str = module_path as string;
  if (module_str.startsWith("./") || module_str.startsWith("../")) {
    // Relative import - resolve relative to the importing file
    const from_dir = dirname(from_file as string);

    // Simple path joining for relative imports
    let resolved: string;
    if (module_str.startsWith("./")) {
      // Same directory: src/main.ts + ./utils = src/utils
      resolved = from_dir + "/" + module_str.slice(2);
    } else if (module_str.startsWith("../")) {
      // Parent directory: handle '../' paths
      const parts = from_dir.split("/");
      const module_parts = module_str.split("/");

      // Go up directories for each '../'
      for (const part of module_parts) {
        if (part === "..") {
          parts.pop();
        } else if (part !== ".") {
          parts.push(part);
        }
      }
      resolved = parts.join("/");
    } else {
      resolved = resolve(from_dir, module_str);
    }

    // Add common extensions if not present
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs"];

    // First try the exact path
    if (context.exports_by_file.has(resolved as FilePath)) {
      return resolved as FilePath;
    }

    // Try with extensions
    for (const ext of extensions) {
      const with_ext = resolved + ext;
      if (context.exports_by_file.has(with_ext as FilePath)) {
        return with_ext as FilePath;
      }
    }

    // Also check if the resolved path matches any export file paths
    // Sometimes paths are stored with leading './'
    const normalizedResolved = resolved.replace(/^\.\//, "");
    for (const ext of extensions) {
      const with_ext = normalizedResolved + ext;
      if (context.exports_by_file.has(with_ext as FilePath)) {
        return with_ext as FilePath;
      }
    }

    // Try index files
    const index_files = ["index.ts", "index.js", "__init__.py", "mod.rs"];
    for (const index of index_files) {
      const index_path = join(resolved, index);
      if (context.exports_by_file.has(index_path as FilePath)) {
        return index_path as FilePath;
      }
    }
  }

  // 3. For non-relative imports, check special cases by language
  if (context.language === "rust") {
    // In Rust, crate names typically map to src/lib.rs
    // Check if this is a crate import
    if (!module_str.includes("/") && !module_str.includes("::")) {
      // This looks like a crate name - check for src/lib.rs
      const lib_path = "src/lib.rs" as FilePath;
      if (context.exports_by_file.has(lib_path)) {
        return lib_path;
      }
    }
  }

  // 4. For non-relative imports, check if it's in our known files
  // This handles absolute imports and module names
  const file_paths = Array.from(context.exports_by_file.keys());
  for (const file_path of file_paths) {
    const file_str = file_path as string;
    // Simple heuristic: check if file ends with the module name
    if (
      file_str.endsWith(module_str) ||
      file_str.endsWith(module_str + ".ts") ||
      file_str.endsWith(module_str + ".js") ||
      file_str.endsWith(module_str + ".py") ||
      file_str.endsWith(module_str + ".rs")
    ) {
      return file_path;
    }
  }

  // 5. Could not resolve - return undefined
  return undefined;
}

/**
 * Parse a qualified name (e.g., "ns.foo" or "module::submodule::func")
 */
function parse_qualified_name(callee: SymbolName): {
  namespace?: SymbolName;
  member: SymbolName;
} {
  const callee_str = callee as string;

  // Handle both . and :: separators
  let parts: string[];
  if (callee_str.includes("::")) {
    parts = callee_str.split("::");
  } else {
    parts = callee_str.split(".");
  }

  if (parts.length === 1) {
    return { member: callee };
  }

  // For now, treat everything before the last separator as namespace
  const namespace = parts
    .slice(0, -1)
    .join(callee_str.includes("::") ? "::" : ".") as SymbolName;
  const member = parts[parts.length - 1] as SymbolName;
  return { namespace, member };
}

/**
 * Resolve an import to a function definition
 */
function resolve_import_to_definition(
  imp: Import,
  exported_name: SymbolName,
  context: FileResolutionContext,
  from_file?: FilePath
): FunctionDefinition | undefined {
  // Get the source file path from the import
  // Use proper module resolution if we have the context
  let source_path: FilePath | undefined;

  if (from_file) {
    source_path = resolve_module_to_file(imp.source, from_file, context);
  }

  // Fallback to direct cast if resolution failed
  if (!source_path) {
    source_path = imp.source as unknown as FilePath;
  }

  // Look for exports in the source file
  const exports = context.exports_by_file.get(source_path);
  if (!exports) return undefined;

  // Find the matching export
  let matching_function_name: SymbolName | undefined;

  for (const exp of exports) {
    switch (exp.kind) {
      case "named":
        // Check named exports
        for (const item of exp.exports) {
          if (item.local_name === exported_name) {
            // Found the matching export
            matching_function_name = item.local_name;
            break;
          }
        }
        break;

      case "default":
        // Check default export
        if (exported_name === ("default" as SymbolName)) {
          matching_function_name = exp.symbol;
        }
        break;

      case "reexport":
        // Handle re-exports: export { foo } from './other'
        for (const item of exp.exports) {
          if (item.source_name === exported_name) {
            // This is re-exported from another module
            // Recursively resolve from the re-export source
            const reexport_import: Import = {
              kind: "named",
              source: exp.source,
              imports: [
                {
                  name: item.source_name,
                  is_type_only: item.is_type_only,
                },
              ],
            } as unknown as NamedImport;

            return resolve_import_to_definition(
              reexport_import,
              item.source_name,
              context,
              from_file
            );
          }
        }
        break;

      case "namespace":
        // Handle barrel exports: export * from './other'
        // This exports everything from another module
        // Try to resolve from the source module
        if (exp.source) {
          const barrel_import: Import = {
            kind: "named",
            source: exp.source,
            imports: [
              {
                name: exported_name,
                is_type_only: false,
              },
            ],
          } as unknown as NamedImport;

          const barrel_def = resolve_import_to_definition(
            barrel_import,
            exported_name,
            context,
            from_file
          );
          if (barrel_def) return barrel_def;
        }
        break;
    }

    if (matching_function_name) break;
  }

  if (!matching_function_name) return undefined;

  // Look up the definition by name
  const definitions = context.definitions.get(source_path);
  if (definitions) {
    // Search through all functions to find one with matching name
    const functions = Array.from(definitions.functions.entries());
    for (const [, func_def] of functions) {
      if (func_def.name === matching_function_name) {
        return func_def;
      }
    }
  }

  return undefined;
}

/**
 * Check if a function definition is accessible from a given scope
 */
function is_function_accessible_from_scope(
  func_def: FunctionDefinition,
  call_scope: ScopeId,
  call_location: Location,
  context: FileResolutionContext
): boolean {
  const { scope_tree, language } = context;
  // TODO: simplify!
  // Find the scope where the function is defined
  const func_scope = find_scope_at_location(scope_tree, func_def.location);

  if (!func_scope) {
    // If we can't find the function's scope, be conservative
    return false;
  }

  // JavaScript/TypeScript: Functions are hoisted to the top of their containing scope
  if (language === "javascript" || language === "typescript") {
    // Check if function is declared (not an expression)
    // Function declarations are hoisted and accessible throughout their scope
    // For now, assume all functions are accessible (hoisting)
    // TODO: Distinguish between function declarations and expressions

    // Check if they're in the same scope or if func is in a parent scope
    return is_scope_ancestor_or_same(func_scope, call_scope, scope_tree);
  }

  // Python: Functions must be defined before use (except in classes)
  if (language === "python") {
    // Check if the function is defined before the call
    if (func_def.location.line > call_location.line) {
      // Function defined after call - not accessible in Python
      return false;
    }
    // Check if the function is accessible from the call scope
    // In Python, nested functions are accessible from their containing scope
    if (is_scope_ancestor_or_same(func_scope, call_scope, scope_tree)) {
      return true;
    }
    // Also check if both are in the same parent scope (sibling functions)
    // or if the call is in a parent scope of where the function is defined
    if (is_scope_ancestor_or_same(call_scope, func_scope, scope_tree)) {
      return true;
    }
    return false;
  }

  // Rust: Functions are accessible within their module
  if (language === "rust") {
    // In Rust, all items in a module are accessible to each other
    // regardless of definition order
    return is_scope_ancestor_or_same(func_scope, call_scope, scope_tree);
  }

  // Default: Check if function is in an ancestor scope
  return is_scope_ancestor_or_same(func_scope, call_scope, scope_tree);
}

/**
 * Check if scope_a is an ancestor of scope_b or the same scope
 */
function is_scope_ancestor_or_same(
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
 * Resolve a namespace member call (e.g., "ns.foo()")
 */
function resolve_namespace_member_call(
  namespace: SymbolName,
  member: SymbolName,
  file_path: FilePath,
  context: FileResolutionContext
): FunctionDefinition | undefined {
  const imports = context.imports_by_file.get(file_path);
  if (!imports) return undefined;

  // Find namespace import
  for (const imp of imports) {
    if (
      imp.kind === "namespace" &&
      (imp.namespace_name as string) === (namespace as string)
    ) {
      // Resolve member from the namespace source
      return resolve_import_to_definition(imp, member, context, file_path);
    }
  }

  return undefined;
}
