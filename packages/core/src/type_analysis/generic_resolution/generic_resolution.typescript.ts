/**
 * TypeScript-specific bespoke generic features
 * 
 * Handles TypeScript utility types and mapped types that cannot be genericized
 */

import { ResolvedGeneric } from '@ariadnejs/types';
import { GenericContext, resolve_generic_type, parse_generic_type } from './generic_resolution';

/**
 * TypeScript utility type handlers
 * These use the resolved arguments to create proper utility type syntax
 */
const utility_type_handlers: Record<string, (args: string[]) => string> = {
  'Partial': (args) => `Partial<${args.join(', ')}>`,
  'Required': (args) => `Required<${args.join(', ')}>`,
  'Readonly': (args) => `Readonly<${args.join(', ')}>`,
  'Pick': (args) => `Pick<${args.join(', ')}>`,
  'Omit': (args) => `Omit<${args.join(', ')}>`,
  'Record': (args) => `Record<${args.join(', ')}>`,
  'ReturnType': (args) => `ReturnType<${args.join(', ')}>`,
  'InstanceType': (args) => `InstanceType<${args.join(', ')}>`,
  'NonNullable': (args) => `NonNullable<${args.join(', ')}>`,
  'Extract': (args) => `Extract<${args.join(', ')}>`,
  'Exclude': (args) => `Exclude<${args.join(', ')}>`,
  'Parameters': (args) => `Parameters<${args.join(', ')}>`,
  'ConstructorParameters': (args) => `ConstructorParameters<${args.join(', ')}>`,
  'ThisParameterType': (args) => `ThisParameterType<${args.join(', ')}>`,
  'OmitThisParameter': (args) => `OmitThisParameter<${args.join(', ')}>`,
  'ThisType': (args) => `ThisType<${args.join(', ')}>`
};

/**
 * Resolve TypeScript-specific utility types
 * Returns null if not a utility type
 */
export function resolve_typescript_utility_type(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const parsed = parse_generic_type(type_ref);
  if (!parsed) return null;
  
  const handler = utility_type_handlers[parsed.base_type];
  if (!handler) return null;
  
  // Resolve arguments first
  const type_substitutions = new Map<string, string>();
  let all_resolved = true;
  
  const resolved_args = parsed.type_arguments.map(arg => {
    const resolved = resolve_generic_type(arg, context);
    // Merge substitutions
    resolved.type_substitutions.forEach((value, key) => {
      type_substitutions.set(key, value);
    });
    // Check if this argument was fully resolved
    if (resolved.confidence === 'partial') {
      all_resolved = false;
    }
    return resolved.resolved_type;
  });
  
  const resolved_type = handler(resolved_args);
  
  return {
    original_type: type_ref,
    resolved_type,
    type_substitutions,
    confidence: all_resolved ? 'exact' : 'partial'
  };
}

/**
 * Handle TypeScript conditional types
 * e.g., T extends U ? X : Y
 */
export function resolve_typescript_conditional(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const conditional_match = type_ref.match(/^(.+)\s+extends\s+(.+)\s+\?\s+(.+)\s+:\s+(.+)$/);
  if (!conditional_match) return null;
  
  const [_, check_type, extends_type, true_type, false_type] = conditional_match;
  
  // For now, return a simplified representation
  // Full conditional type evaluation would require runtime type information
  return {
    original_type: type_ref,
    resolved_type: `(${check_type} extends ${extends_type} ? ${true_type} : ${false_type})`,
    type_substitutions: new Map(),
    confidence: 'partial'
  };
}

/**
 * Handle TypeScript mapped types
 * e.g., { [K in keyof T]: T[K] }
 */
export function resolve_typescript_mapped_type(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const mapped_match = type_ref.match(/^\{\s*\[(\w+)\s+in\s+(.+)\](\?)?:\s+(.+)\s*\}$/);
  if (!mapped_match) return null;
  
  const [_, key_name, key_constraint, optional, value_type] = mapped_match;
  
  return {
    original_type: type_ref,
    resolved_type: type_ref, // Keep as-is, it's already a mapped type expression
    type_substitutions: new Map(),
    confidence: 'exact'
  };
}

/**
 * Handle TypeScript template literal types
 * e.g., `prefix-${T}`
 */
export function resolve_typescript_template_literal(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  if (!type_ref.startsWith('`') || !type_ref.endsWith('`')) return null;
  
  // Extract template parts
  const template_content = type_ref.slice(1, -1);
  const resolved = template_content.replace(/\$\{([^}]+)\}/g, (match, type) => {
    const resolved_type = resolve_generic_type(type, context);
    return `\${${resolved_type.resolved_type}}`;
  });
  
  return {
    original_type: type_ref,
    resolved_type: `\`${resolved}\``,
    type_substitutions: new Map(),
    confidence: 'exact'
  };
}