/**
 * Interface Implementation Feature Dispatcher
 * 
 * Routes interface implementation tracking to language-specific implementations
 * following Architecture.md marshaling pattern.
 */

import { SyntaxNode, Tree } from 'tree-sitter';
import Parser from 'tree-sitter';
import { ClassHierarchy } from '../class_hierarchy/class_hierarchy';
import {
  InterfaceDefinition,
  InterfaceImplementation,
  InterfaceImplementationMap,
  build_interface_implementation_map,
  find_interface_implementations,
  get_interface_implementors,
  get_implemented_interfaces,
  validate_all_implementations
} from './interface_implementation';
import { 
  extract_javascript_interface_definitions,
  find_javascript_interface_implementations
} from './interface_implementation.javascript';
import {
  extract_python_interface_definitions,
  find_python_interface_implementations
} from './interface_implementation.python';
import {
  extract_rust_trait_definitions,
  find_rust_trait_implementations
} from './interface_implementation.rust';

// Re-export core types and functions
export * from './interface_implementation';

/**
 * Language metadata for dispatching
 */
export interface InterfaceMetadata {
  language: string;
  file_path: string;
  tree: Tree;
  parser: Parser;
  source_code: string;
}

/**
 * Extract interface definitions dispatcher
 */
const interface_extractors = {
  javascript: extract_javascript_interface_definitions,
  typescript: extract_javascript_interface_definitions, // Share JavaScript implementation
  python: extract_python_interface_definitions,
  rust: extract_rust_trait_definitions
};

/**
 * Find interface implementations dispatcher
 */
const implementation_finders = {
  javascript: find_javascript_interface_implementations,
  typescript: find_javascript_interface_implementations, // Share JavaScript implementation
  python: find_python_interface_implementations,
  rust: find_rust_trait_implementations
};

/**
 * Extract all interface definitions from a file
 */
export function extract_interfaces(
  metadata: InterfaceMetadata
): InterfaceDefinition[] {
  const extractor = interface_extractors[metadata.language as keyof typeof interface_extractors];
  
  if (!extractor) {
    // No language-specific extractor, return empty array
    return [];
  }
  
  return extractor(
    metadata.tree.rootNode,
    metadata.parser,
    metadata.source_code,
    metadata.file_path
  );
}

/**
 * Find all interface implementations in a file
 */
export function find_implementations(
  metadata: InterfaceMetadata,
  interfaces: InterfaceDefinition[]
): InterfaceImplementation[] {
  const finder = implementation_finders[metadata.language as keyof typeof implementation_finders];
  
  if (!finder) {
    // No language-specific finder, return empty array
    return [];
  }
  
  return finder(
    metadata.tree.rootNode,
    metadata.parser,
    metadata.source_code,
    metadata.file_path,
    interfaces
  );
}

/**
 * Build complete interface implementation map for a codebase
 * 
 * This is the main entry point for analyzing interface implementations
 * across an entire project.
 */
export function build_implementation_map(
  files: InterfaceMetadata[],
  hierarchy: ClassHierarchy,
  class_members: Map<string, { methods: Def[]; properties?: Def[] }>
): InterfaceImplementationMap {
  // Extract all interfaces from all files
  const all_interfaces: InterfaceDefinition[] = [];
  
  for (const file of files) {
    const interfaces = extract_interfaces(file);
    all_interfaces.push(...interfaces);
  }
  
  // Find all implementations
  const all_implementations: InterfaceImplementation[] = [];
  
  for (const file of files) {
    const implementations = find_implementations(file, all_interfaces);
    all_implementations.push(...implementations);
  }
  
  // Build the implementation map using the core function
  return build_interface_implementation_map(
    all_interfaces,
    hierarchy,
    class_members
  );
}

/**
 * Check if a class implements an interface (dispatcher wrapper)
 */
export function class_implements_interface(
  class_def: Def,
  interface_name: string,
  hierarchy: ClassHierarchy
): boolean {
  const class_info = hierarchy.classes.get(class_def.symbol_id);
  if (!class_info) {
    return false;
  }
  
  return class_info.implemented_interfaces.includes(interface_name);
}

/**
 * Get all classes implementing a specific interface
 */
export function get_implementors(
  interface_name: string,
  impl_map: InterfaceImplementationMap
): Def[] {
  return get_interface_implementors(interface_name, impl_map);
}

/**
 * Get all interfaces implemented by a class
 */
export function get_class_interfaces(
  class_name: string,
  impl_map: InterfaceImplementationMap
): InterfaceDefinition[] {
  return get_implemented_interfaces(class_name, impl_map);
}

/**
 * Validate that all interfaces are properly implemented
 */
export function validate_implementations(
  impl_map: InterfaceImplementationMap
): { valid: boolean; errors: string[] } {
  return validate_all_implementations(impl_map);
}