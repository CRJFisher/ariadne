// Helper functions for Rust builder pattern
import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  ModulePath,
  ExportMetadata,
} from "@ariadnejs/types";
import {
  class_symbol,
  function_symbol,
  method_symbol,
  parameter_symbol,
  property_symbol,
  variable_symbol,
  interface_symbol,
  enum_symbol,
  constant_symbol,
  type_alias_symbol,
  module_symbol,
} from "@ariadnejs/types";
import type { CaptureNode } from "../../semantic_index";
export { detect_callback_context } from "./rust_callback_detection";

//
// Symbol ID Creation
//

export function create_struct_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  // Use the parent struct_item node's location, not just the name's location
  // This ensures the ID matches what find_containing_impl generates
  const struct_node = capture.node.parent;
  if (!struct_node) {
    return class_symbol(name, capture.location);
  }

  const location = {
    file_path: capture.location.file_path,
    start_line: struct_node.startPosition.row + 1,
    start_column: struct_node.startPosition.column + 1,
    end_line: struct_node.endPosition.row + 1,
    end_column: struct_node.endPosition.column,
  };
  return class_symbol(name, location);
}

export function create_enum_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return enum_symbol(name, location);
}

export function create_trait_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  // Use the parent trait_item node's location, not just the name's location
  // This ensures the ID matches what find_containing_trait generates
  const trait_node = capture.node.parent;
  if (!trait_node) {
    return interface_symbol(name, capture.location);
  }

  const location = {
    file_path: capture.location.file_path,
    start_line: trait_node.startPosition.row + 1,
    start_column: trait_node.startPosition.column + 1,
    end_line: trait_node.endPosition.row + 1,
    end_column: trait_node.endPosition.column,
  };
  return interface_symbol(name, location);
}

export function create_function_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  // Use the parent function_item node's location, not just the name's location
  // This ensures the ID matches what find_containing_callable generates
  const function_node = capture.node.parent;
  if (!function_node) {
    return function_symbol(name, capture.location);
  }

  const location = {
    file_path: capture.location.file_path,
    start_line: function_node.startPosition.row + 1,
    start_column: function_node.startPosition.column + 1,
    end_line: function_node.endPosition.row + 1,
    end_column: function_node.endPosition.column,
  };
  return function_symbol(name, location);
}

export function create_method_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  // Use the parent function_item node's location, not just the name's location
  // This ensures the ID matches what find_containing_callable generates for methods
  const function_node = capture.node.parent;
  if (!function_node) {
    return method_symbol(name, capture.location);
  }

  const location = {
    file_path: capture.location.file_path,
    start_line: function_node.startPosition.row + 1,
    start_column: function_node.startPosition.column + 1,
    end_line: function_node.endPosition.row + 1,
    end_column: function_node.endPosition.column,
  };
  return method_symbol(name, location);
}

export function create_field_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return property_symbol(name, location);
}

export function create_variable_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return variable_symbol(name, location);
}

export function create_constant_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return constant_symbol(name, location);
}

export function create_parameter_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return parameter_symbol(name, location);
}

export function create_module_id(capture: CaptureNode): SymbolId {
  const location = capture.location;
  return module_symbol(location);
}

export function create_type_alias_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return type_alias_symbol(name, location);
}

//
// Rust-Specific Extractors
//

/**
 * Check if a Rust node has pub visibility modifier
 *
 * Matches the logic in extract_visibility() but returns a simple boolean.
 * Walks up the parent tree for items like fields in structs.
 */
export function has_pub_modifier(node: SyntaxNode): boolean {
  let testNode = node;

  while (testNode) {
    // Check if this node has a visibility_modifier child
    const visibilityNode = testNode.children?.find(
      (child) => child.type === "visibility_modifier"
    );

    if (visibilityNode) {
      // Any form of pub (pub, pub(crate), pub(super), pub(in path)) counts as exported
      return visibilityNode.text.startsWith("pub");
    }

    // Walk up the parent chain for fields/methods that might inherit visibility context
    // Only walk up for specific item types to match extract_visibility behavior
    if (
      testNode.parent &&
      (testNode.parent.type === "struct_item" ||
        testNode.parent.type === "enum_item" ||
        testNode.parent.type === "function_item" ||
        testNode.parent.type === "const_item" ||
        testNode.parent.type === "static_item" ||
        testNode.parent.type === "trait_item" ||
        testNode.parent.type === "type_item" ||
        testNode.parent.type === "mod_item")
    ) {
      testNode = testNode.parent;
    } else {
      break;
    }
  }

  // Default: no pub modifier means not exported
  return false;
}

/**
 * Extract export info for Rust definitions
 */
export function extract_export_info(node: SyntaxNode): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  const has_pub = has_pub_modifier(node);

  return {
    is_exported: has_pub,
    export: undefined, // Rust doesn't have export aliases like JS
  };
}

export function extract_generic_parameters(node: SyntaxNode): SymbolName[] {
  const generics: SymbolName[] = [];
  const typeParams = node.childForFieldName?.("type_parameters");

  if (typeParams) {
    for (const child of typeParams.children || []) {
      if (child.type === "type_identifier" || child.type === "lifetime") {
        generics.push(child.text as SymbolName);
      } else if (child.type === "constrained_type_parameter") {
        const name = child.childForFieldName?.("left");
        if (name) {
          generics.push(name.text as SymbolName);
        }
      } else if (child.type === "optional_type_parameter") {
        const name = child.childForFieldName?.("name");
        if (name) {
          generics.push(name.text as SymbolName);
        }
      }
    }
  }

  return generics;
}

export function extract_lifetime_parameters(node: SyntaxNode): SymbolName[] {
  const lifetimes: SymbolName[] = [];
  const typeParams = node.childForFieldName?.("type_parameters");

  if (typeParams) {
    for (const child of typeParams.children || []) {
      if (child.type === "lifetime") {
        lifetimes.push(child.text as SymbolName);
      }
    }
  }

  return lifetimes;
}

export function extract_trait_bounds(node: SyntaxNode): SymbolName[] {
  const bounds: SymbolName[] = [];
  const whereClause = node.childForFieldName?.("where_clause");

  if (whereClause) {
    for (const child of whereClause.children || []) {
      if (child.type === "where_predicate") {
        const bound = child.childForFieldName?.("bounds");
        if (bound) {
          bounds.push(bound.text as SymbolName);
        }
      }
    }
  }

  // Also check inline bounds in type parameters
  const typeParams = node.childForFieldName?.("type_parameters");
  if (typeParams) {
    for (const child of typeParams.children || []) {
      if (child.type === "constrained_type_parameter") {
        const bound = child.childForFieldName?.("bounds");
        if (bound) {
          bounds.push(bound.text as SymbolName);
        }
      }
    }
  }

  return bounds;
}

export function extract_impl_trait(node: SyntaxNode): SymbolName | undefined {
  // For impl blocks, extract the trait being implemented
  if (node.type === "impl_item") {
    const trait = node.childForFieldName?.("trait");
    if (trait) {
      return trait.text as SymbolName;
    }
  }
  return undefined;
}

export function extract_impl_type(node: SyntaxNode): SymbolName | undefined {
  // For impl blocks, extract the type being implemented for
  if (node.type === "impl_item") {
    const type = node.childForFieldName?.("type");
    if (type) {
      // For generic types like "Container<T>", extract just the base name "Container"
      // The type field might be a generic_type with a type_identifier child
      if (type.type === "generic_type") {
        const typeIdentifier = type.childForFieldName?.("type");
        if (typeIdentifier) {
          return typeIdentifier.text as SymbolName;
        }
      }
      // For non-generic types, check if it's a type_identifier
      if (type.type === "type_identifier") {
        return type.text as SymbolName;
      }
      // Fallback: return the full text
      return type.text as SymbolName;
    }
  }
  return undefined;
}

export function is_async_function(node: SyntaxNode): boolean {
  // Check for async keyword
  return (
    node.children?.some(
      (child) => child.type === "async" || child.text === "async"
    ) || false
  );
}

export function is_const_function(node: SyntaxNode): boolean {
  // Check for const keyword
  return (
    node.children?.some(
      (child) => child.type === "const" || child.text === "const"
    ) || false
  );
}

export function is_unsafe_function(node: SyntaxNode): boolean {
  // Check for unsafe keyword
  return (
    node.children?.some(
      (child) => child.type === "unsafe" || child.text === "unsafe"
    ) || false
  );
}

export function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const returnType = node.childForFieldName?.("return_type");
  if (returnType) {
    // Return the full return type text, cleaned up
    return returnType.text?.replace(/^->\s*/, "").trim() as SymbolName;
  }
  return undefined;
}

export function extract_parameter_type(
  node: SyntaxNode
): SymbolName | undefined {
  const typeNode = node.childForFieldName?.("type");
  if (typeNode) {
    return typeNode.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract type expression from type alias declaration
 *
 * @param node - The type alias name node
 * @returns The type expression text or undefined
 *
 * @example
 * type Kilometers = i32;  // Returns "i32"
 * type Result<T> = std::result::Result<T, Error>;  // Returns "std::result::Result<T, Error>"
 */
export function extract_type_expression(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (!parent || parent.type !== "type_item") {
    return undefined;
  }

  const typeNode = parent.childForFieldName?.("type");
  return typeNode?.text;
}

/**
 * Check if a node has generic type parameters
 *
 * @param node - The node to check (struct_item, enum_item, type_item, function_item, etc.)
 * @returns True if the node has generic parameters
 *
 * @example
 * struct Foo<T> { }  // Returns true
 * struct Bar { }     // Returns false
 */
export function has_generic_parameters(node: SyntaxNode): boolean {
  const typeParams = node.childForFieldName?.("type_parameters");
  return typeParams !== null && typeParams !== undefined;
}

export function is_mutable_parameter(node: SyntaxNode): boolean {
  const pattern = node.childForFieldName?.("pattern");
  if (pattern) {
    return (
      pattern.children?.some(
        (child) => child.type === "mut" || child.text === "mut"
      ) || false
    );
  }
  return false;
}

export function is_self_parameter(node: SyntaxNode): boolean {
  const pattern = node.childForFieldName?.("pattern");
  if (pattern) {
    return (
      pattern.type === "self" ||
      pattern.text === "self" ||
      pattern.text === "&self" ||
      pattern.text === "&mut self"
    );
  }
  return false;
}

export function find_containing_impl(
  capture: CaptureNode
): { struct_name?: SymbolName; trait_name?: SymbolName } | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "impl_item") {
      const implType = extract_impl_type(node);
      const implTrait = extract_impl_trait(node);

      if (implType) {
        const result: { struct_name?: SymbolName; trait_name?: SymbolName } =
          {};

        // Return struct name for lookup (not ID with location)
        result.struct_name = implType as SymbolName;

        // If implementing a trait, return trait name
        if (implTrait) {
          result.trait_name = implTrait as SymbolName;
        }

        return result;
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }

  return undefined;
}

export function find_containing_struct(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "struct_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        // Use the struct_item node's location, not the name's location
        // This matches how create_struct_id generates IDs
        const location = {
          file_path: capture.location.file_path,
          start_line: node.startPosition.row + 1,
          start_column: node.startPosition.column + 1,
          end_line: node.endPosition.row + 1,
          end_column: node.endPosition.column,
        };
        return class_symbol(nameNode.text as SymbolName, location);
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }

  return undefined;
}

export function find_containing_trait(
  capture: CaptureNode
): SymbolName | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "trait_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        // Return trait name for lookup (not ID with location)
        return nameNode.text as SymbolName;
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }

  return undefined;
}

export function extract_enum_variants(node: SyntaxNode): SymbolName[] {
  const variants: SymbolName[] = [];

  // Find the enum_item node if we're at a child
  let enumNode: SyntaxNode | null = node;
  while (enumNode && enumNode.type !== "enum_item") {
    enumNode = enumNode.parent;
  }

  if (!enumNode) {
    return variants;
  }

  // Look for the body field
  for (const child of enumNode.children || []) {
    if (child.type === "enum_variant_list") {
      for (const variant of child.children || []) {
        if (variant.type === "enum_variant") {
          // Get the variant name - it might be a direct child or in a name field
          const nameNode = variant.children?.find(
            (c) => c.type === "identifier"
          );
          if (nameNode) {
            variants.push(nameNode.text as SymbolName);
          }
        }
      }
      break;
    }
  }

  return variants;
}

export function is_associated_function(node: SyntaxNode): boolean {
  // Check if function has self parameter
  const params = node.childForFieldName?.("parameters");

  if (params) {
    for (const child of params.children || []) {
      if (child.type === "self_parameter" || is_self_parameter(child)) {
        return false; // Has self, so it's a method not an associated function
      }
    }
  }

  // No self parameter means it's an associated function (static)
  return true;
}

export function extract_use_path(capture: CaptureNode): ModulePath {
  // For use declarations and extern crate declarations, extract the full path
  let node: SyntaxNode | null = capture.node;

  // Traverse up to find use_declaration or extern_crate_declaration
  while (
    node &&
    node.type !== "use_declaration" &&
    node.type !== "extern_crate_declaration"
  ) {
    node = node.parent;
  }

  if (!node) {
    return capture.text as any as ModulePath;
  }

  // Handle extern crate declarations
  if (node.type === "extern_crate_declaration") {
    // Find the first identifier (the crate name)
    const children = node.children || [];
    for (const child of children) {
      if (child.type === "identifier") {
        return child.text as any as ModulePath;
      }
    }
    return capture.text as any as ModulePath;
  }

  // Handle use declarations
  // Get the argument field which contains the path
  const argument = node.childForFieldName?.("argument");
  if (argument) {
    // Handle different argument types
    if (argument.type === "scoped_identifier") {
      return argument.text as any as ModulePath;
    } else if (argument.type === "identifier") {
      return argument.text as any as ModulePath;
    } else if (argument.type === "use_as_clause") {
      // For aliased imports, get the source path
      const source = argument.children?.find(
        (c) => c.type === "scoped_identifier" || c.type === "identifier"
      );
      return (source?.text || argument.text) as any as ModulePath;
    } else if (argument.type === "scoped_use_list") {
      // For use lists, get the path before the list
      const path = argument.childForFieldName?.("path");
      return (path?.text || "") as any as ModulePath;
    }
  }

  return capture.text as any as ModulePath;
}

export function extract_use_alias(
  capture: CaptureNode
): SymbolName | undefined {
  let node: SyntaxNode | null = capture.node;

  // Traverse up to find use_as_clause or extern_crate_declaration
  while (
    node &&
    node.type !== "use_as_clause" &&
    node.type !== "extern_crate_declaration"
  ) {
    node = node.parent;
  }

  if (!node) return undefined;

  // For extern crate declarations: extern crate foo as bar;
  if (node.type === "extern_crate_declaration") {
    const children = node.children || [];
    let foundAs = false;
    for (const child of children) {
      if (child.text === "as") {
        foundAs = true;
      } else if (foundAs && child.type === "identifier") {
        return child.text as SymbolName;
      }
    }
    return undefined;
  }

  // For use declarations with aliases
  if (node?.type === "use_as_clause") {
    // Find the identifier after "as"
    const children = node.children || [];
    let foundAs = false;
    for (const child of children) {
      if (child.text === "as") {
        foundAs = true;
      } else if (foundAs && child.type === "identifier") {
        return child.text as SymbolName;
      }
    }
  }

  return undefined;
}

export function is_wildcard_import(capture: CaptureNode): boolean {
  let node: SyntaxNode | null = capture.node;

  // Check if parent is use_wildcard
  while (node) {
    if (node.type === "use_wildcard") {
      return true;
    }
    node = node.parent;
  }

  return false;
}

export function find_containing_callable(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node.parent;
  const file_path = capture.location.file_path;

  while (node) {
    // Function items
    if (node.type === "function_item") {
      const nameNode = node.childForFieldName?.("name");
      if (!nameNode) return undefined;

      // Check if this function is inside an impl block or trait
      let ancestor = node.parent;
      while (ancestor) {
        if (ancestor.type === "impl_item" || ancestor.type === "trait_item") {
          // This is a method, not a standalone function
          return method_symbol(nameNode.text as SymbolName, {
            file_path,
            start_line: node.startPosition.row + 1,
            start_column: node.startPosition.column + 1,
            end_line: node.endPosition.row + 1,
            end_column: node.endPosition.column,
          });
        }
        ancestor = ancestor.parent;
      }

      // It's a standalone function
      return function_symbol(nameNode.text as SymbolName, {
        file_path,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column,
      });
    }

    // Check if this is a method in impl block or trait
    if (node.type === "impl_item" || node.type === "trait_item") {
      // The parameter is directly in a method, look for the function_item sibling
      let functionNode: SyntaxNode | null = node;
      while (functionNode && functionNode.type !== "function_item") {
        // Look in children for function_item
        const funcChild = functionNode.children?.find(
          (c) => c.type === "function_item"
        );
        if (funcChild) {
          functionNode = funcChild;
          break;
        }
        // Move to parent
        functionNode = functionNode.parent || null;
      }

      if (functionNode?.type === "function_item") {
        const nameNode = functionNode.childForFieldName?.("name");
        if (!nameNode) return undefined;

        return method_symbol(nameNode.text as SymbolName, {
          file_path,
          start_line: functionNode.startPosition.row + 1,
          start_column: functionNode.startPosition.column + 1,
          end_line: functionNode.endPosition.row + 1,
          end_column: functionNode.endPosition.column,
        });
      }
    }

    // Trait method signatures (function_signature_item in traits)
    if (node.type === "function_signature_item") {
      const nameNode = node.childForFieldName?.("name");
      if (!nameNode) return undefined;

      // Use full function_signature_item node location to match create_method_id
      return method_symbol(nameNode.text as SymbolName, {
        file_path,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column,
      });
    }

    // Closure expressions
    if (node.type === "closure_expression") {
      // Closures don't have names, use location as identifier
      return function_symbol("<closure>" as SymbolName, {
        file_path,
        start_line: node.startPosition.row + 1,
        start_column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column,
      });
    }

    node = node.parent;
  }

  return undefined;
}

//
// Import Extraction from Complete Nodes
//

export interface ImportInfo {
  name: SymbolName;
  module_path?: ModulePath;
  original_name?: SymbolName;
  is_wildcard?: boolean;
}

/**
 * Extract scoped path from scoped_identifier node
 * Traverses the tree to build full path like "std::fmt"
 */
function extract_scoped_path(node: SyntaxNode): string {
  const parts: string[] = [];
  let current: SyntaxNode | null = node;

  while (current && current.type === "scoped_identifier") {
    const name = current.childForFieldName?.("name");
    if (name) parts.unshift(name.text);

    const path = current.childForFieldName?.("path");
    if (path) {
      if (path.type === "scoped_identifier") {
        current = path;
      } else {
        // Base identifier
        parts.unshift(path.text);
        break;
      }
    } else {
      break;
    }
  }

  return parts.join("::");
}

/**
 * Extract imports from complete use_declaration node
 * Handles all use patterns: simple, scoped, aliased, lists, wildcards
 */
export function extract_imports_from_use_declaration(
  node: SyntaxNode
): ImportInfo[] {
  const imports: ImportInfo[] = [];

  if (node.type !== "use_declaration") {
    return imports;
  }

  const argument = node.childForFieldName?.("argument");
  if (!argument) {
    return imports;
  }

  // Handle different use patterns by argument type
  switch (argument.type) {
    case "identifier": {
      // Simple: use foo
      const name = argument.text as SymbolName;
      imports.push({
        name,
        module_path: name as any as ModulePath,
      });
      break;
    }

    case "scoped_identifier": {
      // Scoped: use std::fmt::Display
      const full_path = extract_scoped_path(argument);
      const name = argument.childForFieldName?.("name");
      if (name) {
        imports.push({
          name: name.text as SymbolName,
          module_path: full_path as any as ModulePath,
        });
      }
      break;
    }

    case "use_list": {
      // List: use {Display, Debug}
      for (let i = 0; i < argument.childCount; i++) {
        const item = argument.child(i);
        if (!item) continue;

        if (item.type === "identifier") {
          imports.push({
            name: item.text as SymbolName,
            module_path: item.text as any as ModulePath,
          });
        } else if (item.type === "use_as_clause") {
          const original = item.children?.find(
            (c) => c.type === "identifier" || c.type === "scoped_identifier"
          );
          const alias_parts = item.children || [];
          let alias: SyntaxNode | undefined;
          let found_as = false;
          for (const part of alias_parts) {
            if (part.text === "as") {
              found_as = true;
            } else if (found_as && part.type === "identifier") {
              alias = part;
              break;
            }
          }
          if (original && alias) {
            imports.push({
              name: alias.text as SymbolName,
              module_path: original.text as any as ModulePath,
              original_name: original.text as SymbolName,
            });
          }
        }
      }
      break;
    }

    case "scoped_use_list": {
      // List with path: use std::fmt::{Display, Debug}
      // Also handles nested lists: use std::{cmp::Ordering, collections::{HashMap, HashSet}}
      const path = argument.childForFieldName?.("path");
      const list = argument.childForFieldName?.("list");

      if (path && list) {
        const base_path = path.type === "scoped_identifier"
          ? extract_scoped_path(path)
          : path.text;

        // Process items in the list recursively
        const process_use_list_items = (list_node: SyntaxNode, prefix: string) => {
          for (let i = 0; i < list_node.childCount; i++) {
            const item = list_node.child(i);
            if (!item) continue;

            if (item.type === "identifier") {
              const full_path = `${prefix}::${item.text}`;
              imports.push({
                name: item.text as SymbolName,
                module_path: full_path as any as ModulePath,
              });
            } else if (item.type === "scoped_identifier") {
              const item_path = extract_scoped_path(item);
              const name = item.childForFieldName?.("name");
              if (name) {
                const full_path = `${prefix}::${item_path}`;
                imports.push({
                  name: name.text as SymbolName,
                  module_path: full_path as any as ModulePath,
                });
              }
            } else if (item.type === "scoped_use_list") {
              // Nested list: collections::{HashMap, HashSet}
              const nested_path = item.childForFieldName?.("path");
              const nested_list = item.childForFieldName?.("list");
              if (nested_path && nested_list) {
                const nested_prefix = nested_path.type === "scoped_identifier"
                  ? extract_scoped_path(nested_path)
                  : nested_path.text;
                const full_prefix = `${prefix}::${nested_prefix}`;
                process_use_list_items(nested_list, full_prefix);
              }
            } else if (item.type === "use_as_clause") {
              const original = item.children?.find(
                (c) => c.type === "identifier" || c.type === "scoped_identifier"
              );
              const alias_parts = item.children || [];
              let alias: SyntaxNode | undefined;
              let found_as = false;
              for (const part of alias_parts) {
                if (part.text === "as") {
                  found_as = true;
                } else if (found_as && part.type === "identifier") {
                  alias = part;
                  break;
                }
              }
              if (original && alias) {
                const original_path = original.type === "scoped_identifier"
                  ? extract_scoped_path(original)
                  : original.text;
                const full_path = `${prefix}::${original_path}`;
                const original_name = original.type === "scoped_identifier"
                  ? (original.childForFieldName?.("name")?.text || original_path)
                  : original.text;
                imports.push({
                  name: alias.text as SymbolName,
                  module_path: full_path as any as ModulePath,
                  original_name: full_path as any as SymbolName,
                });
              }
            }
          }
        };

        process_use_list_items(list, base_path);
      }
      break;
    }

    case "use_as_clause": {
      // Alias: use foo as bar or use self::math::add as add_numbers
      const original = argument.children?.find(
        (c) => c.type === "identifier" || c.type === "scoped_identifier"
      );
      const alias_parts = argument.children || [];
      let alias: SyntaxNode | undefined;
      let found_as = false;
      for (const part of alias_parts) {
        if (part.text === "as") {
          found_as = true;
        } else if (found_as && part.type === "identifier") {
          alias = part;
          break;
        }
      }

      if (original && alias) {
        const module_path = original.type === "scoped_identifier"
          ? extract_scoped_path(original)
          : original.text;
        // For aliased imports, original_name should be the full path
        imports.push({
          name: alias.text as SymbolName,
          module_path: module_path as any as ModulePath,
          original_name: module_path as any as SymbolName,
        });
      }
      break;
    }

    case "use_wildcard": {
      // Wildcard: use foo::*
      const path = argument.children?.find(
        (c) => c.type === "scoped_identifier" || c.type === "identifier"
      );
      if (path) {
        const module_path = path.type === "scoped_identifier"
          ? extract_scoped_path(path)
          : path.text;
        imports.push({
          name: "*" as SymbolName,
          module_path: module_path as any as ModulePath,
          is_wildcard: true,
        });
      }
      break;
    }
  }

  return imports;
}

/**
 * Extract import from complete extern_crate_declaration node
 * Handles: extern crate foo; and extern crate foo as bar;
 */
export function extract_import_from_extern_crate(
  node: SyntaxNode
): ImportInfo | undefined {
  if (node.type !== "extern_crate_declaration") {
    return undefined;
  }

  const children = node.children || [];
  let crate_name: string | undefined;
  let alias: string | undefined;
  let found_as = false;

  for (const child of children) {
    if (child.type === "identifier") {
      if (!found_as && !crate_name) {
        crate_name = child.text;
      } else if (found_as) {
        alias = child.text;
        break;
      }
    } else if (child.text === "as") {
      found_as = true;
    }
  }

  if (!crate_name) {
    return undefined;
  }

  return {
    name: (alias || crate_name) as SymbolName,
    module_path: crate_name as any as ModulePath,
    original_name: alias ? (crate_name as SymbolName) : undefined,
  };
}
