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