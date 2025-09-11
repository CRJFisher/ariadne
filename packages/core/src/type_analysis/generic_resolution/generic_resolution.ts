/**
 * Generic type resolution processor
 * 
 * Configuration-driven generic resolution that handles ~60% of generic logic
 * Language-specific features are handled by bespoke modules
 */

import { 
  TypeName, 
  GenericParameter,
  ResolvedGeneric,
  Language,
  FileAnalysis,
  FilePath,
  ClassHierarchy
} from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';
import { getLanguageConfig, isGenericParameter as isGenericParam } from './language_configs';
import { ModuleGraphWithEdges } from '../../import_export/module_graph';
import { TypeRegistry } from '../type_registry';

// TypeScript bespoke handlers
import {
  resolve_typescript_utility_type,
  resolve_typescript_conditional,
  resolve_typescript_mapped_type,
  resolve_typescript_template_literal
} from './generic_resolution.typescript';

// Python bespoke handlers
import {
  extract_python_typevar,
  extract_python_generic_base,
  resolve_python_optional,
  resolve_python_union,
  resolve_python_protocol,
  resolve_python_typeddict
} from './generic_resolution.python';

// Rust bespoke handlers
import {
  extract_rust_lifetimes,
  resolve_rust_associated_type,
  resolve_rust_impl_trait,
  resolve_rust_dyn_trait,
  resolve_rust_reference,
  resolve_rust_tuple,
  strip_rust_lifetimes,
  has_lifetime_parameters
} from './generic_resolution.rust';

/**
 * Context for generic resolution
 */
export interface GenericContext {
  type_parameters: Map<string, GenericParameter>;
  type_arguments: Map<string, TypeName>;
  parent_context?: GenericContext;
  language?: Language;
}

// =============================================================================
// PUBLIC API FUNCTIONS (in call hierarchy order)
// =============================================================================

/**
 * Resolve generics across all files in the codebase
 * This is the main entry point for Layer 7 generic resolution
 */
export async function resolve_generics_across_files(
  analyses: FileAnalysis[],
  type_registry: TypeRegistry,
  class_hierarchy: ClassHierarchy,
  modules: ModuleGraphWithEdges
): Promise<Map<FilePath, ResolvedGeneric[]>> {
  const resolved_generics = new Map<FilePath, ResolvedGeneric[]>();
  
  // Process each file's analysis
  for (const analysis of analyses) {
    const file_generics: ResolvedGeneric[] = [];
    const language = analysis.language;
    
    // Process class generics
    for (const class_info of analysis.classes) {
      if (class_info.generics && class_info.generics.length > 0) {
        const context = create_generic_context(
          class_info.generics.map(tp => ({
            name: tp.name,
            constraint: tp.constraint,
            default: tp.default
          }))
        );
        
        // Add language to context
        (context as any).language = language;
        
        // Process methods that might use these generics
        for (const method of class_info.methods) {
          if (method.return_type) {
            const resolved = resolve_language_generic(
              method.return_type,
              language,
              context,
              type_registry
            );
            file_generics.push(resolved);
          }
          
          // Process parameter types
          for (const param of method.parameters) {
            if (param.type) {
              const resolved = resolve_language_generic(
                param.type,
                language,
                context,
                type_registry
              );
              file_generics.push(resolved);
            }
          }
        }
      }
    }
    
    // Process function generics
    for (const func of analysis.functions) {
      if (func.signature.type_parameters && func.signature.type_parameters.length > 0) {
        const context = create_generic_context(
          func.signature.type_parameters.map(tp => ({
            name: tp.name,
            constraint: tp.constraint,
            default: tp.default
          }))
        );
        
        // Add language to context
        (context as any).language = language;
        
        // Process return type
        if (func.signature.return_type) {
          const resolved = resolve_language_generic(
            func.signature.return_type,
            language,
            context,
            type_registry
          );
          file_generics.push(resolved);
        }
        
        // Process parameter types
        for (const param of func.signature.parameters) {
          if (param.type) {
            const resolved = resolve_language_generic(
              param.type,
              language,
              context,
              type_registry
            );
            file_generics.push(resolved);
          }
        }
      }
    }
    
    // Store resolved generics for this file
    if (file_generics.length > 0) {
      resolved_generics.set(analysis.file_path, file_generics);
    }
  }
  
  return resolved_generics;
}

/**
 * Resolve generic types for a specific language
 * Tries bespoke handlers first, then falls back to configuration-driven resolution
 */
export function resolve_language_generic(
  type_ref: string,
  language: Language,
  context: GenericContext,
  type_registry: TypeRegistry
): ResolvedGeneric {
  // First, perform type parameter substitution
  const substituted_type = substitute_type_parameters(type_ref, context.type_arguments);
  
  // Handle language-specific bespoke features on substituted type
  switch (language) {
    case 'typescript':
      // Try TypeScript utility types
      const ts_utility = resolve_typescript_utility_type(substituted_type, context);
      if (ts_utility) return ts_utility;
      
      // Try conditional types
      const ts_conditional = resolve_typescript_conditional(substituted_type, context);
      if (ts_conditional) return ts_conditional;
      
      // Try mapped types
      const ts_mapped = resolve_typescript_mapped_type(substituted_type, context);
      if (ts_mapped) return ts_mapped;
      
      // Try template literal types
      const ts_template = resolve_typescript_template_literal(substituted_type, context);
      if (ts_template) return ts_template;
      break;
      
    case 'python':
      // Try Python Optional
      const py_optional = resolve_python_optional(substituted_type, context);
      if (py_optional) return py_optional;
      
      // Try Python Union
      const py_union = resolve_python_union(substituted_type, context);
      if (py_union) return py_union;
      
      // Try Python Protocol
      const py_protocol = resolve_python_protocol(substituted_type, context);
      if (py_protocol) return py_protocol;
      
      // Try Python TypedDict
      const py_typeddict = resolve_python_typeddict(substituted_type, context);
      if (py_typeddict) return py_typeddict;
      break;
      
    case 'rust':
      // Try Rust associated types
      const rust_assoc = resolve_rust_associated_type(substituted_type, context);
      if (rust_assoc) return rust_assoc;
      
      // Try impl Trait
      const rust_impl = resolve_rust_impl_trait(substituted_type, context);
      if (rust_impl) return rust_impl;
      
      // Try dyn Trait
      const rust_dyn = resolve_rust_dyn_trait(substituted_type, context);
      if (rust_dyn) return rust_dyn;
      
      // Try references with lifetimes
      const rust_ref = resolve_rust_reference(substituted_type, context);
      if (rust_ref) return rust_ref;
      
      // Try tuple types
      const rust_tuple = resolve_rust_tuple(substituted_type, context);
      if (rust_tuple) return rust_tuple;
      
      // Strip lifetimes for other types
      if (has_lifetime_parameters(substituted_type)) {
        const stripped = strip_rust_lifetimes(substituted_type);
        return resolve_generic_with_config(stripped, context, language);
      }
      break;
  }
  
  // If substitution occurred and no bespoke handler matched, return substituted result
  if (substituted_type !== type_ref) {
    return {
      original_type: type_ref,
      resolved_type: substituted_type,
      type_substitutions: context.type_arguments,
      confidence: 'exact'
    };
  }
  
  // Fall back to configuration-driven resolution
  return resolve_generic_with_config(substituted_type, context, language);
}

/**
 * Resolve generic type with optional language-specific aliasing
 */
export function resolve_generic_with_config(
  type_ref: string,
  context: GenericContext,
  language: Language
): ResolvedGeneric {
  // Just use standard resolution - type aliases are not needed for generic resolution
  return resolve_generic_type(type_ref, context);
}

/**
 * Resolve a generic type reference
 */
export function resolve_generic_type(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric {
  const substitutions = new Map<string, string>();
  
  // Check for TypeScript conditional types first (since they don't have brackets)
  if (type_ref.includes(' extends ') && type_ref.includes('?') && type_ref.includes(':')) {
    const conditionalResult = resolve_typescript_conditional(type_ref, context);
    if (conditionalResult) return conditionalResult;
  }
  
  // Check for Python 3.10+ union syntax (T | U)
  if (type_ref.includes(' | ')) {
    const unionResult = resolve_python_union(type_ref, context);
    if (unionResult) return unionResult;
  }
  
  // Parse type reference (e.g., "Array<T>", "Map<K, V>")
  const parsed = parse_generic_type(type_ref);
  if (!parsed) {
    // Check if this is a simple type parameter (e.g., "T", "U")
    const resolved_param = resolve_type_argument(type_ref, context, substitutions);
    const confidence = resolved_param !== type_ref ? 'exact' : 'partial';
    return {
      original_type: type_ref,
      resolved_type: resolved_param,
      type_substitutions: substitutions,
      confidence
    };
  }
  
  // Resolve type arguments
  const resolved_args: string[] = [];
  for (const arg of parsed.type_arguments) {
    const resolved = resolve_type_argument(arg, context, substitutions);
    resolved_args.push(resolved);
  }
  
  // Reconstruct the type with appropriate brackets
  const uses_square_brackets = type_ref.includes('[');
  const resolved_type = resolved_args.length > 0
    ? uses_square_brackets 
      ? `${parsed.base_type}[${resolved_args.join(', ')}]`
      : `${parsed.base_type}<${resolved_args.join(', ')}>`
    : parsed.base_type;
  
  return {
    original_type: type_ref,
    resolved_type,
    type_substitutions: substitutions,
    confidence: substitutions.size > 0 ? 'exact' : 'partial'
  };
}

/**
 * Parse a generic type reference
 */
export function parse_generic_type(type_ref: string): {
  base_type: string;
  type_arguments: string[];
} | null {
  // Try angle brackets first (TypeScript/Rust)
  let match = type_ref.match(/^([^<]+)<(.+)>$/);
  if (match) {
    const base_type = match[1].trim();
    const args_str = match[2];
    const type_arguments = parse_type_arguments(args_str, '<', '>');
    return { base_type, type_arguments };
  }
  
  // Try square brackets (Python)
  match = type_ref.match(/^([^[]+)\[(.+)\]$/);
  if (match) {
    const base_type = match[1].trim();
    const args_str = match[2];
    const type_arguments = parse_type_arguments(args_str, '[', ']');
    return { base_type, type_arguments };
  }
  
  return null;
}

/**
 * Create a generic context from type parameters
 */
export function create_generic_context(
  type_parameters?: GenericParameter[],
  parent?: GenericContext
): GenericContext {
  const context: GenericContext = {
    type_parameters: new Map(),
    type_arguments: new Map(),
    parent_context: parent
  };
  
  if (type_parameters) {
    for (const param of type_parameters) {
      context.type_parameters.set(param.name, param);
    }
  }
  
  return context;
}

// =============================================================================
// PRIVATE HELPER FUNCTIONS (in order of usage)
// =============================================================================

/**
 * Resolve a single type argument
 */
function resolve_type_argument(
  arg: string,
  context: GenericContext,
  substitutions: Map<string, string>
): string {
  // Check if it's a type parameter
  if (context.type_arguments.has(arg)) {
    const resolved = context.type_arguments.get(arg)!;
    substitutions.set(arg, resolved);
    return resolved;
  }
  
  // Check parent context
  if (context.parent_context) {
    return resolve_type_argument(arg, context.parent_context, substitutions);
  }
  
  // Check if it has a default
  const param = context.type_parameters.get(arg);
  if (param?.default) {
    substitutions.set(arg, param.default);
    return param.default;
  }
  
  // Return as-is if not a parameter
  return arg;
}

/**
 * Parse comma-separated type arguments
 */
function parse_type_arguments(args_str: string, open_bracket: string, close_bracket: string): string[] {
  // Handle empty args string
  if (!args_str.trim()) {
    return [];
  }
  
  const args: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of args_str) {
    if (char === open_bracket || char === '<' || char === '[') {
      depth++;
      current += char;
    } else if (char === close_bracket || char === '>' || char === ']') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}

/**
 * Bind type arguments to generic parameters
 */
function bind_type_arguments(
  context: GenericContext,
  type_arguments: TypeName[]
): GenericContext {
  const bound_context = { ...context };
  const params = Array.from(context.type_parameters.keys());
  
  // Bind positional arguments
  for (let i = 0; i < Math.min(params.length, type_arguments.length); i++) {
    bound_context.type_arguments.set(params[i], type_arguments[i]);
  }
  
  // Apply defaults for unbound parameters
  for (const [name, param] of context.type_parameters) {
    if (!bound_context.type_arguments.has(name) && param.default) {
      bound_context.type_arguments.set(name, param.default as TypeName);
    }
  }
  
  return bound_context;
}

/**
 * Extract generic parameters from AST node using configuration
 * This handles ~60% of generic extraction logic across languages
 */
function extract_generic_parameters(
  node: SyntaxNode,
  source_code: string,
  language: Language
): GenericParameter[] {
  const config = getLanguageConfig(language);
  const params: GenericParameter[] = [];
  
  // Check if this language supports generics
  if (config.type_parameter_nodes.length === 0) {
    return params;
  }
  
  // Look for type parameter nodes using configured field names
  let type_params: SyntaxNode | null = null;
  for (const field_name of config.type_parameter_fields) {
    type_params = node.childForFieldName(field_name);
    if (type_params) break;
  }
  
  if (!type_params) return params;
  
  // Extract parameters based on node types
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (!param) continue;
    
    // Check if this is a type parameter node
    if (config.type_parameter_nodes.includes(param.type)) {
      const name_node = config.parameter_name_field 
        ? param.childForFieldName(config.parameter_name_field)
        : param;
      const constraint_node = config.parameter_constraint_field
        ? param.childForFieldName(config.parameter_constraint_field)
        : null;
      const default_node = config.parameter_default_field
        ? param.childForFieldName(config.parameter_default_field)
        : null;
      
      if (name_node) {
        params.push({
          name: source_code.substring(name_node.startIndex, name_node.endIndex),
          constraint: constraint_node 
            ? source_code.substring(constraint_node.startIndex, constraint_node.endIndex)
            : undefined,
          default: default_node
            ? source_code.substring(default_node.startIndex, default_node.endIndex)
            : undefined
        });
      }
    }
  }
  
  return params;
}

/**
 * Check if a type name is a generic parameter using configuration
 */
function is_generic_parameter(
  type_name: string,
  language: Language
): boolean {
  return isGenericParam(type_name, language);
}

/**
 * Check if a type satisfies a constraint
 */
function satisfies_constraint(
  type: string,
  constraint: string,
  type_hierarchy?: Map<string, string[]>
): boolean {
  // Parse constraint (e.g., "extends Comparable", "implements Iterable")
  const constraint_match = constraint.match(/^(extends|implements)\s+(.+)$/);
  if (!constraint_match) return true; // No constraint
  
  const [_, keyword, required_type] = constraint_match;
  
  // Without type hierarchy, we can only check exact matches
  if (!type_hierarchy) {
    return type === required_type;
  }
  
  // Check if type extends/implements the required type
  const supertypes = type_hierarchy.get(type);
  if (!supertypes) return false;
  
  return supertypes.includes(required_type);
}

/**
 * Infer type arguments from usage
 */
function infer_type_arguments(
  generic_type: string,
  usage_context: {
    assigned_to?: string;
    arguments?: string[];
    return_type?: string;
  },
  type_registry?: Map<string, any>
): TypeName[] {
  const inferred: TypeName[] = [];
  
  // Common patterns for inference
  const patterns: Record<string, (ctx: typeof usage_context) => TypeName[]> = {
    'Array': (ctx) => {
      if (ctx.arguments && ctx.arguments.length > 0) {
        // Infer from array elements
        return [infer_common_type(ctx.arguments) as TypeName];
      }
      return ['any' as TypeName];
    },
    'Promise': (ctx) => {
      if (ctx.return_type) {
        // Infer from resolved value
        return [ctx.return_type as TypeName];
      }
      return ['any' as TypeName];
    },
    'Map': (ctx) => {
      if (ctx.arguments && ctx.arguments.length >= 2) {
        // Infer key and value types
        return [
          infer_element_type(ctx.arguments[0]) as TypeName,
          infer_element_type(ctx.arguments[1]) as TypeName
        ];
      }
      return ['any' as TypeName, 'any' as TypeName];
    },
    'Set': (ctx) => {
      if (ctx.arguments && ctx.arguments.length > 0) {
        // Infer from set elements
        return [infer_common_type(ctx.arguments) as TypeName];
      }
      return ['any' as TypeName];
    }
  };
  
  const base_type = parse_generic_type(generic_type)?.base_type || generic_type;
  const inferrer = patterns[base_type];
  
  if (inferrer) {
    return inferrer(usage_context);
  }
  
  // Default to 'any' for unknown patterns
  const param_count = count_type_parameters(generic_type);
  return Array(param_count).fill('any');
}

/**
 * Substitute type parameters in a type expression
 */
function substitute_type_parameters(
  type_expr: string,
  substitutions: Map<string, string>
): string {
  let result = type_expr;
  
  // Sort by length to avoid partial replacements
  const sorted_params = Array.from(substitutions.keys()).sort((a, b) => b.length - a.length);
  
  for (const param of sorted_params) {
    const replacement = substitutions.get(param)!;
    // Use word boundaries to avoid partial replacements
    const regex = new RegExp(`\\b${param}\\b`, 'g');
    result = result.replace(regex, replacement);
  }
  
  return result;
}

/**
 * Infer common type from multiple values
 */
function infer_common_type(values: string[]): string {
  if (values.length === 0) return 'any';
  
  const types = new Set(values.map(v => infer_element_type(v)));
  
  if (types.size === 1) {
    return Array.from(types)[0];
  }
  
  // Check for common supertypes
  if (types.size > 1) {
    return 'any'; // Mixed types default to any
  }
  
  return 'any';
}

/**
 * Infer type of a single element
 */
function infer_element_type(value: string): string {
  // Literal detection
  if (/^['"`]/.test(value)) return 'string';
  if (/^\d+(\.\d+)?$/.test(value)) return 'number';
  if (value === 'true' || value === 'false') return 'boolean';
  if (value === 'null') return 'null';
  if (value === 'undefined') return 'undefined';
  
  // Object/Array literals
  if (value.startsWith('{')) return 'object';
  if (value.startsWith('[')) return 'array';
  
  // Default to any
  return 'any';
}

/**
 * Count type parameters in a generic type
 */
function count_type_parameters(type: string): number {
  const parsed = parse_generic_type(type);
  return parsed ? parsed.type_arguments.length : 0;
}