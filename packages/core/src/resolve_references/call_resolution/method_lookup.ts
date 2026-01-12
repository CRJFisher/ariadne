/**
 * Method Lookup Module
 *
 * Looks up methods on resolved receiver types. This is Phase 2 of the
 * unified method call resolution architecture.
 *
 * Handles:
 * - Direct method lookup on classes
 * - Polymorphic resolution for interface method calls
 * - Object literal method lookup via FunctionCollection
 * - Namespace export lookup for namespace imports
 */

import type { SymbolId, SymbolName, FilePath } from "@ariadnejs/types";
import { DefinitionRegistry } from "../registries/definition";
import type { ResolutionContext } from "./receiver_resolution";

/**
 * Look up a method on a resolved receiver type
 *
 * Handles multiple receiver kinds:
 * - Regular class/interface: direct member lookup
 * - Interface: polymorphic resolution (all implementations)
 * - Object literal (FunctionCollection): lookup in stored functions
 * - Namespace import: lookup in source file exports
 *
 * @param receiver_type - Resolved receiver type (or symbol for special cases)
 * @param method_name - Name of the method to look up
 * @param context - Resolution context with all registries
 * @returns Array of resolved method symbol_ids (empty if not found)
 */
export function resolve_method_on_type(
  receiver_type: SymbolId,
  method_name: SymbolName,
  context: ResolutionContext
): SymbolId[] {
  const { definitions, types } = context;

  // Check for special receiver types that need different handling
  const receiver_def = definitions.get(receiver_type);

  // Handle namespace imports
  if (receiver_def?.kind === "import" && receiver_def.import_kind === "namespace") {
    // Use the import path resolver if available, otherwise fall back to location
    const source_file = context.resolve_import_path
      ? context.resolve_import_path(receiver_type)
      : undefined;
    if (source_file) {
      return resolve_namespace_method(source_file, method_name, definitions);
    }
    // Fallback: can't resolve without import path resolver
    return [];
  }

  // Handle object literals with FunctionCollection
  const fn_collection = definitions.get_function_collection(receiver_type);
  if (fn_collection) {
    return resolve_collection_method(receiver_type, method_name, definitions, context);
  }

  // Regular type: look up method as a member
  let method_symbol = types.get_type_member(receiver_type, method_name);

  // Fallback to definition registry's member index
  if (!method_symbol) {
    const member_index = definitions.get_member_index();
    const type_members = member_index.get(receiver_type);
    if (type_members) {
      method_symbol = type_members.get(method_name) || null;
    }
  }

  if (!method_symbol) {
    return [];
  }

  // Check if this is a polymorphic call (receiver is an interface)
  if (receiver_def?.kind === "interface") {
    return resolve_polymorphic_method(receiver_type, method_name, definitions);
  }

  // Concrete call: single resolution
  return [method_symbol];
}

/**
 * Resolve a polymorphic method call to all concrete implementations
 *
 * When a method is called on an interface, we need to find all classes
 * that implement it and return their implementations of the method.
 *
 * Handles multi-level inheritance: if A implements I, and B extends A,
 * a call to I.method() will resolve to both A.method() and B.method()
 * (if B overrides it).
 *
 * @param interface_type_id - SymbolId of the interface
 * @param method_name - Name of the method being called
 * @param definitions - Definition registry with type inheritance index
 * @returns Array of SymbolIds for all implementation methods
 */
function resolve_polymorphic_method(
  interface_type_id: SymbolId,
  method_name: SymbolName,
  definitions: DefinitionRegistry
): SymbolId[] {
  // Get ALL types in the inheritance tree (transitive subtypes)
  const all_subtypes = get_transitive_subtypes(interface_type_id, definitions);

  if (all_subtypes.size === 0) {
    return [];
  }

  const implementations: SymbolId[] = [];
  const member_index = definitions.get_member_index();

  // Look up the method in each implementing class (direct or transitive)
  for (const subtype_id of all_subtypes) {
    const subtype_members = member_index.get(subtype_id);
    if (!subtype_members) {
      continue;
    }

    const impl_method_id = subtype_members.get(method_name);
    if (impl_method_id) {
      implementations.push(impl_method_id);
    }
  }

  return implementations;
}

/**
 * Get all transitive subtypes of a type (full inheritance tree)
 *
 * For interface I with:
 *   class A implements I
 *   class B extends A
 *   class C extends B
 *
 * Returns: {A, B, C}
 *
 * @param type_id - Root type to find subtypes for
 * @param definitions - Definition registry with type inheritance index
 * @returns Set of all transitive subtypes
 */
function get_transitive_subtypes(
  type_id: SymbolId,
  definitions: DefinitionRegistry
): Set<SymbolId> {
  const result = new Set<SymbolId>();
  const to_process = [type_id];
  const processed = new Set<SymbolId>();

  while (to_process.length > 0) {
    const current = to_process.pop();
    if (!current || processed.has(current)) {
      continue;
    }
    processed.add(current);

    // Get direct subtypes
    const direct_subtypes = definitions.get_subtypes(current);
    for (const subtype of direct_subtypes) {
      result.add(subtype);
      to_process.push(subtype);
    }
  }

  return result;
}

/**
 * Resolve a method call on a namespace import
 *
 * For `import * as utils from './utils'; utils.helper();`
 * we need to look up `helper` in the exports of `./utils`.
 *
 * @param source_file - The file path of the source module
 * @param method_name - Name of the method/function to look up
 * @param definitions - Definition registry
 * @returns Array with the exported symbol, or empty if not found
 */
function resolve_namespace_method(
  source_file: FilePath,
  method_name: SymbolName,
  definitions: DefinitionRegistry
): SymbolId[] {
  const source_defs = definitions.get_exportable_definitions_in_file(source_file);

  for (const def of source_defs) {
    if (def.name === method_name && def.kind !== "import" && def.is_exported) {
      return [def.symbol_id];
    }
  }

  return [];
}

/**
 * Resolve a method call on an object literal with FunctionCollection
 *
 * For `const HANDLERS = { process() {} }; HANDLERS.process();`
 * we need to look up `process` in the stored functions of the object literal.
 *
 * @param variable_id - SymbolId of the variable holding the object literal
 * @param method_name - Name of the method to look up
 * @param definitions - Definition registry
 * @param context - Resolution context (for resolving stored references)
 * @returns Array with the method symbol, or empty if not found
 */
function resolve_collection_method(
  variable_id: SymbolId,
  method_name: SymbolName,
  definitions: DefinitionRegistry,
  context: ResolutionContext
): SymbolId[] {
  const fn_collection = definitions.get_function_collection(variable_id);
  if (!fn_collection) {
    return [];
  }

  // Check stored_functions (directly defined anonymous functions)
  // These are SymbolIds - we need to match by name from the definition
  for (const stored_fn_id of fn_collection.stored_functions) {
    const fn_def = definitions.get(stored_fn_id);
    if (fn_def && fn_def.name === method_name) {
      return [stored_fn_id];
    }
  }

  // Check stored_references (function references by name)
  // These are SymbolNames - we need to resolve them in the defining scope
  if (fn_collection.stored_references) {
    for (const ref_name of fn_collection.stored_references) {
      if (ref_name === method_name) {
        // The reference name matches - resolve it in the variable's defining scope
        const var_def = definitions.get(variable_id);
        if (var_def) {
          const resolved = context.resolutions.resolve(var_def.defining_scope_id, method_name);
          if (resolved) {
            return [resolved];
          }
        }
      }
    }
  }

  return [];
}
