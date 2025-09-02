/**
 * Generic type resolution
 * 
 * Resolves generic type parameters and constraints
 * Handles type instantiation and substitution
 */

import { 
  TypeName, 
  Location,
  GenericParameter,
  GenericInstance,
  ResolvedGeneric
} from '@ariadnejs/types';

/**
 * Context for generic resolution (internal use only)
 */
export interface GenericContext {
  type_parameters: Map<string, GenericParameter>;
  type_arguments: Map<string, TypeName>;
  parent_context?: GenericContext;
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

/**
 * Bind type arguments to generic parameters
 */
export function bind_type_arguments(
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
 * Resolve a generic type reference
 */
export function resolve_generic_type(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric {
  const substitutions = new Map<string, string>();
  
  // Parse type reference (e.g., "Array<T>", "Map<K, V>")
  const parsed = parse_generic_type(type_ref);
  if (!parsed) {
    return {
      original_type: type_ref,
      resolved_type: type_ref,
      type_substitutions: substitutions,
      confidence: 'exact'
    };
  }
  
  // Resolve type arguments
  const resolved_args: string[] = [];
  for (const arg of parsed.type_arguments) {
    const resolved = resolve_type_argument(arg, context, substitutions);
    resolved_args.push(resolved);
  }
  
  // Reconstruct the type
  const resolved_type = resolved_args.length > 0
    ? `${parsed.base_type}<${resolved_args.join(', ')}>`
    : parsed.base_type;
  
  return {
    original_type: type_ref,
    resolved_type,
    type_substitutions: substitutions,
    confidence: substitutions.size > 0 ? 'exact' : 'partial'
  };
}

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
 * Parse a generic type reference
 */
export function parse_generic_type(type_ref: string): {
  base_type: string;
  type_arguments: string[];
} | null {
  const match = type_ref.match(/^([^<]+)<(.+)>$/);
  if (!match) return null;
  
  const base_type = match[1].trim();
  const args_str = match[2];
  
  // Parse comma-separated arguments (handle nested generics)
  const type_arguments = parse_type_arguments(args_str);
  
  return { base_type, type_arguments };
}

/**
 * Parse comma-separated type arguments
 */
function parse_type_arguments(args_str: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of args_str) {
    if (char === '<') {
      depth++;
      current += char;
    } else if (char === '>') {
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
 * Check if a type satisfies a constraint
 */
export function satisfies_constraint(
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
export function infer_type_arguments(
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
        return [infer_common_type(ctx.arguments)];
      }
      return ['any'];
    },
    'Promise': (ctx) => {
      if (ctx.return_type) {
        // Infer from resolved value
        return [ctx.return_type];
      }
      return ['any'];
    },
    'Map': (ctx) => {
      if (ctx.arguments && ctx.arguments.length >= 2) {
        // Infer key and value types
        return [
          infer_element_type(ctx.arguments[0]),
          infer_element_type(ctx.arguments[1])
        ];
      }
      return ['any', 'any'];
    },
    'Set': (ctx) => {
      if (ctx.arguments && ctx.arguments.length > 0) {
        // Infer from set elements
        return [infer_common_type(ctx.arguments)];
      }
      return ['any'];
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

/**
 * Substitute type parameters in a type expression
 */
export function substitute_type_parameters(
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