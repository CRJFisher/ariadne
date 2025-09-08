/**
 * Interface Implementation Feature - Main Entry Point
 * 
 * Combines configuration-driven generic processing with language-specific
 * bespoke handlers for complete interface/trait/protocol analysis.
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, Location } from '@ariadnejs/types';
import {
  InterfaceDefinition,
  InterfaceImplementation,
  InterfaceImplementationMap,
  ImplementationMapResult
} from './types';
import {
  get_interface_config,
  INTERFACE_IMPLEMENTATION_CONTEXT
} from './language_configs';
import {
  extract_interfaces_generic,
  find_implementations_generic,
  InterfaceProcessingContext
} from './interface_implementation.generic';

// Bespoke handlers
import {
  extract_typescript_generics,
  merge_typescript_interfaces,
  extract_heritage_clauses,
  extract_index_signatures,
  extract_construct_signatures
} from './interface_implementation.typescript.bespoke';
import {
  is_runtime_checkable_protocol,
  extract_abc_registrations,
  extract_class_variables,
  extract_special_methods,
  has_subclasshook,
  extract_protocol_generics
} from './interface_implementation.python.bespoke';
import {
  extract_associated_types,
  extract_associated_constants,
  extract_trait_bounds,
  extract_default_implementations,
  extract_supertraits,
  is_unsafe_trait,
  extract_where_clause
} from './interface_implementation.rust.bespoke';

// Re-export types
export * from './types';
export { INTERFACE_IMPLEMENTATION_CONTEXT } from './language_configs';

/**
 * Extract all interface definitions from a file
 */
export function extract_interface_definitions(
  root_node: SyntaxNode,
  language: Language,
  file_path: string,
  source_code: string
): InterfaceDefinition[] {
  const config = get_interface_config(language);
  if (!config) return [];
  
  const context: InterfaceProcessingContext = {
    language,
    file_path,
    source_code,
    config
  };
  
  // Get interfaces from generic processor
  let interfaces = extract_interfaces_generic(root_node, context);
  
  // Apply language-specific enhancements
  switch (language) {
    case 'typescript':
    case 'tsx':
      interfaces = enhance_typescript_interfaces(interfaces, root_node, source_code);
      // Handle declaration merging
      interfaces = merge_typescript_interfaces(interfaces);
      break;
      
    case 'python':
      interfaces = enhance_python_interfaces(interfaces, root_node, source_code);
      break;
      
    case 'rust':
      interfaces = enhance_rust_interfaces(interfaces, root_node, source_code);
      break;
  }
  
  return interfaces;
}

/**
 * Find all interface implementations in a file
 */
export function find_interface_implementations(
  root_node: SyntaxNode,
  language: Language,
  file_path: string,
  source_code: string,
  interfaces: InterfaceDefinition[]
): InterfaceImplementation[] {
  const config = get_interface_config(language);
  if (!config) return [];
  
  const context: InterfaceProcessingContext = {
    language,
    file_path,
    source_code,
    config
  };
  
  // Get implementations from generic processor
  let implementations = find_implementations_generic(root_node, interfaces, context);
  
  // Apply language-specific enhancements
  switch (language) {
    case 'python':
      // Add ABC registrations as implementations
      const registrations = extract_abc_registrations(root_node, source_code);
      implementations = add_abc_registrations(implementations, registrations, interfaces, file_path);
      break;
      
    case 'rust':
      // Filter out negative implementations
      implementations = implementations.filter(impl => {
        // TODO: Check if this is a negative impl
        return true;
      });
      break;
  }
  
  return implementations;
}

/**
 * Build complete interface implementation map
 */
export function build_interface_implementation_map(
  files: { root_node: SyntaxNode; language: Language; file_path: string; source_code: string }[]
): ImplementationMapResult {
  const all_interfaces: InterfaceDefinition[] = [];
  const all_implementations: InterfaceImplementation[] = [];
  
  // Phase 1: Extract all interfaces
  for (const file of files) {
    const interfaces = extract_interface_definitions(
      file.root_node,
      file.language,
      file.file_path,
      file.source_code
    );
    all_interfaces.push(...interfaces);
  }
  
  // Phase 2: Find all implementations
  for (const file of files) {
    const implementations = find_interface_implementations(
      file.root_node,
      file.language,
      file.file_path,
      file.source_code,
      all_interfaces
    );
    all_implementations.push(...implementations);
  }
  
  // Phase 3: Build the map
  const interfaces_map = new Map<string, InterfaceDefinition>();
  const implementations_map = new Map<string, InterfaceImplementation[]>();
  const class_interfaces_map = new Map<string, string[]>();
  const incomplete_implementations: InterfaceImplementation[] = [];
  
  // Index interfaces
  for (const iface of all_interfaces) {
    interfaces_map.set(iface.name, iface);
    implementations_map.set(iface.name, []);
  }
  
  // Index implementations
  for (const impl of all_implementations) {
    // Add to interface's implementation list
    const iface_impls = implementations_map.get(impl.interface_name);
    if (iface_impls) {
      iface_impls.push(impl);
    }
    
    // Add to class's interface list
    const class_ifaces = class_interfaces_map.get(impl.implementor_name) || [];
    class_ifaces.push(impl.interface_name);
    class_interfaces_map.set(impl.implementor_name, class_ifaces);
    
    // Track incomplete implementations
    if (!impl.is_complete) {
      incomplete_implementations.push(impl);
    }
  }
  
  const map: InterfaceImplementationMap = {
    interfaces: interfaces_map,
    implementations: implementations_map,
    class_interfaces: class_interfaces_map,
    incomplete_implementations
  };
  
  // Calculate statistics
  const total_interfaces = interfaces_map.size;
  const total_implementations = all_implementations.length;
  const complete_implementations = all_implementations.filter(i => i.is_complete).length;
  const incomplete = total_implementations - complete_implementations;
  const coverage_percentage = total_implementations > 0 
    ? (complete_implementations / total_implementations) * 100 
    : 0;
  
  return {
    map,
    statistics: {
      total_interfaces,
      total_implementations,
      complete_implementations,
      incomplete_implementations: incomplete,
      coverage_percentage
    }
  };
}

// Enhancement functions for language-specific features

function enhance_typescript_interfaces(
  interfaces: InterfaceDefinition[],
  root_node: SyntaxNode,
  source_code: string
): InterfaceDefinition[] {
  // Find the AST nodes for each interface
  const find_interface_node = (name: string): SyntaxNode | null => {
    const traverse = (node: SyntaxNode): SyntaxNode | null => {
      if (node.type === 'interface_declaration') {
        const name_node = node.childForFieldName('name');
        if (name_node && source_code.substring(name_node.startIndex, name_node.endIndex) === name) {
          return node;
        }
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const result = traverse(child);
          if (result) return result;
        }
      }
      return null;
    };
    return traverse(root_node);
  };
  
  return interfaces.map(iface => {
    const node = find_interface_node(iface.name);
    if (!node) return iface;
    
    const body_node = node.childForFieldName('body');
    if (!body_node) return iface;
    
    // Add generic type parameters
    const generics = extract_typescript_generics(node, source_code);
    
    // Add index signatures
    const index_sigs = extract_index_signatures(body_node, source_code);
    
    // Add construct signatures
    const construct_sigs = extract_construct_signatures(body_node, source_code);
    if (construct_sigs.length > 0) {
      iface.required_methods.push(...construct_sigs);
    }
    
    return {
      ...iface,
      // Add TypeScript-specific metadata if needed
    };
  });
}

function enhance_python_interfaces(
  interfaces: InterfaceDefinition[],
  root_node: SyntaxNode,
  source_code: string
): InterfaceDefinition[] {
  // Find the AST nodes for each interface
  const find_class_node = (name: string): SyntaxNode | null => {
    const traverse = (node: SyntaxNode): SyntaxNode | null => {
      if (node.type === 'class_definition') {
        const name_node = node.childForFieldName('name');
        if (name_node && source_code.substring(name_node.startIndex, name_node.endIndex) === name) {
          return node;
        }
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const result = traverse(child);
          if (result) return result;
        }
      }
      return null;
    };
    return traverse(root_node);
  };
  
  return interfaces.map(iface => {
    const node = find_class_node(iface.name);
    if (!node) return iface;
    
    const body_node = node.childForFieldName('body');
    if (!body_node) return iface;
    
    // Add class variables
    const class_vars = extract_class_variables(body_node, source_code);
    if (class_vars.length > 0) {
      if (!iface.required_properties) {
        iface.required_properties = [];
      }
      iface.required_properties.push(...class_vars);
    }
    
    // Add special methods
    const special_methods = extract_special_methods(body_node, source_code);
    iface.required_methods.push(...special_methods);
    
    // Check for runtime_checkable
    const is_runtime_checkable = is_runtime_checkable_protocol(node, source_code);
    
    // Extract generic type parameters
    const bases_node = node.childForFieldName('superclasses');
    const generics = bases_node ? extract_protocol_generics(bases_node, source_code) : [];
    
    return {
      ...iface,
      // Add Python-specific metadata if needed
    };
  });
}

function enhance_rust_interfaces(
  interfaces: InterfaceDefinition[],
  root_node: SyntaxNode,
  source_code: string
): InterfaceDefinition[] {
  // Find the AST nodes for each interface
  const find_trait_node = (name: string): SyntaxNode | null => {
    const traverse = (node: SyntaxNode): SyntaxNode | null => {
      if (node.type === 'trait_item') {
        const name_node = node.childForFieldName('name');
        if (name_node && source_code.substring(name_node.startIndex, name_node.endIndex) === name) {
          return node;
        }
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const result = traverse(child);
          if (result) return result;
        }
      }
      return null;
    };
    return traverse(root_node);
  };
  
  return interfaces.map(iface => {
    const node = find_trait_node(iface.name);
    if (!node) return iface;
    
    const body_node = node.childForFieldName('body');
    if (!body_node) return iface;
    
    // Add associated types
    const assoc_types = extract_associated_types(body_node, source_code);
    if (assoc_types.length > 0) {
      if (!iface.required_properties) {
        iface.required_properties = [];
      }
      iface.required_properties.push(...assoc_types);
    }
    
    // Add associated constants
    const assoc_constants = extract_associated_constants(body_node, source_code);
    if (assoc_constants.length > 0) {
      if (!iface.required_properties) {
        iface.required_properties = [];
      }
      iface.required_properties.push(...assoc_constants);
    }
    
    // Add default implementations
    const default_impls = extract_default_implementations(body_node, source_code);
    if (default_impls.length > 0) {
      if (!iface.optional_methods) {
        iface.optional_methods = [];
      }
      iface.optional_methods.push(...default_impls);
    }
    
    // Add supertraits
    const supertraits = extract_supertraits(node, source_code);
    iface.extends_interfaces.push(...supertraits);
    
    // Check if unsafe
    const is_unsafe = is_unsafe_trait(node, source_code);
    
    return {
      ...iface,
      // Add Rust-specific metadata if needed
    };
  });
}

function add_abc_registrations(
  implementations: InterfaceImplementation[],
  registrations: { abc_name: string; registered_class: string }[],
  interfaces: InterfaceDefinition[],
  file_path: string
): InterfaceImplementation[] {
  for (const reg of registrations) {
    const iface = interfaces.find(i => i.name === reg.abc_name);
    if (iface) {
      // Create a synthetic implementation for the registration
      implementations.push({
        implementor_name: reg.registered_class,
        implementor_location: {
          file_path,
          line: 0,
          column: 0,
          end_line: 0,
          end_column: 0
        },
        interface_name: iface.name,
        interface_location: iface.location,
        implemented_methods: new Map(), // Registration doesn't require implementation
        is_complete: true, // Registration is considered complete
        missing_members: [],
        language: 'python'
      });
    }
  }
  
  return implementations;
}