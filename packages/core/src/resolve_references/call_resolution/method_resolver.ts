/**
 * Method Call Resolution
 *
 * Resolves method calls by:
 * 1. Resolving the receiver object (scope-aware)
 * 2. Determining the receiver's type (from TypeRegistry)
 * 3. Looking up the method on that type
 *
 * Integration points:
 * - Uses ResolutionRegistry for eager receiver resolution
 * - Uses TypeRegistry for type tracking and member lookup
 * - Direct O(1) lookups in pre-resolved data
 *
 * Example resolution flow:
 * ```
 * const user = new User();
 * user.getName();  // ← Resolve this
 * ```
 *
 * Steps:
 * 1. Extract receiver "user" from context
 * 2. Resolve "user" in scope → symbol_id for the variable
 * 3. Get type of "user" → User class symbol_id
 * 4. Look up "getName" in User → User.getName symbol_id
 */

import type {
  LexicalScope,
  SymbolId,
  SymbolName,
  SymbolReference,
} from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope_registry";
import { DefinitionRegistry } from "../registries/definition_registry";
import type { ResolutionRegistry } from "../resolution_registry";
import type { TypeRegistry } from "../registries/type_registry";


/**
 * Resolve a single method call reference
 *
 * Four-step resolution:
 * 1. Resolve receiver symbol (e.g., "user" in user.getName())
 * 2. Check if receiver is namespace import (utils.helper())
 * 3. Get receiver's type (e.g., User class)
 * 4. Look up method/member on type or namespace
 *
 * Returns null if any step fails:
 * - No receiver location in context
 * - Receiver not found in scope
 * - Receiver has no type information and is not a namespace
 * - Type/namespace doesn't have the method/member
 *
 * @param call_ref - Method call reference from semantic index
 * @param scopes - Scope registry (unused, kept for signature compatibility)
 * @param definitions - Definition registry (unused, kept for signature compatibility)
 * @param types - TypeRegistry for type tracking and member lookup
 * @param resolutions - Resolution registry for eager receiver resolution
 * @returns Resolved method symbol_id or null if resolution fails
 */
export function resolve_single_method_call(
  call_ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  // Extract receiver location from context
  // This tells us where the receiver object is in the source
  const receiver_loc = call_ref.context?.receiver_location;
  if (!receiver_loc) {
    // Method call without receiver context - malformed reference
    return null;
  }

  // Step 1: Check for property chain and resolve it
  // For calls like this.definitions.update_file(), we need to walk the chain
  const chain = call_ref.context?.property_chain;

  let receiver_type: SymbolId | null = null;

  if (chain && chain.length > 2) {
    // Multi-step property chain: this.definitions.update_file
    // Use property chain resolution to walk through each step
    receiver_type = resolve_property_chain(
      call_ref,
      scopes,
      definitions,
      types,
      resolutions
    );

    if (!receiver_type) {
      return null;
    }
  } else {
    // Simple method call or namespace import
    // Extract the receiver name (first element of chain or call name)
    const receiver_name = (chain && chain[0]) || call_ref.name;

    // EAGER: O(1) lookup in pre-computed resolution map
    const receiver_symbol = resolutions.resolve(
      call_ref.scope_id,
      receiver_name as SymbolName
    );

    if (!receiver_symbol) {
      // Receiver not found in scope (undefined variable or import)
      return null;
    }

    // Step 2: Check if receiver is a namespace import
    // For expressions like: utils.helper() where utils is import * as utils
    const receiver_def = definitions.get(receiver_symbol);

    if (
      receiver_def &&
      receiver_def.kind === "import" &&
      receiver_def.import_kind === "namespace"
    ) {
      // This is a namespace import! Look up the member in the source file.
      // The import's location has been fixed to point to the source file.
      const source_file = receiver_def.location.file_path;

      // Get all exportable definitions from the source file
      const source_defs = definitions.get_exportable_definitions_in_file(source_file);

      // Find the member by name - it's already filtered to exported definitions
      for (const def of source_defs) {
        if (def.name === call_ref.name) {
          // ExportableDefinition includes only definitions that can be exported
          // Check if it's actually exported (imports don't have is_exported)
          if (def.kind !== "import" && def.is_exported) {
            return def.symbol_id;
          }
        }
      }

      // Member not found in namespace
      return null;
    }

    // Step 3: Get receiver's type from TypeRegistry
    // This uses resolved type_bindings to determine the class/interface of the receiver
    // For associated function calls (Type::function), the receiver IS the type
    receiver_type = types.get_symbol_type(receiver_symbol);

    if (!receiver_type) {
      // Check if receiver_symbol is itself a type (class/interface/enum)
      // This handles associated function calls like Product::new()
      // where "Product" resolves to the class definition
      const receiver_def = definitions.get(receiver_symbol);
      if (
        receiver_def &&
        (receiver_def.kind === "class" ||
          receiver_def.kind === "interface" ||
          receiver_def.kind === "enum" ||
          receiver_def.kind === "type" ||
          receiver_def.kind === "type_alias")
      ) {
        receiver_type = receiver_symbol;
      }
    }

    if (!receiver_type) {
      // Receiver has no type information and is not a type or namespace
      // Could be untyped variable or missing type annotation
      return null;
    }
  }

  // Step 4: Look up method on that type
  // First try the resolved type_members cache
  let method_symbol = types.get_type_member(
    receiver_type,
    call_ref.name
  );

  // If not found in cache, try direct lookup in DefinitionRegistry
  // This is needed because TypeRegistry may not be populated yet during resolution
  if (!method_symbol) {
    const member_index = definitions.get_member_index();
    const type_members = member_index.get(receiver_type);
    if (type_members) {
      method_symbol = type_members.get(call_ref.name) || null;
    }
  }

  return method_symbol;
}

/**
 * Resolve property chain to final receiver type
 *
 * For calls like `this.definitions.update_file()`:
 * - property_chain: ["this", "definitions", "update_file"]
 * - Walk: "this" → get class type → look up "definitions" field → get field type
 * - Returns: DefinitionRegistry type (the type of the definitions field)
 *
 * For simple calls like `user.getName()`:
 * - property_chain: ["user", "getName"]
 * - Walk: "this" → get type
 * - Returns: User type
 *
 * Handles:
 * - `this` keyword resolution
 * - Field access on classes
 * - Namespace imports
 * - Multi-level property chains
 *
 * @param call_ref - Method call reference with property chain
 * @param scopes - Scope registry (unused, kept for compatibility)
 * @param definitions - Definition registry for looking up fields
 * @param types - TypeRegistry for type tracking
 * @param resolutions - Resolution registry for symbol resolution
 * @returns Type symbol_id of the final receiver, or null if resolution fails
 */
function resolve_property_chain(
  call_ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  const chain = call_ref.context?.property_chain;
  if (!chain || chain.length === 0) {
    return null;
  }

  // Walk the property chain from start to second-to-last
  // (last element is the method name we're calling)
  let current_symbol: SymbolId | null = null;
  let current_type: SymbolId | null = null;

  for (let i = 0; i < chain.length - 1; i++) {
    const prop_name = chain[i] as SymbolName;

    if (i === 0) {
      // First element: resolve in scope or handle special keywords
      if (prop_name === "this") {
        // Special handling for "this" keyword
        // Find the containing class/interface scope
        const scope = scopes.get_scope(call_ref.scope_id);
        if (!scope) {
          return null;
        }

        // Walk up the scope chain to find a class scope
        let class_scope: LexicalScope | null = null;
        let current_scope: LexicalScope | undefined = scope;

        while (current_scope) {
          if (current_scope.type === "class") {
            class_scope = current_scope;
            break;
          }

          // Move to parent scope
          if (current_scope.parent_id) {
            current_scope = scopes.get_scope(current_scope.parent_id);
            if (!current_scope) {
              break;
            }
          } else {
            break;
          }
        }

        if (!class_scope) {
          return null;
        }

        // Find the class definition that created this class scope
        // The class definition would be in the parent scope (file scope)
        // and its name should match the class scope's name
        let containing_class_id: SymbolId | null = null;

        if (class_scope.parent_id && class_scope.name) {
          const parent_scope_defs = definitions.get_scope_definitions(class_scope.parent_id);
          if (parent_scope_defs) {
            const class_symbol = parent_scope_defs.get(class_scope.name);
            if (class_symbol) {
              const class_def = definitions.get(class_symbol);
              if (class_def && class_def.kind === "class") {
                containing_class_id = class_symbol;
              }
            }
          }
        }

        if (!containing_class_id) {
          return null;
        }

        // "this" resolves to the class type
        current_symbol = containing_class_id;
        current_type = containing_class_id;
      } else {
        // Regular symbol: resolve in scope
        current_symbol = resolutions.resolve(call_ref.scope_id, prop_name);
        if (!current_symbol) {
          return null;
        }

        // Get the type of the first symbol
        current_type = types.get_symbol_type(current_symbol);

        // Check if it's itself a type (for associated function calls)
        if (!current_type) {
          const def = definitions.get(current_symbol);
          if (def && (def.kind === "class" || def.kind === "interface" ||
                      def.kind === "enum" || def.kind === "type" ||
                      def.kind === "type_alias")) {
            current_type = current_symbol;
          }
        }

        if (!current_type) {
          return null;
        }
      }
    } else {
      // Subsequent elements: look up as member/field on current type
      if (!current_type) {
        return null;
      }

      // Look up the property on the current type
      const member_symbol = types.get_type_member(current_type, prop_name);
      if (!member_symbol) {
        // Try direct lookup in DefinitionRegistry
        const member_index = definitions.get_member_index();
        const type_members = member_index.get(current_type);
        if (!type_members) {
          return null;
        }
        current_symbol = type_members.get(prop_name) || null;
        if (!current_symbol) {
          return null;
        }
      } else {
        current_symbol = member_symbol;
      }

      // Get the type of this member/field
      current_type = types.get_symbol_type(current_symbol);

      // Check if member itself is a type
      if (!current_type) {
        const def = definitions.get(current_symbol);
        if (def && (def.kind === "class" || def.kind === "interface" ||
                    def.kind === "enum" || def.kind === "type" ||
                    def.kind === "type_alias")) {
          current_type = current_symbol;
        }
      }

      if (!current_type) {
        return null;
      }
    }
  }

  return current_type;
}
