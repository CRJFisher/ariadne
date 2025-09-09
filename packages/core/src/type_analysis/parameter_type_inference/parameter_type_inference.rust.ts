/**
 * Rust-specific bespoke parameter type inference
 *
 * Handles unique Rust features that cannot be expressed through configuration:
 * - Lifetime parameters
 * - Generic type parameters with where clauses
 * - Pattern parameters and destructuring
 * - Trait bounds
 */

import { SyntaxNode } from "tree-sitter";
import {
  ParameterInfo,
  ParameterTypeInfo,
  ParameterInferenceContext,
} from "./parameter_type_inference";

/**
 * Handle Rust pattern parameters (destructuring)
 */
export function handle_pattern_parameters(
  param_node: SyntaxNode,
  context: ParameterInferenceContext
): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const { source_code } = context;

  if (param_node.type !== "parameter") {
    return params;
  }

  const pattern = param_node.childForFieldName("pattern");
  const type_node = param_node.childForFieldName("type");

  if (!pattern) {
    return params;
  }

  const type_annotation = type_node
    ? source_code.substring(type_node.startIndex, type_node.endIndex)
    : undefined;

  // Handle different pattern types
  switch (pattern.type) {
    case "identifier":
      params.push({
        name: source_code.substring(pattern.startIndex, pattern.endIndex),
        position: 0,
        type_annotation,
      });
      break;

    case "tuple_pattern":
      // Destructure tuple: (a, b, c): (Type1, Type2, Type3)
      const tuple_types = type_annotation
        ? parse_tuple_type(type_annotation)
        : [];

      // Recursively process tuple elements with proper type tracking
      function process_tuple_element(elem: SyntaxNode, types: string[], type_index: number): number {
        if (elem.type === "identifier") {
          params.push({
            name: source_code.substring(elem.startIndex, elem.endIndex),
            position: params.length,
            type_annotation: types[type_index] || undefined,
          });
          return type_index + 1;
        } else if (elem.type === "tuple_pattern") {
          // Handle nested tuples
          const nested_type = types[type_index];
          const nested_types = nested_type ? parse_tuple_type(nested_type) : [];
          let nested_index = 0;
          for (let j = 0; j < elem.childCount; j++) {
            const nested_child = elem.child(j);
            if (nested_child && nested_child.type !== "," && nested_child.type !== "(" && nested_child.type !== ")") {
              nested_index = process_tuple_element(nested_child, nested_types, nested_index);
            }
          }
          return type_index + 1;
        }
        return type_index;
      }

      let current_index = 0;
      for (let i = 0; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        if (child && child.type !== "," && child.type !== "(" && child.type !== ")") {
          current_index = process_tuple_element(child, tuple_types, current_index);
        }
      }
      break;

    case "struct_pattern":
      // Destructure struct: Point { x, y }: Point
      // Look for the struct name if available
      const struct_name_node = pattern.child(0);
      const struct_type = type_annotation || (struct_name_node && struct_name_node.type === "identifier" 
        ? source_code.substring(struct_name_node.startIndex, struct_name_node.endIndex)
        : undefined);
      
      for (let i = 0; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        
        // Check for field_pattern or shorthand_field_identifier
        if (child && (child.type === "field_pattern" || child.type === "shorthand_field_identifier")) {
          let field_name: string | undefined;
          
          if (child.type === "shorthand_field_identifier") {
            // Shorthand: Point { x, y }
            field_name = source_code.substring(child.startIndex, child.endIndex);
          } else if (child.type === "field_pattern") {
            // Full form: Point { x: x_val, y: y_val }
            // In Rust field patterns, the "pattern" field contains the alias
            const pattern_node = child.childForFieldName("pattern");
            const name_node = child.childForFieldName("name");
            
            if (pattern_node && pattern_node.type === "identifier") {
              // Use the pattern (alias) as the parameter name
              field_name = source_code.substring(pattern_node.startIndex, pattern_node.endIndex);
            } else if (name_node) {
              // Fall back to field name if no alias
              field_name = source_code.substring(name_node.startIndex, name_node.endIndex);
            }
          }
          
          if (field_name) {
            params.push({
              name: field_name,
              position: params.length,
              type_annotation: struct_type,
            });
          }
        }
      }
      break;

    case "slice_pattern":
      // Handle slice patterns: [first, second, third]: [i32; 3]
      // Extract the element type from the array type
      let element_type: string | undefined;
      if (type_annotation) {
        // Parse [T; N] to get T
        const match = type_annotation.match(/\[([^;]+);\s*\d+\]/);
        element_type = match ? match[1].trim() : undefined;
      }
      
      for (let i = 0; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        if (child && child.type === "identifier") {
          params.push({
            name: source_code.substring(child.startIndex, child.endIndex),
            position: params.length,
            type_annotation: element_type,
          });
        }
      }
      break;

    case "reference_pattern":
      // Handle reference patterns: &Point { x, y }: &Point
      // or &mut Point { x, y }: &mut Point
      // Find the actual pattern (skip "&" and optional "mut")
      let ref_inner = null;
      for (let i = 1; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        if (child && child.type !== "mutable_specifier") {
          ref_inner = child;
          break;
        }
      }
      
      if (ref_inner) {
        // Handle the inner pattern based on its type
        if (ref_inner.type === "struct_pattern") {
          // Process struct pattern fields
          for (let i = 0; i < ref_inner.childCount; i++) {
            const child = ref_inner.child(i);
            
            if (child && (child.type === "field_pattern" || child.type === "shorthand_field_identifier")) {
              let field_name: string | undefined;
              
              if (child.type === "shorthand_field_identifier") {
                field_name = source_code.substring(child.startIndex, child.endIndex);
              } else if (child.type === "field_pattern") {
                const pattern_node = child.childForFieldName("pattern");
                const name_node = child.childForFieldName("name");
                
                if (pattern_node && pattern_node.type === "identifier") {
                  field_name = source_code.substring(pattern_node.startIndex, pattern_node.endIndex);
                } else if (name_node && name_node.type === "shorthand_field_identifier") {
                  field_name = source_code.substring(name_node.startIndex, name_node.endIndex);
                } else if (name_node) {
                  field_name = source_code.substring(name_node.startIndex, name_node.endIndex);
                }
              }
              
              if (field_name) {
                params.push({
                  name: field_name,
                  position: params.length,
                  type_annotation: type_annotation, // The full &Point type
                });
              }
            }
          }
        } else {
          // For other inner patterns, recursively process them
          const inner_params = handle_pattern_parameters(
            { ...param_node, childForFieldName: (name: string) => {
              if (name === "pattern") return ref_inner;
              return param_node.childForFieldName(name);
            }} as SyntaxNode, 
            context
          );
          params.push(...inner_params);
        }
      }
      break;

    case "mut_pattern":
      // Handle mut patterns: mut x
      const mut_inner = pattern.child(pattern.childCount - 1);
      if (mut_inner && mut_inner.type === "identifier") {
        params.push({
          name: source_code.substring(mut_inner.startIndex, mut_inner.endIndex),
          position: 0,
          type_annotation: type_annotation,
        });
      } else if (mut_inner && mut_inner.type === "reference_pattern") {
        // Handle &mut patterns
        const ref_ref_inner = mut_inner.child(mut_inner.childCount - 1);
        if (ref_ref_inner) {
          const inner_params = handle_pattern_parameters({
            ...param_node,
            childForFieldName: (name: string) => {
              if (name === "pattern") return ref_ref_inner;
              if (name === "type") return param_node.childForFieldName("type");
              return param_node.childForFieldName(name);
            }
          } as SyntaxNode, context);
          
          params.push(...inner_params);
        }
      }
      break;

    case "tuple_struct_pattern":
      // Handle tuple struct patterns: Option::Some(value): Option<i32>
      // Extract the inner type from the generic
      let inner_type: string | undefined;
      if (type_annotation) {
        const match = type_annotation.match(/<(.+)>/);
        inner_type = match ? match[1].trim() : undefined;
      }
      
      // Find the inner pattern (usually in parentheses)
      for (let i = 0; i < pattern.childCount; i++) {
        const child = pattern.child(i);
        if (child && child.type === "identifier") {
          params.push({
            name: source_code.substring(child.startIndex, child.endIndex),
            position: params.length,
            type_annotation: inner_type,
          });
        } else if (child && child.type === "tuple_pattern") {
          // Recursively handle the tuple pattern
          const inner_params = handle_pattern_parameters({
            ...param_node,
            childForFieldName: (name: string) => {
              if (name === "pattern") return child;
              if (name === "type") {
                // Create a synthetic node with the inner type
                return { text: inner_type } as any;
              }
              return param_node.childForFieldName(name);
            }
          } as SyntaxNode, context);
          
          params.push(...inner_params);
        }
      }
      break;

    case "ref_pattern":
      // Legacy handling for simple ref patterns
      const inner = pattern.child(pattern.childCount - 1);
      if (inner && inner.type === "identifier") {
        const adjusted_type = type_annotation && !type_annotation.startsWith("&") 
          ? `&${type_annotation}` 
          : type_annotation;
        params.push({
          name: source_code.substring(inner.startIndex, inner.endIndex),
          position: 0,
          type_annotation: adjusted_type,
        });
      }
      break;
  }

  return params;
}

/**
 * Parse tuple type string into component types
 */
function parse_tuple_type(tuple_type: string): string[] {
  if (!tuple_type.startsWith("(") || !tuple_type.endsWith(")")) {
    return [];
  }

  const inner = tuple_type.slice(1, -1);
  const types: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of inner) {
    if (char === "," && depth === 0) {
      types.push(current.trim());
      current = "";
    } else {
      if (char === "(" || char === "<") depth++;
      if (char === ")" || char === ">") depth--;
      current += char;
    }
  }

  if (current.trim()) {
    types.push(current.trim());
  }

  return types;
}

