/**
 * Rust-specific class hierarchy extraction
 *
 * Handles Rust type system patterns:
 * - Trait implementations
 * - Associated types
 * - Trait bounds
 * - Deriving traits
 * - Enums and structs
 */

// TODO: Method Override - Build override chains

import { SyntaxNode } from "tree-sitter";
import {
  ClassInfo,
  ClassHierarchyContext,
  extract_class_relationships,
  find_node_at_location,
} from "./class_hierarchy";

/**
 * Extract Rust struct/enum/trait relationships
 */
export function extract_rust_class_relationships(
  info: ClassInfo,
  context: ClassHierarchyContext
): void {
  const type_node = find_node_at_location(
    context.tree.rootNode,
    info.definition.range.start,
    info.definition.range.end
  );

  if (!type_node) {
    return;
  }

  // Find the actual struct/enum/trait definition
  const def_node = find_type_definition(type_node);
  if (!def_node) {
    return;
  }

  const { source_code, tree, file_path } = context;

  // Extract derived traits
  extract_derived_traits(def_node, info, source_code);

  // Find impl blocks for this type
  find_trait_implementations(
    info.definition.name,
    tree.rootNode,
    info,
    source_code
  );

  // For traits, find super traits
  if (def_node.type === "trait_item") {
    extract_super_traits(def_node, info, source_code);
  }
}

/**
 * Find the type definition node
 */
function find_type_definition(node: SyntaxNode): SyntaxNode | null {
  // If we're at an identifier, check parent
  if (node.type === "identifier" || node.type === "type_identifier") {
    const parent = node.parent;
    if (parent && is_type_definition(parent)) {
      return parent;
    }
  }

  // If we're already at a definition
  if (is_type_definition(node)) {
    return node;
  }

  // Search up the tree
  let current = node.parent;
  while (current) {
    if (is_type_definition(current)) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

/**
 * Check if node is a type definition
 */
function is_type_definition(node: SyntaxNode): boolean {
  return (
    node.type === "struct_item" ||
    node.type === "enum_item" ||
    node.type === "trait_item" ||
    node.type === "type_item" ||
    node.type === "union_item"
  );
}

/**
 * Extract derived traits from #[derive(...)]
 */
function extract_derived_traits(
  def_node: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Look for attribute items before the definition
  let prev = def_node.previousSibling;
  while (prev) {
    if (prev.type === "attribute_item") {
      const derived = extract_derive_attribute(prev, source_code);
      for (const trait_name of derived) {
        if (!info.implemented_interfaces.includes(trait_name)) {
          info.implemented_interfaces.push(trait_name);
        }
      }
    }
    prev = prev.previousSibling;
  }
}

/**
 * Extract traits from #[derive(...)] attribute
 */
function extract_derive_attribute(
  attr_node: SyntaxNode,
  source_code: string
): string[] {
  const traits: string[] = [];

  // Find the attribute node (child of attribute_item)
  const attribute = find_child_by_type(attr_node, "attribute");
  if (!attribute) {
    return traits;
  }

  // Check if it's a derive attribute
  // First child should be identifier "derive"
  if (attribute.childCount < 2) {
    return traits;
  }

  const name_node = attribute.child(0);
  if (
    !name_node ||
    name_node.type !== "identifier" ||
    name_node.text !== "derive"
  ) {
    return traits;
  }

  // Second child should be token_tree with arguments
  const args_node = attribute.child(1);
  if (!args_node || args_node.type !== "token_tree") {
    return traits;
  }

  // Parse trait names from token tree
  for (let i = 0; i < args_node.childCount; i++) {
    const child = args_node.child(i);
    if (!child) continue;

    if (child.type === "identifier") {
      traits.push(source_code.substring(child.startIndex, child.endIndex));
    } else if (child.type === "scoped_identifier") {
      // Handle path::Trait
      traits.push(source_code.substring(child.startIndex, child.endIndex));
    }
  }

  return traits;
}

/**
 * Find trait implementations for a type
 */
function find_trait_implementations(
  type_name: string,
  root: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Recursively search for impl blocks
  function search_impl_blocks(node: SyntaxNode): void {
    if (node.type === "impl_item") {
      process_impl_block(node, type_name, info, source_code);
    }

    // Recursively search children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        search_impl_blocks(child);
      }
    }
  }

  search_impl_blocks(root);
}

/**
 * Process an impl block
 */
function process_impl_block(
  impl_node: SyntaxNode,
  target_type: string,
  info: ClassInfo,
  source_code: string
): void {
  // Check if this impl block is for our type
  const type_node = impl_node.childForFieldName("type");
  if (!type_node) {
    return;
  }

  const impl_type = extract_type_name(type_node, source_code);
  if (impl_type !== target_type) {
    return;
  }

  // Check if implementing a trait
  const trait_node = impl_node.childForFieldName("trait");
  if (trait_node) {
    const trait_name = extract_type_name(trait_node, source_code);
    if (trait_name && !info.implemented_interfaces.includes(trait_name)) {
      info.implemented_interfaces.push(trait_name);
    }
  }
}

/**
 * Extract super traits from trait definition
 */
function extract_super_traits(
  trait_node: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Look for trait bounds
  const bounds = trait_node.childForFieldName("bounds");
  if (!bounds || bounds.type !== "trait_bounds") {
    return;
  }

  // Extract each bound
  for (let i = 0; i < bounds.childCount; i++) {
    const child = bounds.child(i);
    if (!child) continue;

    if (child.type === "trait_bound" || child.type === "type_identifier") {
      const trait_name = extract_type_name(child, source_code);
      if (trait_name) {
        // First super trait is parent, rest are interfaces
        if (!info.parent_class) {
          info.parent_class = trait_name;
        } else if (!info.implemented_interfaces.includes(trait_name)) {
          info.implemented_interfaces.push(trait_name);
        }
      }
    }
  }
}

/**
 * Extract type name from node
 */
function extract_type_name(
  node: SyntaxNode,
  source_code: string
): string | null {
  if (node.type === "type_identifier" || node.type === "identifier") {
    return source_code.substring(node.startIndex, node.endIndex);
  }

  if (
    node.type === "scoped_type_identifier" ||
    node.type === "scoped_identifier"
  ) {
    // Return full path for scoped types
    return source_code.substring(node.startIndex, node.endIndex);
  }

  if (node.type === "generic_type") {
    // For generic types, extract base name
    const name = node.childForFieldName("type");
    if (name) {
      return extract_type_name(name, source_code);
    }
  }

  if (node.type === "trait_bound") {
    // Extract type from trait bound
    const type_node =
      find_child_by_type(node, "type_identifier") ||
      find_child_by_type(node, "scoped_type_identifier");
    if (type_node) {
      return extract_type_name(type_node, source_code);
    }
  }

  return null;
}

/**
 * Find child node by type
 */
function find_child_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === type) {
      return child;
    }
  }
  return null;
}

/**
 * Check if type implements a specific trait
 */
export function implements_trait(
  type_name: string,
  trait_name: string,
  root: SyntaxNode,
  source_code: string
): boolean {
  let found = false;

  function search_impl_blocks(node: SyntaxNode): void {
    if (found) return;

    if (node.type === "impl_item") {
      const type_node = node.childForFieldName("type");
      const trait_node = node.childForFieldName("trait");

      if (type_node && trait_node) {
        const impl_type = extract_type_name(type_node, source_code);
        const impl_trait = extract_type_name(trait_node, source_code);

        if (impl_type === type_name && impl_trait === trait_name) {
          found = true;
          return;
        }
      }
    }

    for (let i = 0; i < node.childCount && !found; i++) {
      const child = node.child(i);
      if (child) {
        search_impl_blocks(child);
      }
    }
  }

  search_impl_blocks(root);
  return found;
}

/**
 * Extract associated types from trait
 */
export function extract_associated_types(
  trait_node: SyntaxNode,
  source_code: string
): string[] {
  const associated_types: string[] = [];

  const body = trait_node.childForFieldName("body");
  if (!body) {
    return associated_types;
  }

  for (let i = 0; i < body.childCount; i++) {
    const item = body.child(i);
    if (!item) continue;

    if (item.type === "associated_type") {
      const name = item.childForFieldName("name");
      if (name) {
        const type_name = source_code.substring(name.startIndex, name.endIndex);
        associated_types.push(type_name);
      }
    }
  }

  return associated_types;
}

/**
 * Extract methods from impl block
 */
export function extract_impl_methods(
  impl_node: SyntaxNode,
  source_code: string
): string[] {
  const methods: string[] = [];

  const body = impl_node.childForFieldName("body");
  if (!body) {
    return methods;
  }

  for (let i = 0; i < body.childCount; i++) {
    const item = body.child(i);
    if (!item) continue;

    if (item.type === "function_item") {
      const name = item.childForFieldName("name");
      if (name) {
        const method_name = source_code.substring(
          name.startIndex,
          name.endIndex
        );
        methods.push(method_name);
      }
    }
  }

  return methods;
}

/**
 * Check if struct/enum is generic
 */
export function is_generic_type(def_node: SyntaxNode): boolean {
  const type_params = def_node.childForFieldName("type_parameters");
  return type_params !== null;
}

/**
 * Extract generic parameters
 */
export function extract_generic_parameters(
  def_node: SyntaxNode,
  source_code: string
): string[] {
  const params: string[] = [];

  const type_params = def_node.childForFieldName("type_parameters");
  if (!type_params) {
    return params;
  }

  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (!param) continue;

    if (
      param.type === "type_parameter" ||
      param.type === "lifetime_parameter"
    ) {
      const name = param.childForFieldName("name");
      if (name) {
        params.push(source_code.substring(name.startIndex, name.endIndex));
      }
    }
  }

  return params;
}

/**
 * Check for unsafe impl
 */
export function is_unsafe_impl(impl_node: SyntaxNode): boolean {
  // Check for unsafe keyword
  for (let i = 0; i < impl_node.childCount; i++) {
    const child = impl_node.child(i);
    if (child && child.type === "unsafe" && child.text === "unsafe") {
      return true;
    }
  }
  return false;
}
