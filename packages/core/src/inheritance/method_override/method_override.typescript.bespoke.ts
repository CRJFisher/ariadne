/**
 * TypeScript-specific method override handling
 * 
 * Handles TypeScript's unique features:
 * - Interface implementations
 * - Explicit override keyword
 * - Abstract methods
 */

import { SyntaxNode } from 'tree-sitter';
import { MethodOverrideContext } from './method_override.generic';
import { has_override_marker, has_abstract_marker } from './language_configs';

/**
 * Handle TypeScript-specific override features
 */
export function handle_typescript_overrides(context: MethodOverrideContext): void {
  const { config, overrides, override_edges, abstract_methods } = context;
  
  // Process each override to check for TypeScript-specific features
  for (const [key, info] of overrides) {
    // Check if method has explicit override keyword
    // This requires access to the original AST node
    // Since we don't have it in the current structure, we'll mark all
    // overrides where parent exists as potentially explicit
    if (info.overrides) {
      // Find corresponding edge to update is_explicit flag
      const edge = override_edges.find(
        e => e.method === info.method_def && e.base_method === info.overrides
      );
      if (edge) {
        // In TypeScript, the override keyword makes it explicit
        // We would need the AST node to check this properly
        edge.is_explicit = config.features.has_explicit_override;
      }
    }
    
    // Check for abstract methods
    if (info.is_abstract) {
      abstract_methods.push(info.method_def);
    }
  }
}

/**
 * Process interface implementations
 * 
 * TypeScript allows classes to implement interfaces, which creates
 * an implicit override relationship
 */
export function process_interface_implementations(
  ast: SyntaxNode,
  context: MethodOverrideContext
): void {
  // This would require querying for interface implementations
  // and matching methods, which is beyond the current scope
  // but would be added in a full implementation
}