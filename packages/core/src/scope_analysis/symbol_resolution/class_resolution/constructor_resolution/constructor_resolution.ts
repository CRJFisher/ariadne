import {
  ConstructorCall,
  ClassDefinition,
  FilePath,
  SymbolName,
  Import,
  SymbolId,
  class_symbol,
  NamedImport,
  ScopeId,
  Location,
  ScopeTree,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";
import { find_scope_at_location } from "../../../scope_tree";
import {
  find_class_in_file,
  resolve_imported_class,
  resolve_module_to_file,
  find_containing_class_scope,
  is_scope_ancestor_or_same,
} from "../class_resolution_utils";

/**
 * Resolve a constructor call to its class definition using configuration-driven patterns
 */
export function resolve_constructor_call(
  call: ConstructorCall,
  context: FileResolutionContext
): ClassDefinition | undefined {
  const { scope_tree, language } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_location(scope_tree, call.location);

  // 1. Try local resolution first (check if defined in current file)
  const file_definitions = context.definitions_by_file.get(call.location.file_path as FilePath);
  if (file_definitions) {
    // Check all classes in the file to see if any match the class name
    const classes = Array.from(file_definitions.classes.entries());
    for (const [symbol_id, class_def] of classes) {
      if (class_def.name === call.class_name) {
        // Check accessibility
        if (call_scope) {
          // If we have a scope, check accessibility properly
          if (is_class_accessible_from_scope(class_def, call_scope, call.location, context)) {
            return class_def;
          }
        } else {
          // No scope information - for JS/TS, still check temporal dead zone
          if (context.language === "javascript" || context.language === "typescript") {
            // Classes cannot be used before declaration in the same file
            if (class_def.location.file_path === call.location.file_path &&
                class_def.location.line > call.location.line) {
              // Class defined after call - temporal dead zone
              continue;
            }
          } else if (context.language === "python") {
            // Python also requires definition before use
            if (class_def.location.file_path === call.location.file_path &&
                class_def.location.line > call.location.line) {
              continue;
            }
          }
          // Otherwise assume it's accessible
          return class_def;
        }
      }
    }
  }

  // 2. Parse the class name to check for namespace/module access
  const { namespace, member } = parse_qualified_class_name(call.class_name, language);

  if (namespace) {
    // Handle namespace member access (e.g., "React.Component" or "module::ClassName")
    const namespace_def = resolve_namespace_class(
      namespace,
      member,
      call.location.file_path,
      context
    );
    if (namespace_def) return namespace_def;
  } else if (member !== call.class_name) {
    // If parsing extracted a different name (e.g., "MyStruct" from "MyStruct::new"),
    // try to resolve with the extracted class name
    const extractedCall: ConstructorCall = { ...call, class_name: member };
    return resolve_constructor_call(extractedCall, context);
  }

  // 3. Try import resolution
  const imports = context.imports_by_file.get(call.location.file_path as FilePath);
  if (imports) {
    const match = match_class_to_import(call.class_name, imports);
    if (match) {
      const import_def = resolve_import_to_class_definition(
        match.import,
        match.exported_name,
        context,
        call.location.file_path as FilePath
      );
      if (import_def) return import_def;
    }
  }

  // 4. Handle language-specific patterns
  if (language === "python" && call.class_name === ("super" as SymbolName)) {
    // Special handling for Python's super().__init__()
    return resolve_python_super(call, context);
  }

  // 5. Fall back to global/built-in resolution
  // This would handle built-in classes like Array, Object, etc.
  // For now, return undefined - can be extended later

  return undefined;
}

/**
 * Match a class name to an import in the file
 */
function match_class_to_import(
  class_name: SymbolName,
  imports: readonly Import[]
): { import: Import; exported_name: SymbolName } | undefined {
  for (const imp of imports) {
    switch (imp.kind) {
      case "named":
        // Check each named import
        for (const item of imp.imports) {
          const local_name = item.alias || item.name;
          if (local_name === class_name) {
            return { import: imp, exported_name: item.name };
          }
        }
        break;

      case "default":
        // Check if class matches the default import name
        if (imp.name === class_name) {
          return { import: imp, exported_name: "default" as SymbolName };
        }
        break;

      case "namespace":
        // Namespace imports are handled in resolve_namespace_class
        // for qualified calls like `ns.ClassName()`
        break;
    }
  }
  return undefined;
}

/**
 * Parse a qualified class name (e.g., "ns.ClassName" or "module::ClassName")
 */
function parse_qualified_class_name(
  class_name: SymbolName,
  language: string
): {
  namespace?: SymbolName;
  member: SymbolName;
} {
  const class_str = class_name as string;

  // In Rust, handle :: separator for associated functions like ClassName::new
  if (language === "rust" && class_str.includes("::")) {
    const parts = class_str.split("::");

    // For ClassName::new or ClassName::variant, extract just the class name
    if (parts.length === 2) {
      const first_part = parts[0];
      const second_part = parts[1];

      // Check if this is a method/variant pattern (ClassName::new, Enum::Variant)
      if (first_part && first_part[0] === first_part[0].toUpperCase() &&
          second_part && (second_part === "new" || second_part[0] === second_part[0].toUpperCase())) {
        // This is ClassName::new or Enum::Variant - return the class name
        return { member: first_part as SymbolName };
      }

      // Otherwise it's module::ClassName
      if (second_part && second_part[0] === second_part[0].toUpperCase()) {
        return {
          namespace: first_part as SymbolName,
          member: second_part as SymbolName
        };
      }
    } else if (parts.length > 2) {
      // module::submodule::ClassName - last part is class, rest is namespace
      const last_part = parts[parts.length - 1];
      if (last_part && last_part[0] === last_part[0].toUpperCase()) {
        return {
          namespace: parts.slice(0, -1).join("::") as SymbolName,
          member: last_part as SymbolName
        };
      }
    }

    // Default: treat first part as class for ClassName::new pattern
    return { member: parts[0] as SymbolName };
  }

  // Handle . separator for other languages
  const parts = class_str.split(".");
  if (parts.length === 1) {
    return { member: class_name };
  }

  // For now, treat everything before the last separator as namespace
  const namespace = parts.slice(0, -1).join(".") as SymbolName;
  const member = parts[parts.length - 1] as SymbolName;
  return { namespace, member };
}

/**
 * Resolve an import to a class definition
 */
function resolve_import_to_class_definition(
  imp: Import,
  exported_name: SymbolName,
  context: FileResolutionContext,
  from_file?: FilePath
): ClassDefinition | undefined {
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
  let matching_class_name: SymbolName | undefined;

  for (const exp of exports) {
    switch (exp.kind) {
      case "named":
        // Check named exports
        for (const item of exp.exports) {
          if (item.local_name === exported_name) {
            // Found the matching export
            matching_class_name = item.local_name;
            break;
          }
        }
        break;

      case "default":
        // Check default export
        if (exported_name === ("default" as SymbolName)) {
          matching_class_name = exp.symbol;
        }
        break;

      case "reexport":
        // Handle re-exports: export { Foo } from './other'
        for (const item of exp.exports) {
          if (item.exported_name === exported_name || item.source_name === exported_name) {
            // This is re-exported from another module
            // Recursively resolve from the re-export source
            const reexport_import: Import = {
              kind: "named",
              source: exp.source,
              imports: [{
                name: item.source_name,
                is_type_only: item.is_type_only,
              }],
            } as unknown as NamedImport;

            return resolve_import_to_class_definition(
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
            imports: [{
              name: exported_name,
              is_type_only: false,
            }],
          } as unknown as NamedImport;

          const barrel_def = resolve_import_to_class_definition(
            barrel_import,
            exported_name,
            context,
            from_file
          );
          if (barrel_def) return barrel_def;
        }
        break;
    }

    if (matching_class_name) break;
  }

  if (!matching_class_name) return undefined;

  // Look up the definition by name
  const definitions = context.definitions_by_file.get(source_path);
  if (definitions) {
    // Search through all classes to find one with matching name
    const classes = Array.from(definitions.classes.entries());
    for (const [, class_def] of classes) {
      if (class_def.name === matching_class_name) {
        return class_def;
      }
    }
  }

  return undefined;
}

/**
 * Check if a class definition is accessible from a given scope
 */
function is_class_accessible_from_scope(
  class_def: ClassDefinition,
  call_scope: ScopeId,
  call_location: Location,
  context: FileResolutionContext
): boolean {
  const { scope_tree, language } = context;

  // Find the scope where the class is defined
  const class_scope = find_scope_at_location(
    scope_tree,
    class_def.location
  );

  if (!class_scope) {
    // If we can't find the class's scope, be conservative
    return false;
  }

  // JavaScript/TypeScript: Classes are hoisted (like functions) but cannot be used before declaration
  if (language === "javascript" || language === "typescript") {
    // Unlike function declarations, class declarations are not hoisted in their value
    // They are hoisted but remain in the temporal dead zone until initialized
    // Check if they're in the same file first
    if (class_def.location.file_path === call_location.file_path) {
      if (class_def.location.line > call_location.line) {
        // Class defined after call - not accessible due to temporal dead zone
        return false;
      }
    }

    // Check if they're in the same scope or if class is in a parent scope
    return is_scope_ancestor_or_same(class_scope, call_scope, scope_tree);
  }

  // Python: Classes must be defined before use
  if (language === "python") {
    // Check if the class is defined before the call
    if (class_def.location.line > call_location.line) {
      // Class defined after call - not accessible in Python
      return false;
    }
    // Check if the class is accessible from the call scope
    if (is_scope_ancestor_or_same(class_scope, call_scope, scope_tree)) {
      return true;
    }
    // Also check if both are in the same parent scope (sibling classes)
    // or if the call is in a parent scope of where the class is defined
    if (is_scope_ancestor_or_same(call_scope, class_scope, scope_tree)) {
      return true;
    }
    return false;
  }

  // Rust: Types are accessible within their module
  if (language === "rust") {
    // In Rust, all items in a module are accessible to each other
    // regardless of definition order
    return is_scope_ancestor_or_same(class_scope, call_scope, scope_tree);
  }

  // Default: Check if class is in an ancestor scope
  return is_scope_ancestor_or_same(class_scope, call_scope, scope_tree);
}

/**
 * Resolve a namespace class (e.g., "ns.ClassName")
 */
function resolve_namespace_class(
  namespace: SymbolName,
  class_name: SymbolName,
  file_path: FilePath,
  context: FileResolutionContext
): ClassDefinition | undefined {
  const imports = context.imports_by_file.get(file_path);
  if (!imports) return undefined;

  // Find namespace import
  for (const imp of imports) {
    if (imp.kind === "namespace" && (imp.namespace_name as string) === (namespace as string)) {
      // Resolve class from the namespace source
      return resolve_import_to_class_definition(
        imp,
        class_name,
        context,
        file_path
      );
    }
  }

  return undefined;
}

/**
 * Resolve Python's super() calls to the parent class
 */
function resolve_python_super(
  call: ConstructorCall,
  context: FileResolutionContext
): ClassDefinition | undefined {
  // Find the class containing this super() call
  const { scope_tree } = context;
  const call_scope = find_scope_at_location(scope_tree, call.location);

  if (!call_scope) return undefined;

  // Walk up the scope tree to find the containing class
  let current_scope = call_scope;
  while (current_scope) {
    const scope_node = scope_tree.nodes.get(current_scope);
    if (!scope_node) break;

    // Check if this is a class scope
    if (scope_node.type === "class") {
      // Found the containing class - now find its parent
      // This would require looking at the class inheritance
      // For now, this is a placeholder - actual implementation would
      // need to look at the class's base classes

      // Get all classes in the file
      const file_definitions = context.definitions_by_file.get(call.location.file_path as FilePath);
      if (file_definitions) {
        const classes = Array.from(file_definitions.classes.values());
        for (const cls of classes) {
          // Check if this class is at the same location as our scope
          const class_scope = find_scope_at_location(scope_tree, cls.location);
          if (class_scope === current_scope) {
            // Found the containing class
            // Now look for its parent class
            if (cls.base_classes && cls.base_classes.length > 0) {
              // Get the first base class
              const base_class_name = cls.base_classes[0];

              // Try to resolve the base class
              // This could be imported or defined locally
              const base_call: ConstructorCall = {
                ...call,
                class_name: base_class_name
              };

              // Recursively resolve the base class (but avoid super() to prevent infinite recursion)
              if (base_class_name !== ("super" as SymbolName)) {
                return resolve_constructor_call(base_call, context);
              }
            }
            break;
          }
        }
      }
      break;
    }

    // Move to parent scope
    if (scope_node.parent_id) {
      current_scope = scope_node.parent_id;
    } else {
      break;
    }
  }

  return undefined;
}