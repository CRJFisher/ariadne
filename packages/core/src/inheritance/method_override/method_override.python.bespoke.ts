/**
 * Python-specific method override handling
 * 
 * Handles Python's unique features:
 * - Method Resolution Order (MRO) for multiple inheritance
 * - @override decorator (Python 3.12+)
 * - @abstractmethod decorator
 * - Magic methods (__init__, __str__, etc.)
 */

import { MethodOverrideContext } from './method_override.generic';

/**
 * Handle Python-specific override features
 */
export function handle_python_overrides(context: MethodOverrideContext): void {
  const { config, hierarchy, overrides, override_edges, abstract_methods } = context;
  
  // Process MRO for multiple inheritance
  if (config.features.has_multiple_inheritance) {
    // Python uses C3 linearization for MRO
    // This would be calculated during hierarchy building
    // For now, we trust the hierarchy already has correct MRO
    for (const [class_name, class_info] of hierarchy.classes) {
      if (class_info.method_resolution_order.length === 0) {
        // Calculate simplified MRO if not already done
        class_info.method_resolution_order = calculate_simple_mro(class_info);
      }
    }
  }
  
  // Process each override to check for Python-specific features
  for (const [key, info] of overrides) {
    // Check for @override decorator (Python 3.12+)
    if (info.overrides) {
      const edge = override_edges.find(
        e => e.method === info.method_def && e.base_method === info.overrides
      );
      if (edge) {
        // Would need AST node to check for @override decorator
        edge.is_explicit = false; // Default to implicit for now
      }
    }
    
    // Abstract methods with @abstractmethod
    if (info.is_abstract) {
      abstract_methods.push(info.method_def);
    }
  }
}

/**
 * Calculate simplified Method Resolution Order
 * 
 * This is a simplified version - full C3 linearization would be more complex
 */
function calculate_simple_mro(class_info: any): any[] {
  const mro = [class_info.definition];
  
  // Add parent classes in order
  if (class_info.parent_class_def) {
    mro.push(class_info.parent_class_def);
  }
  
  // Add ancestors
  mro.push(...class_info.all_ancestors);
  
  // Remove duplicates while preserving order
  const seen = new Set<string>();
  return mro.filter(def => {
    if (seen.has(def.name)) {
      return false;
    }
    seen.add(def.name);
    return true;
  });
}

/**
 * Handle Python magic methods
 * 
 * Magic methods like __init__, __str__ have special semantics
 */
export function handle_magic_methods(context: MethodOverrideContext): void {
  const { all_methods } = context;
  
  // Magic methods are typically not considered for override analysis
  // except for __init__ which is handled specially
  // This is already handled by the skip_patterns in config
}