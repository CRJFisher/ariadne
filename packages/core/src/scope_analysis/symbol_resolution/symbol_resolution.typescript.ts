/**
 * TypeScript-specific symbol resolution
 * 
 * Handles TypeScript's unique symbol resolution features:
 * - Type-only imports and exports
 * - Namespace imports and ambient declarations
 * - Interface merging
 * - Module augmentation
 * - Generic type parameters
 * - Decorators and metadata
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, Def, Ref, Position } from '@ariadnejs/types';
import {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  find_scope_at_position,
  find_symbol_in_scope_chain,
  get_scope_chain,
  get_visible_symbols
} from '../scope_tree';
import {
  ResolvedSymbol,
  ResolutionContext,
  ImportInfo,
  ExportInfo
} from './symbol_resolution';
import {
  resolve_javascript_symbol,
  extract_es6_imports,
  extract_commonjs_imports,
  extract_es6_exports,
  extract_commonjs_exports,
  resolve_prototype_chain,
  resolve_this_binding,
  JavaScriptResolutionContext
} from './symbol_resolution.javascript';

/**
 * TypeScript-specific resolution context
 */
export interface TypeScriptResolutionContext extends JavaScriptResolutionContext {
  type_parameters?: Map<string, TypeParameterInfo>;
  interfaces?: Map<string, InterfaceInfo[]>;  // Support interface merging
  type_aliases?: Map<string, TypeAliasInfo>;
  namespaces?: Map<string, NamespaceInfo>;
  ambient_declarations?: Map<string, AmbientDeclaration>;
  decorators?: Map<string, DecoratorInfo[]>;
}

/**
 * Type parameter information
 */
export interface TypeParameterInfo {
  name: string;
  constraint?: string;
  default?: string;
  scope_id: string;
}

/**
 * Interface information
 */
export interface InterfaceInfo {
  name: string;
  extends?: string[];
  type_parameters?: string[];
  members: Map<string, InterfaceMember>;
  range: { start: Position; end: Position };
}

/**
 * Interface member
 */
export interface InterfaceMember {
  name: string;
  kind: 'property' | 'method' | 'index' | 'call' | 'construct';
  type?: string;
  optional?: boolean;
  readonly?: boolean;
}

/**
 * Type alias information
 */
export interface TypeAliasInfo {
  name: string;
  type_parameters?: string[];
  type: string;
  range: { start: Position; end: Position };
}

/**
 * Namespace information
 */
export interface NamespaceInfo {
  name: string;
  exports: Map<string, ScopeSymbol>;
  nested_namespaces: Map<string, NamespaceInfo>;
  range: { start: Position; end: Position };
}

/**
 * Ambient declaration
 */
export interface AmbientDeclaration {
  name: string;
  kind: 'module' | 'namespace' | 'global' | 'type';
  members: Map<string, ScopeSymbol>;
}

/**
 * Decorator information
 */
export interface DecoratorInfo {
  name: string;
  arguments?: string[];
  target: string;
}

/**
 * Resolve TypeScript symbol with type-aware resolution
 */
export function resolve_typescript_symbol(
  symbol_name: string,
  scope_id: string,
  context: TypeScriptResolutionContext
): ResolvedSymbol | undefined {
  // Check for type parameters first
  if (context.type_parameters?.has(symbol_name)) {
    const type_param = context.type_parameters.get(symbol_name)!;
    const scope = context.scope_tree.nodes.get(type_param.scope_id);
    if (scope) {
      return {
        symbol: {
          name: symbol_name,
          kind: 'type_parameter',
          range: scope.range
        },
        scope,
        confidence: 'exact'
      };
    }
  }
  
  // Check for namespace access
  if (symbol_name.includes('.')) {
    const namespace_result = resolve_namespace_access(symbol_name, scope_id, context);
    if (namespace_result) return namespace_result;
  }
  
  // Check interfaces (with merging)
  if (context.interfaces?.has(symbol_name)) {
    const interfaces = context.interfaces.get(symbol_name)!;
    // Return the first interface (merged interfaces would be handled by type system)
    const first_interface = interfaces[0];
    return {
      symbol: {
        name: symbol_name,
        kind: 'interface',
        range: first_interface.range
      },
      scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
      confidence: 'exact'
    };
  }
  
  // Check type aliases
  if (context.type_aliases?.has(symbol_name)) {
    const type_alias = context.type_aliases.get(symbol_name)!;
    return {
      symbol: {
        name: symbol_name,
        kind: 'type',
        range: type_alias.range
      },
      scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
      confidence: 'exact'
    };
  }
  
  // Check ambient declarations
  const ambient_result = resolve_from_ambient(symbol_name, context);
  if (ambient_result) return ambient_result;
  
  // Fall back to JavaScript resolution
  return resolve_javascript_symbol(symbol_name, scope_id, context);
}

/**
 * Resolve namespace access (e.g., MyNamespace.MyType)
 */
function resolve_namespace_access(
  qualified_name: string,
  scope_id: string,
  context: TypeScriptResolutionContext
): ResolvedSymbol | undefined {
  const parts = qualified_name.split('.');
  if (parts.length < 2 || !context.namespaces) return undefined;
  
  const namespace_name = parts[0];
  if (!context.namespaces.has(namespace_name)) return undefined;
  
  let current_namespace = context.namespaces.get(namespace_name)!;
  
  // Navigate through nested namespaces
  for (let i = 1; i < parts.length - 1; i++) {
    const nested = current_namespace.nested_namespaces.get(parts[i]);
    if (!nested) return undefined;
    current_namespace = nested;
  }
  
  // Look for the final symbol
  const final_name = parts[parts.length - 1];
  const symbol = current_namespace.exports.get(final_name);
  
  if (symbol) {
    return {
      symbol,
      scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
      confidence: 'exact'
    };
  }
  
  return undefined;
}

/**
 * Resolve from ambient declarations
 */
function resolve_from_ambient(
  symbol_name: string,
  context: TypeScriptResolutionContext
): ResolvedSymbol | undefined {
  if (!context.ambient_declarations) return undefined;
  
  // Check global augmentations
  const global_ambient = context.ambient_declarations.get('global');
  if (global_ambient?.members.has(symbol_name)) {
    const symbol = global_ambient.members.get(symbol_name)!;
    return {
      symbol,
      scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
      confidence: 'exact'
    };
  }
  
  // Check ambient modules
  for (const [module_name, ambient] of context.ambient_declarations) {
    if (ambient.kind === 'module' && ambient.members.has(symbol_name)) {
      const symbol = ambient.members.get(symbol_name)!;
      return {
        symbol,
        scope: context.scope_tree.nodes.get(context.scope_tree.root_id)!,
        confidence: 'exact'
      };
    }
  }
  
  return undefined;
}

/**
 * Extract TypeScript-specific imports
 */
export function extract_typescript_imports(
  root_node: SyntaxNode,
  source_code: string
): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  // Get JavaScript imports first
  imports.push(...extract_es6_imports(root_node, source_code));
  imports.push(...extract_commonjs_imports(root_node, source_code));
  
  // Add TypeScript-specific imports
  const visit = (node: SyntaxNode) => {
    if (node.type === 'import_statement') {
      // Check for type-only imports
      const type_only = check_type_only_import(node, source_code);
      if (type_only) {
        const import_info = extract_type_only_import(node, source_code);
        if (import_info) {
          imports.push(...import_info);
        }
      }
    } else if (node.type === 'import_alias') {
      // import Foo = require('foo')
      const import_info = extract_import_alias(node, source_code);
      if (import_info) imports.push(import_info);
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return imports;
}

/**
 * Check if import is type-only
 */
function check_type_only_import(node: SyntaxNode, source_code: string): boolean {
  for (const child of node.children) {
    if (child.type === 'type' && child.text === 'type') {
      return true;
    }
  }
  return false;
}

/**
 * Extract type-only import
 */
function extract_type_only_import(
  import_node: SyntaxNode,
  source_code: string
): ImportInfo[] | undefined {
  const imports: ImportInfo[] = [];
  
  // Find import clause
  const import_clause = import_node.childForFieldName('import_clause');
  if (!import_clause) return undefined;
  
  // Find source
  const source_node = import_node.childForFieldName('source');
  if (!source_node) return undefined;
  
  const module_path = source_code.substring(source_node.startIndex + 1, source_node.endIndex - 1);
  
  // Process import clause
  for (const child of import_clause.children) {
    if (child.type === 'identifier') {
      // Default import
      imports.push({
        name: source_code.substring(child.startIndex, child.endIndex),
        module_path,
        is_default: true,
        is_type_only: true,
        range: {
          start: { row: import_node.startPosition.row, column: import_node.startPosition.column },
          end: { row: import_node.endPosition.row, column: import_node.endPosition.column }
        }
      });
    } else if (child.type === 'named_imports') {
      // Named imports
      for (const spec of child.children) {
        if (spec.type === 'import_specifier') {
          const name_node = spec.childForFieldName('name');
          const alias_node = spec.childForFieldName('alias');
          
          if (name_node) {
            const source_name = source_code.substring(name_node.startIndex, name_node.endIndex);
            const alias = alias_node ? 
              source_code.substring(alias_node.startIndex, alias_node.endIndex) : 
              source_name;
            
            imports.push({
              name: alias,
              source_name: source_name !== alias ? source_name : undefined,
              module_path,
              is_type_only: true,
              range: {
                start: { row: import_node.startPosition.row, column: import_node.startPosition.column },
                end: { row: import_node.endPosition.row, column: import_node.endPosition.column }
              }
            });
          }
        }
      }
    }
  }
  
  return imports.length > 0 ? imports : undefined;
}

/**
 * Extract import alias (import Foo = require('foo'))
 */
function extract_import_alias(
  node: SyntaxNode,
  source_code: string
): ImportInfo | undefined {
  const name_node = node.childForFieldName('name');
  const source_node = node.childForFieldName('source');
  
  if (name_node && source_node) {
    const name = source_code.substring(name_node.startIndex, name_node.endIndex);
    const module_path = extract_module_path_from_require(source_node, source_code);
    
    if (module_path) {
      return {
        name,
        module_path,
        range: {
          start: { row: node.startPosition.row, column: node.startPosition.column },
          end: { row: node.endPosition.row, column: node.endPosition.column }
        }
      };
    }
  }
  
  return undefined;
}

/**
 * Extract module path from require expression
 */
function extract_module_path_from_require(
  node: SyntaxNode,
  source_code: string
): string | undefined {
  // Look for require('module')
  for (const child of node.children) {
    if (child.type === 'call_expression') {
      const func = child.childForFieldName('function');
      const args = child.childForFieldName('arguments');
      
      if (func?.text === 'require' && args) {
        for (const arg of args.children) {
          if (arg.type === 'string') {
            return arg.text.slice(1, -1);
          }
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Extract TypeScript-specific exports
 */
export function extract_typescript_exports(
  root_node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  // Get JavaScript exports first
  exports.push(...extract_es6_exports(root_node, source_code));
  exports.push(...extract_commonjs_exports(root_node, source_code));
  
  // Add TypeScript-specific exports
  const visit = (node: SyntaxNode) => {
    if (node.type === 'export_statement') {
      // Check for type-only exports
      const type_only = check_type_only_export(node, source_code);
      if (type_only) {
        const export_info = extract_type_only_export(node, source_code);
        if (export_info) {
          exports.push(...export_info);
        }
      }
    } else if (node.type === 'export_assignment') {
      // export = expression
      const export_info = extract_export_assignment(node, source_code);
      if (export_info) exports.push(export_info);
    } else if (node.type === 'ambient_declaration') {
      // declare module exports
      const ambient_exports = extract_ambient_exports(node, source_code);
      exports.push(...ambient_exports);
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(root_node);
  return exports;
}

/**
 * Check if export is type-only
 */
function check_type_only_export(node: SyntaxNode, source_code: string): boolean {
  for (const child of node.children) {
    if (child.type === 'type' && child.text === 'type') {
      return true;
    }
  }
  return false;
}

/**
 * Extract type-only export
 */
function extract_type_only_export(
  export_node: SyntaxNode,
  source_code: string
): ExportInfo[] | undefined {
  const exports: ExportInfo[] = [];
  
  // Process export clause
  for (const child of export_node.children) {
    if (child.type === 'export_clause') {
      for (const spec of child.children) {
        if (spec.type === 'export_specifier') {
          const name_node = spec.childForFieldName('name');
          const alias_node = spec.childForFieldName('alias');
          
          if (name_node) {
            const local_name = source_code.substring(name_node.startIndex, name_node.endIndex);
            const export_name = alias_node ? 
              source_code.substring(alias_node.startIndex, alias_node.endIndex) : 
              local_name;
            
            exports.push({
              name: export_name,
              local_name: local_name !== export_name ? local_name : undefined,
              is_type_only: true,
              range: {
                start: { row: export_node.startPosition.row, column: export_node.startPosition.column },
                end: { row: export_node.endPosition.row, column: export_node.endPosition.column }
              }
            });
          }
        }
      }
    }
  }
  
  return exports.length > 0 ? exports : undefined;
}

/**
 * Extract export assignment (export = expression)
 */
function extract_export_assignment(
  node: SyntaxNode,
  source_code: string
): ExportInfo | undefined {
  return {
    name: 'default',
    is_default: true,
    range: {
      start: { row: node.startPosition.row, column: node.startPosition.column },
      end: { row: node.endPosition.row, column: node.endPosition.column }
    }
  };
}

/**
 * Extract ambient exports
 */
function extract_ambient_exports(
  node: SyntaxNode,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  // Look for exported members in ambient declaration
  const visit = (node: SyntaxNode) => {
    if (node.type === 'export_statement' || 
        (node.parent && node.parent.type === 'ambient_declaration' && 
         node.type.includes('declaration'))) {
      const name_node = node.childForFieldName('name');
      if (name_node) {
        const name = source_code.substring(name_node.startIndex, name_node.endIndex);
        exports.push({
          name,
          range: {
            start: { row: node.startPosition.row, column: node.startPosition.column },
            end: { row: node.endPosition.row, column: node.endPosition.column }
          }
        });
      }
    }
    
    // Continue traversal
    for (const child of node.children) {
      visit(child);
    }
  };
  
  visit(node);
  return exports;
}

/**
 * Find TypeScript decorators for a symbol
 */
export function find_typescript_decorators(
  symbol_name: string,
  scope_id: string,
  context: TypeScriptResolutionContext,
  ast_node: SyntaxNode,
  source_code: string
): DecoratorInfo[] {
  const decorators: DecoratorInfo[] = [];
  
  // Look for decorator nodes
  if (ast_node.previousSibling?.type === 'decorator') {
    let decorator = ast_node.previousSibling;
    while (decorator && decorator.type === 'decorator') {
      const call_expr = decorator.childForFieldName('expression');
      if (call_expr) {
        const name = extract_decorator_name(call_expr, source_code);
        const args = extract_decorator_arguments(call_expr, source_code);
        
        if (name) {
          decorators.push({
            name,
            arguments: args,
            target: symbol_name
          });
        }
      }
      decorator = decorator.previousSibling;
    }
  }
  
  return decorators;
}

/**
 * Extract decorator name
 */
function extract_decorator_name(node: SyntaxNode, source_code: string): string | undefined {
  if (node.type === 'identifier') {
    return source_code.substring(node.startIndex, node.endIndex);
  } else if (node.type === 'call_expression') {
    const func = node.childForFieldName('function');
    if (func) {
      return extract_decorator_name(func, source_code);
    }
  } else if (node.type === 'member_expression') {
    const property = node.childForFieldName('property');
    if (property) {
      return source_code.substring(property.startIndex, property.endIndex);
    }
  }
  return undefined;
}

/**
 * Extract decorator arguments
 */
function extract_decorator_arguments(node: SyntaxNode, source_code: string): string[] {
  const args: string[] = [];
  
  if (node.type === 'call_expression') {
    const args_node = node.childForFieldName('arguments');
    if (args_node) {
      for (const arg of args_node.children) {
        if (arg.type !== '(' && arg.type !== ')' && arg.type !== ',') {
          args.push(source_code.substring(arg.startIndex, arg.endIndex));
        }
      }
    }
  }
  
  return args;
}

/**
 * Get TypeScript symbol kind from AST node
 */
export function get_typescript_symbol_kind(node: SyntaxNode): string {
  switch (node.type) {
    case 'interface_declaration':
      return 'interface';
    case 'type_alias_declaration':
      return 'type';
    case 'enum_declaration':
      return 'enum';
    case 'namespace_declaration':
    case 'module_declaration':
      return 'namespace';
    case 'class_declaration':
      return 'class';
    case 'function_declaration':
    case 'function_signature':
      return 'function';
    case 'method_signature':
      return 'method';
    case 'property_signature':
      return 'property';
    case 'type_parameter':
      return 'type_parameter';
    case 'ambient_declaration':
      return 'ambient';
    default:
      // Fall back to JavaScript kinds
      return 'unknown';
  }
}