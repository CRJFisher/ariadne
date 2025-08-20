/**
 * Parameter type inference dispatcher
 * 
 * Routes parameter type inference operations to language-specific implementations
 */

import { SyntaxNode } from 'tree-sitter';
import { Def, Language } from '@ariadnejs/types';
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterAnalysis,
  ParameterInferenceContext,
  extract_parameters,
  infer_type_from_default,
  check_parameter_patterns,
  get_void_type,
  get_any_type,
  has_explicit_type,
  resolve_parameter_type
} from './parameter_type_inference';

// Language-specific imports
import {
  infer_javascript_parameter_types,
  infer_from_javascript_call_sites
} from './parameter_type_inference.javascript';

import {
  infer_typescript_parameter_types,
  extract_typescript_parameter_modifiers,
  resolve_overload_parameters,
  extract_generic_constraints,
  resolve_union_type,
  is_utility_type,
  infer_from_typescript_call_sites
} from './parameter_type_inference.typescript';

import {
  infer_python_parameter_types,
  infer_from_python_call_sites
} from './parameter_type_inference.python';

import {
  infer_rust_parameter_types,
  extract_lifetime_parameters,
  extract_generic_parameters,
  extract_where_clause_constraints,
  is_rust_primitive,
  is_std_type,
  infer_from_rust_call_sites,
  handle_pattern_parameters
} from './parameter_type_inference.rust';

// Re-export core types and functions
export {
  // Types
  ParameterInfo,
  ParameterTypeInfo,
  ParameterAnalysis,
  ParameterInferenceContext,
  // Core functions
  extract_parameters,
  infer_type_from_default,
  check_parameter_patterns,
  get_void_type,
  get_any_type,
  has_explicit_type,
  resolve_parameter_type
};

/**
 * Infer parameter types for a function definition
 */
export function infer_parameter_types(
  func_def: Def,
  func_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterAnalysis {
  // Extract parameters
  const parameters = extract_parameters(func_node, context);
  
  // Infer types based on language
  const inferred_types = infer_parameter_types_by_language(
    func_def,
    func_node,
    parameters,
    context
  );
  
  return {
    function_name: func_def.name,
    parameters,
    inferred_types
  };
}

/**
 * Infer parameter types based on language
 */
function infer_parameter_types_by_language(
  func_def: Def,
  func_node: SyntaxNode,
  parameters: ParameterInfo[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo> {
  switch (context.language) {
    case 'javascript':
      return infer_javascript_parameter_types(func_def, func_node, parameters, context);
    case 'typescript':
      return infer_typescript_parameter_types(func_def, func_node, parameters, context);
    case 'python':
      return infer_python_parameter_types(func_def, func_node, parameters, context);
    case 'rust':
      return infer_rust_parameter_types(func_def, func_node, parameters, context);
    default:
      if (context.debug) {
        console.warn(`Parameter type inference not implemented for language: ${context.language}`);
      }
      return new Map();
  }
}

/**
 * Infer parameter types from call sites
 */
export function infer_from_call_sites(
  func_name: string,
  parameters: ParameterInfo[],
  call_sites: SyntaxNode[],
  context: ParameterInferenceContext
): Map<string, ParameterTypeInfo[]> {
  switch (context.language) {
    case 'javascript':
      return infer_from_javascript_call_sites(func_name, parameters, call_sites, context);
    case 'typescript':
      return infer_from_typescript_call_sites(func_name, parameters, call_sites, context);
    case 'python':
      return infer_from_python_call_sites(func_name, parameters, call_sites, context);
    case 'rust':
      return infer_from_rust_call_sites(func_name, parameters, call_sites, context);
    default:
      if (context.debug) {
        console.warn(`Call site inference not implemented for language: ${context.language}`);
      }
      return new Map();
  }
}

/**
 * Combine parameter type information from multiple sources
 */
export function combine_parameter_inferences(
  from_definition: Map<string, ParameterTypeInfo>,
  from_call_sites: Map<string, ParameterTypeInfo[]>
): Map<string, ParameterTypeInfo> {
  const combined = new Map<string, ParameterTypeInfo>();
  
  // Start with definition types
  for (const [name, type_info] of from_definition) {
    combined.set(name, type_info);
  }
  
  // Enhance or override with call site information
  for (const [name, call_types] of from_call_sites) {
    const def_type = combined.get(name);
    
    if (!def_type || def_type.confidence === 'assumed') {
      // Use call site type if no definition type or definition is just assumed
      const resolved = resolve_parameter_type(call_types);
      if (resolved) {
        combined.set(name, resolved);
      }
    } else if (def_type.confidence === 'inferred' && call_types.length > 0) {
      // Check if call site types agree with inferred type
      const consistent_types = call_types.filter(t => 
        t.inferred_type === def_type.inferred_type
      );
      
      if (consistent_types.length === call_types.length) {
        // All call sites agree, increase confidence
        combined.set(name, {
          ...def_type,
          confidence: 'explicit'
        });
      }
    }
  }
  
  return combined;
}

/**
 * Extract parameter types for documentation
 */
export function format_parameter_signature(
  analysis: ParameterAnalysis,
  language: Language
): string {
  const params = analysis.parameters.map(param => {
    const type_info = analysis.inferred_types.get(param.name);
    const type_str = type_info?.inferred_type || get_any_type(language);
    
    switch (language) {
      case 'typescript':
        if (param.is_optional) {
          return `${param.name}?: ${type_str}`;
        } else if (param.is_rest) {
          return `...${param.name}: ${type_str}[]`;
        } else {
          return `${param.name}: ${type_str}`;
        }
      
      case 'python':
        if (param.is_rest) {
          if (param.is_keyword_only) {
            return `**${param.name}`;
          } else {
            return `*${param.name}`;
          }
        } else if (param.default_value) {
          return `${param.name}: ${type_str} = ${param.default_value}`;
        } else {
          return `${param.name}: ${type_str}`;
        }
      
      case 'rust':
        if (param.name === 'self') {
          return type_str.toLowerCase();
        } else {
          return `${param.name}: ${type_str}`;
        }
      
      case 'javascript':
      default:
        if (param.is_rest) {
          return `...${param.name}`;
        } else if (param.default_value) {
          return `${param.name} = ${param.default_value}`;
        } else {
          return param.name;
        }
    }
  });
  
  return `(${params.join(', ')})`;
}

/**
 * Check if parameter types are fully resolved
 */
export function are_parameters_typed(analysis: ParameterAnalysis): boolean {
  for (const param of analysis.parameters) {
    const type_info = analysis.inferred_types.get(param.name);
    if (!type_info || type_info.confidence === 'assumed') {
      return false;
    }
  }
  return true;
}

/**
 * Get parameter at position
 */
export function get_parameter_at_position(
  parameters: ParameterInfo[],
  position: number
): ParameterInfo | undefined {
  return parameters.find(p => p.position === position);
}

/**
 * Get parameter by name
 */
export function get_parameter_by_name(
  parameters: ParameterInfo[],
  name: string
): ParameterInfo | undefined {
  return parameters.find(p => p.name === name);
}

// Export language-specific functions for testing
export {
  // JavaScript
  infer_javascript_parameter_types,
  infer_from_javascript_call_sites,
  // TypeScript
  infer_typescript_parameter_types,
  extract_typescript_parameter_modifiers,
  resolve_overload_parameters,
  extract_generic_constraints,
  resolve_union_type,
  is_utility_type,
  infer_from_typescript_call_sites,
  // Python
  infer_python_parameter_types,
  infer_from_python_call_sites,
  // Rust
  infer_rust_parameter_types,
  extract_lifetime_parameters,
  extract_generic_parameters,
  extract_where_clause_constraints,
  is_rust_primitive,
  is_std_type,
  infer_from_rust_call_sites,
  handle_pattern_parameters
};