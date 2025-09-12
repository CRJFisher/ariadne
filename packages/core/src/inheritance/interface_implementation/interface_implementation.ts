/**
 * Generic Interface Implementation Processor
 * 
 * Configuration-driven processing for interface/trait/protocol detection
 * and implementation tracking across languages.
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, Location, ClassDefinition, ClassHierarchy } from '@ariadnejs/types';
import { 
  InterfaceDefinition,
  InterfaceImplementation,
  MethodSignature,
  PropertySignature,
  ParameterInfo
} from './types';
import { 
  InterfaceImplementationConfig,
  get_interface_config,
  is_member_node
} from './language_configs';

/**
 * Context for generic interface processing
 */
export interface InterfaceProcessingContext {
  language: Language;
  file_path: string;
  source_code: string;
  config: InterfaceImplementationConfig;
}

/**
 * Extract interface definitions using configuration
 */
export function extract_interfaces_generic(
  root_node: SyntaxNode,
  context: InterfaceProcessingContext
): InterfaceDefinition[] {
  const interfaces: InterfaceDefinition[] = [];
  const { config, source_code, file_path, language } = context;
  
  // Traverse AST to find interface nodes
  const traverse = (node: SyntaxNode) => {
    if (config.interface_node_types.includes(node.type)) {
      const interface_def = extract_interface_from_node(node, context);
      if (interface_def) {
        interfaces.push(interface_def);
      }
    }
    
    // Continue traversal
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) traverse(child);
    }
  };
  
  traverse(root_node);
  return interfaces;
}

/**
 * Extract a single interface definition from a node
 */
function extract_interface_from_node(
  node: SyntaxNode,
  context: InterfaceProcessingContext
): InterfaceDefinition | null {
  const { config, source_code, file_path, language } = context;
  
  // Get interface name
  const name_node = node.childForFieldName(config.interface_name_field);
  if (!name_node) return null;
  
  const interface_name = source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // For Python, check if this is actually a Protocol/ABC
  if (language === 'python' && config.special_patterns?.protocol_base_names) {
    const bases_node = node.childForFieldName('superclasses');
    if (!bases_node || !is_protocol_or_abc(bases_node, source_code, config)) {
      return null; // Not a protocol/ABC, skip it
    }
  }
  
  // Get interface body
  const body_node = node.childForFieldName(config.interface_body_field);
  if (!body_node) return null;
  
  // Extract members
  const { methods, properties } = extract_members_from_body(body_node, context);
  
  // Extract extends/base interfaces
  const extends_interfaces = extract_extended_interfaces(node, context);
  
  return {
    name: interface_name,
    location: node_to_location(node, file_path),
    required_methods: methods,
    required_properties: properties.length > 0 ? properties : undefined,
    extends_interfaces,
    language
  };
}

/**
 * Extract members from interface body
 */
function extract_members_from_body(
  body_node: SyntaxNode,
  context: InterfaceProcessingContext
): { methods: MethodSignature[], properties: PropertySignature[] } {
  const methods: MethodSignature[] = [];
  const properties: PropertySignature[] = [];
  const { config, source_code, language } = context;
  
  const traverse = (node: SyntaxNode) => {
    const member_type = is_member_node(node.type, language);
    
    if (member_type === 'method') {
      const method = extract_method_signature(node, context);
      if (method) methods.push(method);
    } else if (member_type === 'property') {
      const property = extract_property_signature(node, context);
      if (property) properties.push(property);
    }
    
    // Continue traversal
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) traverse(child);
    }
  };
  
  traverse(body_node);
  return { methods, properties };
}

/**
 * Extract method signature from node
 */
function extract_method_signature(
  node: SyntaxNode,
  context: InterfaceProcessingContext
): MethodSignature | null {
  const { config, source_code, language } = context;
  
  const name_node = node.childForFieldName(config.member_patterns.name_field);
  if (!name_node) return null;
  
  const method_name = source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Check if abstract (Python)
  const is_abstract = language === 'python' && 
    has_decorator(node, config.special_patterns?.abstract_method_decorator || '', source_code);
  
  // Extract parameters
  const parameters = extract_parameters(node, context);
  
  // Extract return type if available
  const return_type = extract_return_type(node, context);
  
  return {
    name: method_name,
    parameters,
    return_type,
    is_abstract
  };
}

/**
 * Extract property signature from node
 */
function extract_property_signature(
  node: SyntaxNode,
  context: InterfaceProcessingContext
): PropertySignature | null {
  const { config, source_code } = context;
  
  const name_node = node.childForFieldName(config.member_patterns.name_field);
  if (!name_node) return null;
  
  const property_name = source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Extract type if available
  const property_type = extract_type_annotation(node, context);
  
  // Check if readonly/optional
  const is_readonly = check_readonly(node, source_code);
  const is_optional = check_optional(node, source_code);
  
  return {
    name: property_name,
    type: property_type,
    is_readonly,
    is_optional
  };
}

/**
 * Find interface implementations using configuration
 */
export function find_implementations_generic(
  root_node: SyntaxNode,
  interfaces: InterfaceDefinition[],
  context: InterfaceProcessingContext
): InterfaceImplementation[] {
  const implementations: InterfaceImplementation[] = [];
  const { config, source_code, file_path, language } = context;
  
  // Traverse AST to find implementor nodes
  const traverse = (node: SyntaxNode) => {
    if (config.implementation_patterns.implementor_node_types.includes(node.type)) {
      const impls = extract_implementations_from_node(node, interfaces, context);
      implementations.push(...impls);
    }
    
    // Continue traversal
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) traverse(child);
    }
  };
  
  traverse(root_node);
  return implementations;
}

/**
 * Extract implementations from a node
 */
function extract_implementations_from_node(
  node: SyntaxNode,
  interfaces: InterfaceDefinition[],
  context: InterfaceProcessingContext
): InterfaceImplementation[] {
  const implementations: InterfaceImplementation[] = [];
  const { config, source_code, file_path, language } = context;
  
  // Get implementor name
  const name_node = node.childForFieldName(config.implementation_patterns.implementor_name_field);
  if (!name_node) return implementations;
  
  const implementor_name = source_code.substring(name_node.startIndex, name_node.endIndex);
  
  // Find which interfaces are implemented
  const implemented_interfaces = find_implemented_interfaces(node, interfaces, context);
  
  // Get implementor body for member extraction
  const body_node = node.childForFieldName(config.implementation_patterns.implementor_body_field);
  if (!body_node) return implementations;
  
  // Extract implemented members
  const { methods, properties } = extract_members_from_body(body_node, context);
  
  // Create implementation records
  for (const interface_def of implemented_interfaces) {
    const implementation = check_implementation_compliance(
      implementor_name,
      node_to_location(node, file_path),
      interface_def,
      methods,
      properties,
      language
    );
    implementations.push(implementation);
  }
  
  return implementations;
}

/**
 * Find which interfaces are implemented by a node
 */
function find_implemented_interfaces(
  node: SyntaxNode,
  interfaces: InterfaceDefinition[],
  context: InterfaceProcessingContext
): InterfaceDefinition[] {
  const implemented: InterfaceDefinition[] = [];
  const { config, source_code, language } = context;
  
  for (const indicator of config.implementation_patterns.implementation_indicators) {
    if (indicator.type === 'keyword') {
      // TypeScript/JavaScript: implements clause
      // Look for class_heritage child, then implements_clause within it
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === 'class_heritage') {
          // Find implements_clause within class_heritage
          for (let j = 0; j < child.childCount; j++) {
            const heritage_child = child.child(j);
            if (heritage_child && heritage_child.type === 'implements_clause') {
              const interface_names = extract_interface_names(heritage_child, source_code);
              for (const name of interface_names) {
                const interface_def = interfaces.find(i => i.name === name);
                if (interface_def) implemented.push(interface_def);
              }
              break;
            }
          }
          break;
        }
      }
    } else if (indicator.type === 'base_class' && indicator.field_name) {
      // Python: base classes
      const bases_node = node.childForFieldName(indicator.field_name);
      if (bases_node) {
        const base_names = extract_base_class_names(bases_node, source_code);
        for (const name of base_names) {
          const interface_def = interfaces.find(i => i.name === name);
          if (interface_def) implemented.push(interface_def);
        }
      }
    } else if (indicator.type === 'impl_block' && language === 'rust') {
      // Rust: impl Trait for Type
      const trait_node = node.childForFieldName(indicator.trait_field || 'trait');
      if (trait_node) {
        const trait_name = source_code.substring(trait_node.startIndex, trait_node.endIndex);
        const interface_def = interfaces.find(i => i.name === trait_name);
        if (interface_def) implemented.push(interface_def);
      }
    }
  }
  
  return implemented;
}

/**
 * Check implementation compliance
 */
function check_implementation_compliance(
  implementor_name: string,
  implementor_location: Location,
  interface_def: InterfaceDefinition,
  methods: MethodSignature[],
  properties: PropertySignature[],
  language: Language
): InterfaceImplementation {
  const implemented_methods = new Map<string, MethodSignature>();
  const implemented_properties = new Map<string, PropertySignature>();
  const missing_members: string[] = [];
  
  // Check required methods
  for (const required_method of interface_def.required_methods) {
    const impl = methods.find(m => 
      m.name === required_method.name &&
      methods_compatible(m, required_method)
    );
    
    if (impl) {
      implemented_methods.set(required_method.name, impl);
    } else {
      missing_members.push(`method: ${required_method.name}`);
    }
  }
  
  // Check required properties
  if (interface_def.required_properties) {
    for (const required_prop of interface_def.required_properties) {
      const impl = properties.find(p => 
        p.name === required_prop.name &&
        properties_compatible(p, required_prop)
      );
      
      if (impl) {
        implemented_properties.set(required_prop.name, impl);
      } else {
        missing_members.push(`property: ${required_prop.name}`);
      }
    }
  }
  
  return {
    implementor_name,
    implementor_location,
    interface_name: interface_def.name,
    interface_location: interface_def.location,
    implemented_methods,
    implemented_properties: implemented_properties.size > 0 ? implemented_properties : undefined,
    is_complete: missing_members.length === 0,
    missing_members,
    language
  };
}

// Helper functions

function node_to_location(node: SyntaxNode, file_path: string): Location {
  return {
    file_path,
    line: node.startPosition.row + 1,
    column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column
  };
}

function is_protocol_or_abc(
  bases_node: SyntaxNode,
  source_code: string,
  config: InterfaceImplementationConfig
): boolean {
  if (!config.special_patterns?.protocol_base_names) return false;
  
  const bases_text = source_code.substring(bases_node.startIndex, bases_node.endIndex);
  return config.special_patterns.protocol_base_names.some(base => 
    bases_text.includes(base)
  );
}

function has_decorator(node: SyntaxNode, decorator: string, source_code: string): boolean {
  // Look for decorator in parent or preceding sibling
  const parent = node.parent;
  if (!parent) return false;
  
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (child === node) break;
    if (child && child.type === 'decorator') {
      const text = source_code.substring(child.startIndex, child.endIndex);
      if (text.includes(decorator)) return true;
    }
  }
  
  return false;
}

function extract_parameters(node: SyntaxNode, context: InterfaceProcessingContext): ParameterInfo[] {
  const parameters: ParameterInfo[] = [];
  const params_node = node.childForFieldName('parameters');
  
  if (!params_node) return parameters;
  
  for (let i = 0; i < params_node.childCount; i++) {
    const param = params_node.child(i);
    if (param && (param.type === 'parameter' || param.type === 'identifier')) {
      const name_node = param.type === 'parameter' 
        ? param.childForFieldName('name')
        : param;
      
      if (name_node) {
        parameters.push({
          name: context.source_code.substring(name_node.startIndex, name_node.endIndex)
        });
      }
    }
  }
  
  return parameters;
}

function extract_return_type(node: SyntaxNode, context: InterfaceProcessingContext): string | undefined {
  const return_type_node = node.childForFieldName('return_type');
  if (!return_type_node) return undefined;
  
  return context.source_code.substring(return_type_node.startIndex, return_type_node.endIndex);
}

function extract_type_annotation(node: SyntaxNode, context: InterfaceProcessingContext): string | undefined {
  const type_node = node.childForFieldName('type');
  if (!type_node) return undefined;
  
  return context.source_code.substring(type_node.startIndex, type_node.endIndex);
}

function check_readonly(node: SyntaxNode, source_code: string): boolean {
  const text = source_code.substring(node.startIndex, node.endIndex);
  return text.includes('readonly');
}

function check_optional(node: SyntaxNode, source_code: string): boolean {
  const text = source_code.substring(node.startIndex, node.endIndex);
  return text.includes('?');
}

function extract_interface_names(node: SyntaxNode, source_code: string): string[] {
  const names: string[] = [];
  
  const traverse = (n: SyntaxNode) => {
    if (n.type === 'type_identifier' || n.type === 'identifier') {
      names.push(source_code.substring(n.startIndex, n.endIndex));
    }
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) traverse(child);
    }
  };
  
  traverse(node);
  return names;
}

function extract_base_class_names(node: SyntaxNode, source_code: string): string[] {
  const names: string[] = [];
  
  const traverse = (n: SyntaxNode) => {
    if (n.type === 'identifier' || n.type === 'attribute') {
      const text = source_code.substring(n.startIndex, n.endIndex);
      // Skip 'self' and other non-class names
      if (text !== 'self' && !text.startsWith('.')) {
        names.push(text.split('.').pop() || text);
      }
    }
    for (let i = 0; i < n.childCount; i++) {
      const child = n.child(i);
      if (child) traverse(child);
    }
  };
  
  traverse(node);
  return names;
}

function extract_extended_interfaces(node: SyntaxNode, context: InterfaceProcessingContext): string[] {
  const extends_interfaces: string[] = [];
  
  // Look for extends clause (TypeScript/JavaScript)
  // TypeScript uses extends_type_clause as a child node, not a field
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && (child.type === 'extends_type_clause' || child.type === 'extends_clause')) {
      const names = extract_interface_names(child, context.source_code);
      extends_interfaces.push(...names);
      break;
    }
  }
  
  // For Python, check base classes
  if (context.language === 'python') {
    const bases_node = node.childForFieldName('superclasses');
    if (bases_node) {
      const names = extract_base_class_names(bases_node, context.source_code);
      // Filter out Protocol/ABC itself
      const filtered = names.filter(name => 
        !context.config.special_patterns?.protocol_base_names?.includes(name)
      );
      extends_interfaces.push(...filtered);
    }
  }
  
  // For Rust, check trait bounds
  if (context.language === 'rust') {
    const bounds_node = node.childForFieldName('bounds');
    if (bounds_node) {
      const names = extract_interface_names(bounds_node, context.source_code);
      extends_interfaces.push(...names);
    }
  }
  
  return extends_interfaces;
}

function methods_compatible(impl: MethodSignature, req: MethodSignature): boolean {
  // Basic compatibility check
  // TODO: Add more sophisticated type checking
  return impl.name === req.name;
}

function properties_compatible(impl: PropertySignature, req: PropertySignature): boolean {
  // Basic compatibility check
  // TODO: Add more sophisticated type checking
  return impl.name === req.name;
}

/**
 * Track and validate interface implementations for all classes
 *
 * This function ensures that classes properly implement their declared interfaces
 * and tracks the implementation relationships.
 */
export function track_interface_implementations(
  class_definitions: ClassDefinition[],
  hierarchy: ClassHierarchy
): void {
  // The ClassNode already tracks interfaces via the interfaces field
  // This is populated from class_def.implements during hierarchy building
  // For now, we just validate that the data is present

  for (const class_def of class_definitions) {
    if (class_def.implements && class_def.implements.length > 0) {
      const classNode = hierarchy.classes.get(class_def.name);
      if (classNode) {
        // Verify interfaces are properly tracked
        if (!classNode.interfaces || classNode.interfaces.length === 0) {
          console.warn(
            `Class ${class_def.name} implements interfaces but they are not tracked in hierarchy`
          );
        }
      }
    }
  }
}