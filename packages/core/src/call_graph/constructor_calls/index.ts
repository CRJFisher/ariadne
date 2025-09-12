/**
 * Constructor call detection
 * 
 * Configuration-driven dispatcher with bespoke language enhancements
 */

import { 
  ConstructorCallContext,
  process_constructor_calls_generic,
  walk_tree
} from './constructor_calls';
import { node_to_location } from '../../ast/node_utils';

// Import bespoke handlers
import { 
  handle_object_create_pattern,
  detect_advanced_factory_pattern
} from './constructor_calls.javascript';
import {
  handle_generic_constructor
} from './constructor_calls.typescript';
import {
  handle_super_init_call,
  detect_classmethod_factory
} from './constructor_calls.python';
import {
  handle_enum_variant_construction,
  handle_tuple_struct_construction,
  handle_macro_construction,
  handle_smart_pointer_construction,
  handle_default_construction
} from './constructor_calls.rust';

// Export type validation functions for Global Assembly phase
export {
  enrich_constructor_calls_with_types,
  validate_constructor,
  batch_validate_constructors,
  get_constructable_types,
} from './constructor_type_resolver';

// Export bidirectional flow functions
export {
  extract_constructor_calls_and_types,
  merge_constructor_types,
  ConstructorCallResult,
  ConstructorTypeAssignment
} from './constructor_type_extraction';

/**
 * Find all constructor calls in code (Per-File Phase - Layer 4)
 * 
 * Uses configuration-driven generic processing combined with
 * language-specific bespoke handlers for unique features.
 * 
 * NOTE: This is a per-file analysis function. It identifies constructor call syntax
 * but cannot validate if the constructor actually exists in the codebase.
 * Full validation happens in the global phase with the type registry.
 * 
 * @param context The context containing source code, AST, and metadata
 * @returns Array of constructor call information (unvalidated)
 */
export function find_constructor_calls(
  context: ConstructorCallContext
): ConstructorCallInfo[] {
  // Start with generic configuration-driven processing
  const generic_calls = process_constructor_calls_generic(context);
  
  // Apply language-specific bespoke enhancements
  const bespoke_calls: ConstructorCallInfo[] = [];
  
  switch (context.language) {
    case 'javascript':
      // JavaScript-specific patterns
      walk_tree(context.ast_root, (node) => {
        // Object.create() pattern
        const object_create = handle_object_create_pattern(node, context);
        if (object_create) {
          bespoke_calls.push(object_create);
        }
        
        // Advanced factory patterns
        if (node.type === 'call_expression' && detect_advanced_factory_pattern(node, context)) {
          const func = node.childForFieldName('function');
          if (func && func.type === 'identifier') {
            const name = context.source_code.substring(func.startIndex, func.endIndex);
            // Check if not already captured by generic processor
            if (!generic_calls.some(c => 
              c.location.line === node.startPosition.row &&
              c.location.column === node.startPosition.column)) {
              bespoke_calls.push({
                constructor_name: name,
                location: node_to_location(node, context.file_path),
                arguments_count: 0, // Will be counted properly if needed
                is_new_expression: false,
                is_factory_method: true
              });
            }
          }
        }
      });
      break;
    
    case 'typescript':
      // TypeScript-specific patterns
      walk_tree(context.ast_root, (node) => {
        // Generic constructors
        const generic_ctor = handle_generic_constructor(node, context);
        if (generic_ctor) {
          // Check if not already captured
          if (!generic_calls.some(c => 
            c.location.line === generic_ctor.location.line &&
            c.location.column === generic_ctor.location.column)) {
            bespoke_calls.push(generic_ctor);
          }
        }
      });
      break;
    
    case 'python':
      // Python-specific patterns
      walk_tree(context.ast_root, (node) => {
        // super().__init__() calls
        const super_call = handle_super_init_call(node, context);
        if (super_call) {
          bespoke_calls.push(super_call);
        }
        
        // Class method factories
        const classmethod = detect_classmethod_factory(node, context);
        if (classmethod) {
          // Check if not already captured
          if (!generic_calls.some(c => 
            c.location.line === classmethod.location.line &&
            c.location.column === classmethod.location.column)) {
            bespoke_calls.push(classmethod);
          }
        }
      });
      break;
    
    case 'rust':
      // Rust-specific patterns
      walk_tree(context.ast_root, (node) => {
        // Enum variant construction
        const enum_variant = handle_enum_variant_construction(node, context);
        if (enum_variant) {
          bespoke_calls.push(enum_variant);
        }
        
        // Tuple struct construction
        const tuple_struct = handle_tuple_struct_construction(node, context);
        if (tuple_struct) {
          // Check if not already captured
          if (!generic_calls.some(c => 
            c.location.line === tuple_struct.location.line &&
            c.location.column === tuple_struct.location.column)) {
            bespoke_calls.push(tuple_struct);
          }
        }
        
        // Macro construction
        const macro_ctor = handle_macro_construction(node, context);
        if (macro_ctor) {
          bespoke_calls.push(macro_ctor);
        }
        
        // Smart pointer construction
        const smart_ptr = handle_smart_pointer_construction(node, context);
        if (smart_ptr) {
          // Check if not already captured
          if (!generic_calls.some(c => 
            c.location.line === smart_ptr.location.line &&
            c.location.column === smart_ptr.location.column)) {
            bespoke_calls.push(smart_ptr);
          }
        }
        
        // Default::default() pattern
        const default_ctor = handle_default_construction(node, context);
        if (default_ctor) {
          bespoke_calls.push(default_ctor);
        }
      });
      break;
    
    default:
      // Unsupported language - return only generic results
      break;
  }
  
  // Combine and deduplicate results
  const all_calls = [...generic_calls, ...bespoke_calls];
  
  // Deduplicate based on location
  const seen = new Set<string>();
  const unique_calls: ConstructorCallInfo[] = [];
  
  for (const call of all_calls) {
    const key = `${call.location.line}:${call.location.column}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique_calls.push(call);
    }
  }
  
  return unique_calls;
}



