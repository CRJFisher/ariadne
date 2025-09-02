/**
 * Enhanced symbol types for variable-specific features
 */

import { ScopeSymbol, Location, FilePath } from '@ariadnejs/types';

/**
 * Declaration type for JavaScript/TypeScript variables
 */
export type DeclarationType = 'const' | 'let' | 'var' | 'parameter' | 'function' | 'class';

/**
 * Enhanced symbol with variable-specific features
 */
export interface EnhancedScopeSymbol extends ScopeSymbol {
  // Variable-specific fields
  declaration_type?: DeclarationType;
  is_mutable?: boolean;
  initial_value?: string;
  is_destructured?: boolean;
  destructured_from?: string;
}

/**
 * Extract variables from scope symbols
 */
export function extract_variables_from_symbols(
  symbols: Map<string, EnhancedScopeSymbol>
): EnhancedScopeSymbol[] {
  const variables: EnhancedScopeSymbol[] = [];
  
  for (const [_, symbol] of symbols) {
    if (symbol.kind === 'variable' || symbol.kind === 'parameter') {
      variables.push(symbol);
    }
  }
  
  return variables;
}

/**
 * Convert enhanced symbol to public VariableDeclaration
 */
export function symbol_to_variable_declaration(
  symbol: EnhancedScopeSymbol,
  file_path: FilePath
): any { // Will use proper VariableDeclaration type
  return {
    name: symbol.name,
    location: symbol.location,
    type: symbol.type_info,
    is_const: symbol.declaration_type === 'const',
    is_exported: symbol.is_exported
  };
}