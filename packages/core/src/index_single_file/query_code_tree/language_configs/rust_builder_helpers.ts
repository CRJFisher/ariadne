// Helper functions for Rust builder pattern
import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  SymbolAvailability,
  Location,
  ModulePath,
} from "@ariadnejs/types";
import {
  class_symbol,
  function_symbol,
  method_symbol,
  parameter_symbol,
  property_symbol,
  variable_symbol,
  interface_symbol,
  enum_member_symbol,
} from "@ariadnejs/types";
import type { CaptureNode } from "../../semantic_index";

// Re-export enum_member_symbol for use in rust_builder.ts
export { enum_member_symbol };

// ============================================================================
// Additional Symbol Creation Functions (not in @ariadnejs/types yet)
// ============================================================================

function symbol_string(
  kind: string,
  name: SymbolName,
  location: Location
): SymbolId {
  const parts = [
    kind,
    location.file_path,
    location.start_line,
    location.start_column,
    location.end_line,
    location.end_column,
    name,
  ];
  return parts.join(":") as SymbolId;
}

export function enum_symbol(name: string, location: Location): SymbolId {
  return symbol_string("enum", name as SymbolName, location);
}

export function constant_symbol(name: string, location: Location): SymbolId {
  return symbol_string("constant", name as SymbolName, location);
}

export function type_alias_symbol(name: string, location: Location): SymbolId {
  return symbol_string("type_alias", name as SymbolName, location);
}

export function module_symbol(name: string, location: Location): SymbolId {
  return symbol_string("module", name as SymbolName, location);
}

// ============================================================================
// Helper Functions
// ============================================================================

export function extract_location(node: SyntaxNode): Location {
  return {
    file_path: "" as any, // Will be filled by context
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column,
  };
}

// ============================================================================
// Symbol ID Creation
// ============================================================================

export function create_struct_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return class_symbol(name, location);
}

export function create_enum_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return enum_symbol(name, location);
}

export function create_trait_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return interface_symbol(name, location);
}

export function create_function_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return function_symbol(name, location);
}

export function create_method_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
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
  const name = capture.text;
  const location = capture.location;
  return module_symbol(name, location);
}

export function create_type_alias_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return type_alias_symbol(name, location);
}

// ============================================================================
// Rust-Specific Extractors
// ============================================================================

export function extract_visibility(node: SyntaxNode): SymbolAvailability {
  // Find visibility modifier in node or parent
  let testNode = node;

  while (testNode) {
    const visibilityNode = testNode.children?.find(
      (child) => child.type === "visibility_modifier"
    );

    if (visibilityNode) {
      const text = visibilityNode.text;

      if (text === "pub") {
        return { scope: "public" };
      }
      if (text === "pub(crate)") {
        return { scope: "package-internal" };
      }
      if (text === "pub(super)") {
        return { scope: "file-private" }; // Map to closest available scope
      }
      if (text.startsWith("pub(in")) {
        return { scope: "file-private" }; // Map to closest available scope
      }
    }

    // Check parent for visibility (for fields in structs, etc)
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

  // Default to module-private in Rust
  return { scope: "file-private" };
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
    // Skip the -> arrow if present
    const typeNode = returnType.children?.find(
      (child) => child.type !== "->" && child.type !== "type"
    );
    return (typeNode?.text ||
      returnType.text?.replace("->", "").trim()) as SymbolName;
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
): { struct?: SymbolId; trait?: SymbolId } | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "impl_item") {
      const implType = extract_impl_type(node);
      const implTrait = extract_impl_trait(node);

      if (implType) {
        const result: { struct?: SymbolId; trait?: SymbolId } = {};

        // Create struct ID for the type being implemented
        result.struct = class_symbol(implType, extract_location(node));

        // If implementing a trait, add trait ID
        if (implTrait) {
          result.trait = interface_symbol(implTrait, extract_location(node));
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
        return class_symbol(
          nameNode.text as SymbolName,
          extract_location(nameNode)
        );
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

export function find_containing_enum(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "enum_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return enum_symbol(
          nameNode.text as SymbolName,
          extract_location(nameNode)
        );
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
): SymbolId | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "trait_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return interface_symbol(
          nameNode.text as SymbolName,
          extract_location(nameNode)
        );
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

export function find_containing_module(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node;

  while (node) {
    if (node.type === "mod_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return module_symbol(
          nameNode.text as SymbolName,
          extract_location(nameNode)
        );
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

export function extract_struct_fields(node: SyntaxNode): SymbolName[] {
  const fields: SymbolName[] = [];
  const body = node.childForFieldName?.("body");

  if (body) {
    if (body.type === "field_declaration_list") {
      // Named fields
      for (const child of body.children || []) {
        if (child.type === "field_declaration") {
          const nameNode = child.childForFieldName?.("name");
          if (nameNode) {
            fields.push(nameNode.text as SymbolName);
          }
        }
      }
    } else if (body.type === "ordered_field_declaration_list") {
      // Tuple struct fields
      for (const child of body.children || []) {
        if (
          child.type === "type_identifier" ||
          child.type === "primitive_type"
        ) {
          fields.push(`field_${fields.length}` as SymbolName);
        }
      }
    }
  }

  return fields;
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

export function extract_import_path(node: SyntaxNode): ModulePath {
  // Extract path from use declaration
  const path = node.childForFieldName?.("argument");
  if (path) {
    if (path.type === "scoped_identifier" || path.type === "identifier") {
      return path.text as ModulePath;
    }
    // Handle use lists
    if (path.type === "use_list") {
      const parent = path.parent?.childForFieldName?.("path");
      if (parent) {
        return parent.text as ModulePath;
      }
    }
  }
  return "" as ModulePath;
}

export function extract_import_alias(node: SyntaxNode): SymbolName | undefined {
  // Check for 'as' alias
  const alias = node.childForFieldName?.("alias");
  if (alias) {
    return alias.text as SymbolName;
  }
  return undefined;
}

export function extract_use_path(capture: CaptureNode): ModulePath {
  // For use declarations, extract the full path
  let node: SyntaxNode | null = capture.node;

  // Traverse up to find use_declaration
  while (node && node.type !== "use_declaration") {
    node = node.parent;
  }

  if (!node) {
    return capture.text as any as ModulePath;
  }

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
        c => c.type === "scoped_identifier" || c.type === "identifier"
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

export function extract_use_alias(capture: CaptureNode): SymbolName | undefined {
  let node: SyntaxNode | null = capture.node;

  // Traverse up to find use_as_clause
  while (node && node.type !== "use_as_clause") {
    node = node.parent;
  }

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
    // Function items (top-level functions)
    if (node.type === "function_item") {
      const nameNode = node.childForFieldName?.("name");
      if (!nameNode) return undefined;

      return function_symbol(
        nameNode.text as SymbolName,
        {
          file_path,
          start_line: node.startPosition.row + 1,
          start_column: node.startPosition.column + 1,
          end_line: node.endPosition.row + 1,
          end_column: node.endPosition.column + 1,
        }
      );
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

        return method_symbol(
          nameNode.text as SymbolName,
          {
            file_path,
            start_line: functionNode.startPosition.row + 1,
            start_column: functionNode.startPosition.column + 1,
            end_line: functionNode.endPosition.row + 1,
            end_column: functionNode.endPosition.column + 1,
          }
        );
      }
    }

    // Trait method signatures (function_signature_item in traits)
    if (node.type === "function_signature_item") {
      const nameNode = node.childForFieldName?.("name");
      if (!nameNode) return undefined;

      return method_symbol(
        nameNode.text as SymbolName,
        {
          file_path,
          start_line: node.startPosition.row + 1,
          start_column: node.startPosition.column + 1,
          end_line: node.endPosition.row + 1,
          end_column: node.endPosition.column + 1,
        }
      );
    }

    // Closure expressions
    if (node.type === "closure_expression") {
      // Closures don't have names, use location as identifier
      return function_symbol(
        `<closure>` as SymbolName,
        {
          file_path,
          start_line: node.startPosition.row + 1,
          start_column: node.startPosition.column + 1,
          end_line: node.endPosition.row + 1,
          end_column: node.endPosition.column + 1,
        }
      );
    }

    node = node.parent;
  }

  return undefined;
}
