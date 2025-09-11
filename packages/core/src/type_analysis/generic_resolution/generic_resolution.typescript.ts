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
  // More careful parsing for nested conditional types
  // Find the first "extends" keyword
  const extends_match = type_ref.match(/^(.+?)\s+extends\s+(.+)$/);
  if (!extends_match) return null;
  
  const check_type = extends_match[1].trim();
  const remainder = extends_match[2];
  
  // Find the question mark and colon, handling nesting
  let question_pos = -1;
  let colon_pos = -1;
  let depth = 0;
  
  for (let i = 0; i < remainder.length; i++) {
    const char = remainder[i];
    if (char === '?') {
      if (depth === 0 && question_pos === -1) {
        question_pos = i;
      }
      depth++;
    } else if (char === ':') {
      depth--;
      if (depth === 0 && colon_pos === -1 && question_pos !== -1) {
        colon_pos = i;
        break;
      }
    }
  }
  
  if (question_pos === -1 || colon_pos === -1) return null;
  
  const extends_type = remainder.substring(0, question_pos).trim();
  const true_type = remainder.substring(question_pos + 1, colon_pos).trim();
  const false_type = remainder.substring(colon_pos + 1).trim();
  
  // Resolve each part of the conditional type
  const resolved_check = resolve_generic_type(check_type, context);
  const resolved_extends = resolve_generic_type(extends_type, context);
  const resolved_true = resolve_generic_type(true_type, context);
  const resolved_false = resolve_generic_type(false_type, context);
  
  // Collect all substitutions
  const type_substitutions = new Map<string, string>();
  [resolved_check, resolved_extends, resolved_true, resolved_false].forEach(res => {
    res.type_substitutions.forEach((value, key) => {
      type_substitutions.set(key, value);
    });
  });
  
  // Full conditional type evaluation would require runtime type information
  return {
    original_type: type_ref,
    resolved_type: `${resolved_check.resolved_type} extends ${resolved_extends.resolved_type} ? ${resolved_true.resolved_type} : ${resolved_false.resolved_type}`,
    type_substitutions,
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
  // Handle multiple mapped type patterns
  // Pattern 1: { [K in keyof T]: string }
  let mapped_match = type_ref.match(/^\{\s*\[(\w+)\s+in\s+(.+?)\]\s*:\s+(.+)\s*\}$/);
  
  // Pattern 2: { readonly [K in keyof T]?: T[K] }  
  if (!mapped_match) {
    mapped_match = type_ref.match(/^\{\s*(readonly\s+)?\[(\w+)\s+in\s+(.+?)\](\?)?\s*:\s+(.+)\s*\}$/);
  }
  
  // Pattern 3: { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] }
  if (!mapped_match) {
    mapped_match = type_ref.match(/^\{\s*\[(\w+)\s+in\s+(.+?)\s+as\s+(.+?)\]\s*:\s+(.+)\s*\}$/);
  }
  
  if (!mapped_match) return null;
  
  const type_substitutions = new Map<string, string>();
  
  // Replace type parameters in the entire expression
  let resolved_type = type_ref;
  context.type_arguments.forEach((replacement, param) => {
    // Use word boundaries to ensure we only replace complete type parameters
    const regex = new RegExp(`\\b${param}\\b`, 'g');
    resolved_type = resolved_type.replace(regex, replacement);
    type_substitutions.set(param, replacement);
  });
  
  return {
    original_type: type_ref,
    resolved_type,
    type_substitutions,
    confidence: type_substitutions.size > 0 ? 'exact' : 'partial'
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