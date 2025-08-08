/**
 * Reference resolution functions for resolving references to their definitions
 * 
 * This module handles the core logic of resolving function and method references,
 * including cross-file resolution, import following, and return type analysis.
 */

import { Def, Ref } from '../../graph';
import { Tree } from 'tree-sitter';
import { TypeDiscovery } from '@ariadnejs/types';
import { LocalTypeTrackerData } from '../type_tracker';
import { NamespaceImportAPI } from '../../import_resolution/namespace_imports';

/**
 * File cache interface
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: any; // ScopeGraph
}

/**
 * Result of resolving a method call
 */
export interface MethodResolutionResult {
  readonly resolved?: Def;
  readonly typeDiscoveries: readonly TypeDiscovery[];
}

/**
 * Configuration for reference resolution
 * 
 * Note: get_imports_with_definitions should ideally be replaced with
 * direct ImportResolver usage to avoid callback complexity
 */
export interface ReferenceResolutionConfig {
  readonly file_path: string;
  readonly fileCache: FileCache;
  readonly go_to_definition: (file_path: string, position: { row: number; column: number }) => Def | undefined;
  readonly get_imports_with_definitions: (file_path: string) => Array<{
    import_statement: any; // Import
    local_name: string;
    imported_function: Def;
  }>;
  readonly get_file_graph?: (file_path: string) => any; // ScopeGraph | undefined
  readonly resolve_method_call?: (ref: Ref, objName: string) => MethodResolutionResult;
  readonly resolve_method_on_type?: (ref: Ref, typeName: string) => Def | undefined;
}

/**
 * Resolve a reference to its definition
 * 
 * This function handles:
 * - Direct function references
 * - Method calls on objects
 * - Static method calls (Type::method in Rust)
 * - Chained method calls
 * - Import resolution
 * 
 * @returns The resolved definition and any type discoveries made during resolution
 */
export function resolve_reference(
  ref: Ref,
  def: Def,
  config: ReferenceResolutionConfig,
  localTypeTracker: LocalTypeTrackerData
): MethodResolutionResult {
  const typeDiscoveries: TypeDiscovery[] = [];
  let resolved = config.go_to_definition(def.file_path, ref.range.start);
  
  // If we can't resolve a method reference directly, check if it's a method call
  if (!resolved && (ref.symbol_kind === 'method' || is_likely_method(ref.name))) {
    const astNode = config.fileCache.tree.rootNode.descendantForPosition(
      { row: ref.range.start.row, column: ref.range.start.column },
      { row: ref.range.end.row, column: ref.range.end.column }
    );
    
    const parentNode = astNode?.parent;
    
    if (parentNode && is_method_call_node(parentNode)) {
      // Handle Rust Type::method() pattern
      if (parentNode.type === 'scoped_identifier') {
        resolved = resolve_rust_static_method(ref, parentNode, def, config);
      } 
      // Handle instance.method() patterns
      else {
        const result = resolve_instance_method(ref, parentNode, def, config, localTypeTracker);
        resolved = result.resolved;
        typeDiscoveries.push(...result.typeDiscoveries);
      }
    }
  }
  
  // Resolve imports if needed
  if (resolved && resolved.symbol_kind === 'import') {
    resolved = follow_import(resolved, def.file_path, config);
  }
  
  return { resolved, typeDiscoveries };
}

/**
 * Resolve the return type of a call expression
 * 
 * This function analyzes a call expression AST node to determine what type
 * it returns. This is essential for method chaining.
 */
export function resolve_call_return_type(
  callNode: any,
  contextDef: Def,
  config: ReferenceResolutionConfig,
  localTypeTracker: LocalTypeTrackerData
): string | undefined {
  // Get the function being called
  const funcNode = callNode.childForFieldName('function');
  if (!funcNode) return undefined;
  
  // Handle method calls: obj.method()
  if (is_method_expression_node(funcNode)) {
    const propertyNode = funcNode.childForFieldName('property') || 
                        funcNode.childForFieldName('field') ||
                        funcNode.child(funcNode.childCount - 1);
    
    if (propertyNode) {
      // Create a ref-like object for the method
      const methodRef: Ref = {
        id: -1,
        kind: 'reference',
        name: propertyNode.text,
        symbol_kind: 'method',
        range: {
          start: { 
            row: propertyNode.startPosition.row, 
            column: propertyNode.startPosition.column 
          },
          end: { 
            row: propertyNode.endPosition.row, 
            column: propertyNode.endPosition.column 
          }
        }
      };
      
      // Resolve the method recursively
      const result = resolve_reference(methodRef, contextDef, config, localTypeTracker);
      if (result.resolved && result.resolved.return_type) {
        return result.resolved.return_type;
      }
    }
  }
  
  // Handle direct function calls: func()
  else if (funcNode.type === 'identifier') {
    const funcDef = config.go_to_definition(contextDef.file_path, {
      row: funcNode.startPosition.row,
      column: funcNode.startPosition.column
    });
    
    if (funcDef && funcDef.return_type) {
      return funcDef.return_type;
    }
  }
  
  return undefined;
}

// Helper functions

function is_likely_method(name: string): boolean {
  // Common method names that might not be tagged as methods
  return name === 'insert_global_def' || name === 'insert_local_def';
}

function is_method_call_node(node: any): boolean {
  return node.type === 'member_expression' || 
         node.type === 'attribute' || 
         node.type === 'field_expression' || 
         node.type === 'scoped_identifier';
}

function is_method_expression_node(node: any): boolean {
  return node.type === 'member_expression' || 
         node.type === 'field_expression' ||
         node.type === 'attribute';
}

function resolve_rust_static_method(
  ref: Ref,
  parentNode: any,
  def: Def,
  config: ReferenceResolutionConfig
): Def | undefined {
  const typeName = parentNode.childForFieldName('path')?.text || parentNode.children[0]?.text;
  if (!typeName) return undefined;
  
  const imports = config.get_imports_with_definitions(def.file_path);
  const importInfo = imports.find(imp => imp.import_statement.name === typeName);
  
  if (importInfo && importInfo.imported_function && config.get_file_graph) {
    const targetGraph = config.get_file_graph(importInfo.imported_function.file_path);
    if (targetGraph) {
      const defs = targetGraph.getNodes('definition') as Def[];
      const method = defs.find((d: Def) => 
        d.name === ref.name && 
        (d.symbol_kind === 'method' || d.symbol_kind === 'function')
      );
      
      if (method) {
        return method;
      }
    }
  }
  
  return undefined;
}

function resolve_instance_method(
  ref: Ref,
  parentNode: any,
  def: Def,
  config: ReferenceResolutionConfig,
  localTypeTracker: LocalTypeTrackerData
): MethodResolutionResult {
  const typeDiscoveries: TypeDiscovery[] = [];
  let resolved: Def | undefined;
  
  const objectNode = parentNode.childForFieldName('object') || 
                    parentNode.childForFieldName('value') ||
                    (parentNode.type === 'attribute' ? parentNode.children[0] : null);
  
  if (objectNode) {
    if (objectNode.type === 'identifier') {
      // Handle simple case: obj.method()
      const objName = objectNode.text;
      
      // First check if this is a namespace import
      const namespaceResolution = NamespaceImportAPI.resolveNamespaceMember(
        objName,
        ref,
        def,
        {
          get_file_graph: config.get_file_graph,
          get_imports_with_definitions: config.get_imports_with_definitions,
          debug: !!process.env.DEBUG_NAMESPACE
        }
      );
      if (namespaceResolution) {
        resolved = namespaceResolution;
      } else if (config.resolve_method_call) {
        const methodResult = config.resolve_method_call(ref, objName);
        resolved = methodResult.resolved;
        typeDiscoveries.push(...methodResult.typeDiscoveries);
      }
    } else if (objectNode.type === 'call_expression') {
      // Handle chained case: obj.getInner().method()
      const returnType = resolve_call_return_type(objectNode, def, config, localTypeTracker);
      if (returnType && config.resolve_method_on_type) {
        resolved = config.resolve_method_on_type(ref, returnType);
      }
    } else if (is_method_expression_node(objectNode)) {
      // Handle nested namespace access: namespace.submodule.method()
      const nestedNamespaceResolution = resolve_nested_namespace_member(objectNode, ref, def, config);
      if (nestedNamespaceResolution) {
        resolved = nestedNamespaceResolution;
      }
    }
  }
  
  return { resolved, typeDiscoveries };
}

/**
 * DEPRECATED: Namespace resolution has been moved to import_resolution/namespace_imports
 * 
 * The following functions have been refactored into the new architecture:
 * - resolve_namespace_all_exports -> NamespaceImportAPI.resolveNamespaceExports
 * - resolve_namespace_member -> NamespaceImportAPI.resolveNamespaceMember
 * - resolve_nested_namespace_member -> handled by NamespaceImportAPI
 * 
 * These stub functions remain for backward compatibility during migration.
 */

/**
 * @deprecated Use NamespaceImportAPI.resolveNamespaceExports instead
 */
function resolve_namespace_all_exports(
  targetFile: string,
  config: ReferenceResolutionConfig
): Map<string, any> {
  return NamespaceImportAPI.resolveNamespaceExports(
    targetFile,
    {
      get_file_graph: config.get_file_graph,
      get_imports_with_definitions: config.get_imports_with_definitions,
      debug: !!process.env.DEBUG_NAMESPACE
    }
  );
}

/**
 * @deprecated Use NamespaceImportAPI.resolveNamespaceMember instead
 */
function resolve_namespace_member(
  namespaceName: string,
  memberRef: Ref,
  contextDef: Def,
  config: ReferenceResolutionConfig
): Def | undefined {
  return NamespaceImportAPI.resolveNamespaceMember(
    namespaceName,
    memberRef,
    contextDef,
    {
      get_file_graph: config.get_file_graph,
      get_imports_with_definitions: config.get_imports_with_definitions,
      debug: !!process.env.DEBUG_NAMESPACE
    }
  );
}

/**
 * @deprecated Complex nested namespace resolution moved to NamespaceImportAPI
 * 
 * This function extracts namespace paths from AST nodes and delegates
 * to the new namespace import module for resolution.
 */
function resolve_nested_namespace_member(
  objectNode: any,
  memberRef: Ref,
  contextDef: Def,
  config: ReferenceResolutionConfig
): Def | undefined {
  // Extract the namespace path from the AST node
  const namespacePath: string[] = [];
  let currentNode = objectNode;
  
  while (is_method_expression_node(currentNode)) {
    const propertyNode = currentNode.childForFieldName('property') || 
                        currentNode.childForFieldName('field') ||
                        currentNode.child(currentNode.childCount - 1);
    
    if (propertyNode) {
      namespacePath.unshift(propertyNode.text);
    }
    
    currentNode = currentNode.childForFieldName('object') || 
                  currentNode.childForFieldName('value') ||
                  (currentNode.type === 'attribute' ? currentNode.children[0] : null);
    
    if (!currentNode) break;
  }
  
  // Add the base namespace
  if (currentNode && currentNode.type === 'identifier') {
    namespacePath.unshift(currentNode.text);
  }
  
  if (namespacePath.length < 2) {
    return undefined;
  }
  
  // Use the new API for resolution
  // Note: The new API handles nested namespace resolution internally
  const baseNamespace = namespacePath[0];
  
  // For now, use the simple member resolution
  // TODO: Extend NamespaceImportAPI to handle full path resolution
  return NamespaceImportAPI.resolveNamespaceMember(
    baseNamespace,
    memberRef,
    contextDef,
    {
      get_file_graph: config.get_file_graph,
      get_imports_with_definitions: config.get_imports_with_definitions,
      debug: !!process.env.DEBUG_NAMESPACE
    }
  );
}

function follow_import(
  importDef: Def,
  filePath: string,
  config: ReferenceResolutionConfig
): Def | undefined {
  const imports = config.get_imports_with_definitions(filePath);
  
  // First try exact position match
  let import_info = imports.find(imp => {
    const matches = imp.import_statement.name === importDef.name &&
      imp.import_statement.range.start.row === importDef.range.start.row &&
      imp.import_statement.range.start.column === importDef.range.start.column;
    
    return matches;
  });
  
  // If exact position match fails, try matching by name only
  // This handles cases where go_to_definition returns the import declaration
  // but with a different position (e.g., the position in the import statement)
  if (!import_info) {
    import_info = imports.find(imp => imp.import_statement.name === importDef.name);
  }
  
  if (import_info && import_info.imported_function) {
    return import_info.imported_function;
  }
  
  return importDef;
}