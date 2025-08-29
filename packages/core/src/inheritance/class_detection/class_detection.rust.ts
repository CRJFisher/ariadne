/**
 * Rust struct detection
 * 
 * Rust doesn't have classes, but has structs with impl blocks
 * that serve a similar purpose.
 */

import { SyntaxNode } from 'tree-sitter';
import { 
  ClassDefinition,
  MethodDefinition,
  PropertyDefinition,
  GenericParameter,
  Location
} from '@ariadnejs/types';
import { ClassDetectionContext } from './index';

/**
 * Find all struct definitions in Rust code
 * 
 * Maps Rust structs to ClassDefinition for consistency
 */
export function find_struct_definitions_rust(
  context: ClassDetectionContext
): ClassDefinition[] {
  const structs = new Map<string, ClassDefinition>();
  const impl_blocks: ImplBlock[] = [];
  
  // First pass: collect struct definitions
  walk_tree(context.ast_root, (node) => {
    if (node.type === 'struct_item') {
      const struct_def = extract_struct_definition(node, context);
      if (struct_def) {
        structs.set(struct_def.name, struct_def);
      }
    }
    
    // Collect impl blocks for second pass
    if (node.type === 'impl_item') {
      const impl_block = extract_impl_block(node, context);
      if (impl_block) {
        impl_blocks.push(impl_block);
      }
    }
  });
  
  // Second pass: merge impl blocks into structs
  for (const impl_block of impl_blocks) {
    const struct_def = structs.get(impl_block.struct_name);
    if (struct_def) {
      // Merge methods from impl block
      const merged_methods = [...struct_def.methods, ...impl_block.methods];
      structs.set(impl_block.struct_name, {
        ...struct_def,
        methods: merged_methods,
        implements: impl_block.trait_name 
          ? [...(struct_def.implements || []), impl_block.trait_name]
          : struct_def.implements
      });
    } else if (impl_block.trait_name) {
      // Trait implementation for external type, skip
    } else {
      // Impl block for a type we haven't seen (maybe from another file)
      // Create a partial definition
      structs.set(impl_block.struct_name, {
        name: impl_block.struct_name,
        location: impl_block.location,
        methods: impl_block.methods,
        properties: [],
        language: 'rust',
        file_path: context.file_path
      });
    }
  }
  
  return Array.from(structs.values());
}

interface ImplBlock {
  struct_name: string;
  trait_name?: string;
  methods: MethodDefinition[];
  location: Location;
}

/**
 * Extract struct definition
 */
function extract_struct_definition(
  node: SyntaxNode,
  context: ClassDetectionContext
): ClassDefinition | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const struct_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Extract generic parameters
  const type_params_node = node.childForFieldName('type_parameters');
  const generics = extract_generic_parameters(type_params_node, context);
  
  // Extract fields (properties)
  const body_node = node.childForFieldName('body');
  const properties = extract_struct_fields(body_node, context);
  
  // Extract derive macros (similar to decorators)
  const decorators = extract_derive_macros(node, context);
  
  return {
    name: struct_name,
    location: node_to_location(node),
    properties,
    methods: [], // Will be populated from impl blocks
    generics,
    decorators,
    language: 'rust',
    file_path: context.file_path
  };
}

/**
 * Extract struct fields
 */
function extract_struct_fields(
  body_node: SyntaxNode | null,
  context: ClassDetectionContext
): PropertyDefinition[] {
  const properties: PropertyDefinition[] = [];
  
  if (!body_node) return properties;
  
  // Regular struct: struct Foo { field: Type }
  if (body_node.type === 'field_declaration_list') {
    for (let i = 0; i < body_node.childCount; i++) {
      const child = body_node.child(i);
      if (!child) continue;
      
      if (child.type === 'field_declaration') {
        const field = extract_field(child, context);
        if (field) {
          properties.push(field);
        }
      }
    }
  }
  // Tuple struct: struct Foo(Type1, Type2)
  else if (body_node.type === 'tuple_struct_pattern') {
    for (let i = 0; i < body_node.childCount; i++) {
      const child = body_node.child(i);
      if (!child) continue;
      
      if (child.type !== '(' && child.type !== ')' && child.type !== ',') {
        properties.push({
          name: `field_${i}`, // Tuple fields don't have names
          type: context.source_code.substring(child.startIndex, child.endIndex),
          location: node_to_location(child),
          is_static: false,
          is_private: false,
          is_protected: false,
          is_readonly: false // Rust fields are mutable by default
        });
      }
    }
  }
  
  return properties;
}

/**
 * Extract single field
 */
function extract_field(
  node: SyntaxNode,
  context: ClassDetectionContext
): PropertyDefinition | null {
  // Check visibility
  let is_public = false;
  const visibility = node.childForFieldName('visibility');
  if (visibility && visibility.text === 'pub') {
    is_public = true;
  }
  
  const name_node = node.childForFieldName('name');
  const type_node = node.childForFieldName('type');
  
  if (!name_node) return null;
  
  const field_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  const field_type = type_node
    ? context.source_code.substring(type_node.startIndex, type_node.endIndex)
    : undefined;
  
  return {
    name: field_name,
    type: field_type,
    location: node_to_location(node),
    is_static: false,
    is_private: !is_public,
    is_protected: false, // Rust doesn't have protected
    is_readonly: false
  };
}

/**
 * Extract impl block
 */
function extract_impl_block(
  node: SyntaxNode,
  context: ClassDetectionContext
): ImplBlock | null {
  // Get the type being implemented for
  const type_node = node.childForFieldName('type');
  if (!type_node) return null;
  
  const struct_name = extract_type_name(type_node, context);
  if (!struct_name) return null;
  
  // Check if it's a trait implementation
  const trait_node = node.childForFieldName('trait');
  const trait_name = trait_node
    ? extract_type_name(trait_node, context)
    : undefined;
  
  // Extract methods
  const body_node = node.childForFieldName('body');
  const methods = extract_impl_methods(body_node, context);
  
  return {
    struct_name,
    trait_name,
    methods,
    location: node_to_location(node)
  };
}

/**
 * Extract methods from impl block
 */
function extract_impl_methods(
  body_node: SyntaxNode | null,
  context: ClassDetectionContext
): MethodDefinition[] {
  const methods: MethodDefinition[] = [];
  
  if (!body_node) return methods;
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    if (child.type === 'function_item') {
      const method = extract_method(child, context);
      if (method) {
        methods.push(method);
      }
    }
    
    // Associated constants
    if (child.type === 'const_item') {
      // Could treat as static property if needed
    }
    
    // Associated types
    if (child.type === 'type_item') {
      // Could track separately if needed
    }
  }
  
  return methods;
}

/**
 * Extract method definition
 */
function extract_method(
  node: SyntaxNode,
  context: ClassDetectionContext
): MethodDefinition | null {
  const name_node = node.childForFieldName('name');
  if (!name_node) return null;
  
  const method_name = context.source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check visibility
  let is_public = true; // Default for impl methods
  const visibility = node.childForFieldName('visibility');
  if (visibility) {
    is_public = visibility.text === 'pub';
  }
  
  // Check if async
  const is_async = node.children.some(c => c.type === 'async');
  
  // Extract parameters
  const params_node = node.childForFieldName('parameters');
  const parameters = extract_parameters(params_node, context);
  
  // Check if it's a static method (no self parameter)
  const is_static = !parameters.some(p => 
    p.name === 'self' || p.name === '&self' || p.name === '&mut self'
  );
  
  // Filter out self from parameters
  const filtered_params = parameters.filter(p => 
    !p.name.includes('self')
  );
  
  // Extract return type
  const return_type_node = node.childForFieldName('return_type');
  const return_type = return_type_node
    ? extract_return_type(return_type_node, context)
    : undefined;
  
  // Extract generic parameters
  const type_params_node = node.childForFieldName('type_parameters');
  const generics = extract_generic_parameters(type_params_node, context);
  
  return {
    name: method_name,
    location: node_to_location(node),
    is_static,
    is_abstract: false, // Rust doesn't have abstract methods
    is_private: !is_public,
    is_protected: false,
    is_constructor: method_name === 'new', // Convention
    is_async,
    parameters: filtered_params,
    return_type,
    generics
  };
}

/**
 * Extract function parameters
 */
function extract_parameters(
  params_node: SyntaxNode | null,
  context: ClassDetectionContext
): ParameterDefinition[] {
  const parameters: ParameterDefinition[] = [];
  
  if (!params_node) return parameters;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const child = params_node.child(i);
    if (!child) continue;
    
    if (child.type === 'parameter') {
      const pattern = child.childForFieldName('pattern');
      const type_node = child.childForFieldName('type');
      
      if (pattern) {
        let param_name = context.source_code.substring(pattern.startIndex, pattern.endIndex);
        
        // Handle self parameters
        if (pattern.type === 'self' || pattern.text === 'self') {
          param_name = 'self';
        } else if (pattern.type === 'reference_pattern') {
          // &self or &mut self
          const ref_child = pattern.child(1);
          if (ref_child && ref_child.text === 'self') {
            param_name = pattern.text || '&self';
          }
        }
        
        parameters.push({
          name: param_name,
          type: type_node
            ? context.source_code.substring(type_node.startIndex, type_node.endIndex)
            : undefined,
          is_optional: false,
          is_rest: false
        });
      }
    } else if (child.type === 'self_parameter') {
      // Handle self, &self, &mut self
      parameters.push({
        name: child.text || 'self',
        is_optional: false,
        is_rest: false
      });
    }
  }
  
  return parameters;
}

/**
 * Extract generic parameters
 */
function extract_generic_parameters(
  type_params_node: SyntaxNode | null,
  context: ClassDetectionContext
): GenericParameter[] | undefined {
  if (!type_params_node) return undefined;
  
  const generics: GenericParameter[] = [];
  
  for (let i = 0; i < type_params_node.childCount; i++) {
    const child = type_params_node.child(i);
    if (!child) continue;
    
    if (child.type === 'type_parameter' || child.type === 'lifetime_parameter') {
      const name = child.childForFieldName('name');
      const bounds = child.childForFieldName('bounds');
      
      if (name) {
        generics.push({
          name: context.source_code.substring(name.startIndex, name.endIndex),
          constraint: bounds
            ? context.source_code.substring(bounds.startIndex, bounds.endIndex)
            : undefined
        });
      }
    } else if (child.type === 'constrained_type_parameter') {
      // T: Trait
      const left = child.childForFieldName('left');
      const right = child.childForFieldName('right');
      
      if (left) {
        generics.push({
          name: context.source_code.substring(left.startIndex, left.endIndex),
          constraint: right
            ? context.source_code.substring(right.startIndex, right.endIndex)
            : undefined
        });
      }
    }
  }
  
  return generics.length > 0 ? generics : undefined;
}

/**
 * Extract return type
 */
function extract_return_type(
  return_node: SyntaxNode,
  context: ClassDetectionContext
): string {
  // Skip the -> arrow
  const type_node = return_node.child(1);
  if (type_node) {
    return context.source_code.substring(type_node.startIndex, type_node.endIndex);
  }
  
  return context.source_code.substring(return_node.startIndex, return_node.endIndex);
}

/**
 * Extract type name from type node
 */
function extract_type_name(
  type_node: SyntaxNode,
  context: ClassDetectionContext
): string | null {
  if (type_node.type === 'type_identifier') {
    return context.source_code.substring(type_node.startIndex, type_node.endIndex);
  }
  
  // Generic type: Type<T>
  if (type_node.type === 'generic_type') {
    const name = type_node.childForFieldName('type');
    if (name) {
      return context.source_code.substring(name.startIndex, name.endIndex);
    }
  }
  
  // Scoped type: module::Type
  if (type_node.type === 'scoped_type_identifier') {
    const name = type_node.childForFieldName('name');
    if (name) {
      return context.source_code.substring(name.startIndex, name.endIndex);
    }
  }
  
  return null;
}

/**
 * Extract derive macros
 */
function extract_derive_macros(
  node: SyntaxNode,
  context: ClassDetectionContext
): string[] | undefined {
  const derives: string[] = [];
  
  // Look for #[derive(...)] attributes
  let sibling = node.previousSibling;
  while (sibling && sibling.type === 'attribute_item') {
    const meta = sibling.childForFieldName('meta');
    if (meta && meta.text?.includes('derive')) {
      // Extract the derived traits
      const args = meta.text.match(/derive\((.*?)\)/);
      if (args && args[1]) {
        const traits = args[1].split(',').map(t => t.trim());
        derives.push(...traits);
      }
    }
    sibling = sibling.previousSibling;
  }
  
  return derives.length > 0 ? derives : undefined;
}

/**
 * Convert node to location
 */
function node_to_location(node: SyntaxNode): Location {
  return {
    row: node.startPosition.row,
    column: node.startPosition.column
  };
}

/**
 * Walk the AST tree
 */
function walk_tree(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}