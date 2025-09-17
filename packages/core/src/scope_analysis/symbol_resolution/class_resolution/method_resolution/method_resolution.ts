/**
 * Method Resolution - Resolves method calls to their definitions across files
 */

import {
  MethodCall,
  MethodDefinition,
  ClassDefinition,
  FilePath,
  SymbolName,
  Import,
  Export,
  SymbolId,
  method_symbol,
  class_symbol,
  NamedImport,
  ScopeNode,
  ScopeId,
  Location,
  ModulePath,
  ModuleGraph,
  ScopeTree,
  VariableDefinition,
  Language,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";
import { find_scope_at_location } from "../../../scope_tree";
import {
  find_class_in_file,
  resolve_imported_class,
  resolve_module_to_file,
  find_containing_class_scope,
  find_parent_class,
  find_default_exported_class,
  get_class_from_scope,
} from "../class_resolution_utils";

/**
 * Resolve a method call to its definition using configuration-driven patterns
 */
export function resolve_method_call(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  const { scope_tree, language, definitions_by_file } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_location(scope_tree, call.location);

  // 1. Handle self/this method calls within class context
  // Must check self reference first before static patterns, as "Self" in Rust
  // starts with uppercase but is a self-reference, not a static call
  if (is_self_reference(call.receiver, language)) {
    const method_def = resolve_self_method_call(call, call_scope, context);
    if (method_def) return method_def;
  }

  // 2. Handle static method calls (e.g., Class.method())
  // Only check static pattern if it's not a self-reference
  if (is_static_call_pattern(call) && !is_self_reference(call.receiver, language)) {
    const static_def = resolve_static_method_call(call, context);
    if (static_def) return static_def;
  }

  // 3. Trace receiver type to find the class
  const receiver_class = trace_receiver_type(call.receiver, call.location, context);
  if (receiver_class) {
    // Look for method in the resolved class
    const method_def = find_method_in_class(call.method_name, receiver_class, context);
    if (method_def) return method_def;

    // Check parent classes (inheritance)
    const inherited_def = resolve_inherited_method(call.method_name, receiver_class, context);
    if (inherited_def) return inherited_def;
  }

  // 4. Try import-based resolution
  const import_def = resolve_imported_method(call, context);
  if (import_def) return import_def;

  // 5. Handle language-specific patterns
  const lang_specific = resolve_language_specific_method(call, context);
  if (lang_specific) return lang_specific;

  return undefined;
}

/**
 * Check if the receiver is a self/this reference
 */
function is_self_reference(receiver: SymbolName, language: Language): boolean {
  const receiver_str = receiver as string;
  switch (language) {
    case "python":
      return receiver_str === "self" || receiver_str === "cls";
    case "javascript":
    case "typescript":
      return receiver_str === "this";
    case "rust":
      return receiver_str === "self" || receiver_str === "Self";
    default:
      return false;
  }
}

/**
 * Resolve self/this method calls within class context
 */
function resolve_self_method_call(
  call: MethodCall,
  call_scope: ScopeId | undefined,
  context: FileResolutionContext
): MethodDefinition | undefined {
  if (!call_scope) return undefined;

  const { scope_tree, definitions_by_file } = context;

  // Find the containing class scope
  const class_scope = find_containing_class_scope(call_scope, scope_tree);
  if (!class_scope) return undefined;

  // Get the class definition from the scope
  const class_def = get_class_from_scope(class_scope, definitions_by_file);
  if (!class_def) return undefined;

  // Find method in the class
  return find_method_in_class(call.method_name, class_def, context);
}

/**
 * Check if this is a static method call pattern
 */
function is_static_call_pattern(call: MethodCall): boolean {
  const receiver_str = call.receiver as string;

  // Check if receiver starts with uppercase (common class name pattern)
  if (receiver_str && receiver_str[0] === receiver_str[0].toUpperCase()) {
    return true;
  }

  // Check for qualified class names (e.g., module::Class)
  if (receiver_str.includes("::") || receiver_str.includes(".")) {
    const parts = receiver_str.split(/::|\./);
    const last_part = parts[parts.length - 1];
    if (last_part && last_part[0] === last_part[0].toUpperCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve static method calls (Class.method())
 */
function resolve_static_method_call(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  const { definitions_by_file, imports_by_file } = context;

  // Try to find the class
  const class_name = extract_class_from_receiver(call.receiver);
  if (!class_name) return undefined;

  // 1. Check local file for class definition
  const local_class = find_class_in_file(
    class_name,
    call.location.file_path as FilePath,
    definitions_by_file
  );

  if (local_class) {
    const method = find_method_in_class(call.method_name, local_class, context);
    if (method) return method;
    // Check inherited methods
    return resolve_inherited_method(call.method_name, local_class, context);
  }

  // 2. Check imports
  const imported_class = resolve_imported_class(
    class_name,
    call.location.file_path as FilePath,
    context
  );

  if (imported_class) {
    const method = find_method_in_class(call.method_name, imported_class, context);
    if (method) return method;
    // Check inherited methods
    return resolve_inherited_method(call.method_name, imported_class, context);
  }

  return undefined;
}

/**
 * Extract class name from receiver
 */
function extract_class_from_receiver(receiver: SymbolName): SymbolName | undefined {
  const receiver_str = receiver as string;

  // Handle qualified names (module.Class or module::Class)
  if (receiver_str.includes("::") || receiver_str.includes(".")) {
    const parts = receiver_str.split(/::|\./);
    return parts[parts.length - 1] as SymbolName;
  }

  // Direct class name
  return receiver;
}

/**
 * Find method in class definition
 */
export function find_method_in_class(
  method_name: SymbolName,
  class_def: ClassDefinition,
  context: FileResolutionContext
): MethodDefinition | undefined {
  // Look through the class's methods
  for (const method of class_def.methods) {
    if (method.name === method_name) {
      return method;
    }
  }

  return undefined;
}

/**
 * Trace the type of the receiver to find its class
 */
export function trace_receiver_type(
  receiver: SymbolName,
  call_location: Location,
  context: FileResolutionContext
): ClassDefinition | undefined {
  const { scope_tree, definitions_by_file } = context;

  // Find the scope where the call is made
  const call_scope = find_scope_at_location(scope_tree, call_location);
  if (!call_scope) return undefined;

  // Look for variable definitions in scope
  const var_type = find_variable_type(receiver, call_scope, scope_tree);
  if (!var_type) return undefined;

  // Find the class definition for this type
  return resolve_type_to_class(var_type, call_location.file_path as FilePath, context);
}

/**
 * Find the type of a variable in scope
 */
function find_variable_type(
  var_name: SymbolName,
  scope_id: ScopeId,
  scope_tree: ScopeTree
): SymbolName | undefined {
  // Look up variable definitions in the scope tree
  const symbols = scope_tree.get_symbols_in_scope(scope_id);
  if (!symbols) return undefined;

  // Search for the variable in current and parent scopes
  let current_scope = scope_id;
  while (current_scope) {
    const scope_symbols = scope_tree.get_symbols_in_scope(current_scope);
    if (scope_symbols) {
      for (const [symbol_id, symbol_info] of scope_symbols) {
        // Check if this is a variable definition with the right name
        const symbol_str = symbol_id as string;

        // Parse the symbol to check if it matches the variable name
        // Symbol format might be "variable:varname@file:line:col"
        if (symbol_str.includes(`variable:${var_name as string}`) ||
            symbol_str.includes(`parameter:${var_name as string}`)) {
          // If there's type information stored, extract it
          // This would need to be populated during initial AST analysis
          // For now, return undefined as type tracking is not yet implemented
          return undefined;
        }
      }
    }

    // Move to parent scope
    const scope_node = scope_tree.nodes.get(current_scope);
    current_scope = scope_node?.parent_id || null;
  }

  return undefined;
}

/**
 * Resolve a type name to a class definition
 */
function resolve_type_to_class(
  type_name: SymbolName,
  file_path: FilePath,
  context: FileResolutionContext
): ClassDefinition | undefined {
  // 1. Check local file
  const local_class = find_class_in_file(type_name, file_path, context.definitions_by_file);
  if (local_class) return local_class;

  // 2. Check imports
  return resolve_imported_class(type_name, file_path, context);
}


/**
 * Resolve inherited methods through parent classes
 */
function resolve_inherited_method(
  method_name: SymbolName,
  class_def: ClassDefinition,
  context: FileResolutionContext
): MethodDefinition | undefined {
  // Check parent classes
  if (class_def.extends && class_def.extends.length > 0) {
    for (const parent_name of class_def.extends) {
      // Find parent class definition
      const parent_class = find_parent_class(parent_name, class_def.location.file_path as FilePath, context);
      if (parent_class) {
        // Look for method in parent
        const method = find_method_in_class(method_name, parent_class, context);
        if (method) return method;

        // Recursively check parent's parents
        const inherited = resolve_inherited_method(method_name, parent_class, context);
        if (inherited) return inherited;
      }
    }
  }

  return undefined;
}

/**
 * Resolve imported methods
 */
function resolve_imported_method(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  const { imports_by_file } = context;
  const imports = imports_by_file.get(call.location.file_path as FilePath);
  if (!imports) return undefined;

  // Check if the receiver matches an imported namespace
  for (const imp of imports) {
    if (imp.kind === "namespace") {
      const ns_name = imp.namespace_name as string;
      const receiver_str = call.receiver as string;

      if (ns_name === receiver_str) {
        // This is a namespace method call
        const source_file = resolve_module_to_file(
          imp.source,
          call.location.file_path as FilePath,
          context
        );

        if (source_file) {
          // Look for a class that exports this method
          const file_defs = context.definitions_by_file.get(source_file);
          if (file_defs) {
            for (const [, class_def] of file_defs.classes) {
              const method = find_method_in_class(call.method_name, class_def, context);
              if (method) return method;
            }
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Handle language-specific method resolution patterns
 */
function resolve_language_specific_method(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  const { language } = context;

  switch (language) {
    case "python":
      return resolve_python_specific_method(call, context);
    case "rust":
      return resolve_rust_specific_method(call, context);
    case "javascript":
    case "typescript":
      return resolve_javascript_specific_method(call, context);
    default:
      return undefined;
  }
}

/**
 * Python-specific method resolution
 */
function resolve_python_specific_method(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  // Handle super() calls
  if ((call.receiver as string) === "super()") {
    return resolve_super_method_call(call, context);
  }

  // Handle @classmethod and @staticmethod
  // These would need additional metadata in the AST

  return undefined;
}

/**
 * Rust-specific method resolution
 */
function resolve_rust_specific_method(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  // Handle trait methods
  // Handle associated functions (Type::method())

  const receiver_str = call.receiver as string;
  if (receiver_str.includes("::")) {
    // This is likely Type::method() pattern
    const parts = receiver_str.split("::");
    const type_name = parts[parts.length - 1] as SymbolName;

    const class_def = resolve_type_to_class(
      type_name,
      call.location.file_path as FilePath,
      context
    );

    if (class_def) {
      return find_method_in_class(call.method_name, class_def, context);
    }
  }

  return undefined;
}

/**
 * JavaScript/TypeScript-specific method resolution
 */
function resolve_javascript_specific_method(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  const receiver_str = call.receiver as string;

  // Handle prototype method calls (e.g., MyClass.prototype.method)
  if (receiver_str.includes(".prototype.")) {
    const parts = receiver_str.split(".prototype.");
    const class_name = parts[0] as SymbolName;

    // Find the class definition
    const class_def = find_class_in_file(
      class_name,
      call.location.file_path as FilePath,
      context.definitions_by_file
    );

    if (class_def) {
      return find_method_in_class(call.method_name, class_def, context);
    }
  }

  // Handle constructor function pattern (new MyClass().method())
  // This would require tracking "new" expressions in the AST

  // Handle arrow function methods
  // Handle object literal methods
  // These require more sophisticated AST analysis

  return undefined;
}

/**
 * Resolve super() method calls
 */
function resolve_super_method_call(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  const call_scope = find_scope_at_location(context.scope_tree, call.location);
  if (!call_scope) return undefined;

  // Find containing class
  const class_scope = find_containing_class_scope(call_scope, context.scope_tree);
  if (!class_scope) return undefined;

  const class_def = get_class_from_scope(class_scope, context.definitions_by_file);
  if (!class_def || !class_def.extends || class_def.extends.length === 0) {
    return undefined;
  }

  // Find method in parent class
  const parent_name = class_def.extends[0];
  const parent_class = find_parent_class(
    parent_name,
    class_def.location.file_path as FilePath,
    context
  );

  if (parent_class) {
    return find_method_in_class(call.method_name, parent_class, context);
  }

  return undefined;
}