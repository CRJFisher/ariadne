/**
 * Rust type resolution utilities
 *
 * Common helper functions and type checking utilities for Rust type resolution
 */

import type { TypeId, Location } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";

/**
 * Check if this appears to be Rust code based on semantic captures
 */
export function appears_to_be_rust_code(index: SemanticIndex): boolean {
  // Check if this is explicitly marked as Rust
  if (index.language === "rust") {
    return true;
  }

  // Safe check for references with null safety
  if (!index.references || !index.references.all_references) {
    return false;
  }

  // Check for Rust-specific captures
  try {
    return index.references.all_references.some(ref =>
      ref.modifiers?.is_borrow ||
      ref.modifiers?.is_dereference ||
      ref.modifiers?.is_smart_pointer ||
      ref.modifiers?.is_lifetime ||
      ref.modifiers?.is_trait_method
    );
  } catch (error) {
    // If all_references is not iterable or any other error, assume not Rust
    return false;
  }
}

/**
 * Check if a type is a Rust reference type
 */
export function is_rust_reference_type(type_id: TypeId): boolean {
  // In a complete implementation, this would check the TypeId metadata
  // For now, we'll use string matching as a heuristic
  return type_id.toString().includes('&') || type_id.toString().includes('ref');
}

/**
 * Check if a type is a Rust smart pointer
 */
export function is_rust_smart_pointer_type(type_id: TypeId): boolean {
  const smart_pointer_names = ['Box', 'Rc', 'Arc', 'RefCell', 'Mutex', 'RwLock'];
  const type_str = type_id.toString();

  return smart_pointer_names.some(name => type_str.includes(name));
}

/**
 * Check if a type is a Rust Future type
 */
export function is_rust_future_type(type_id: TypeId): boolean {
  const type_str = type_id.toString();
  return type_str.includes('Future') ||
         type_str.includes('Pin<') ||
         type_str.includes('impl Future') ||
         type_str.includes('dyn Future');
}

/**
 * Check if two locations are near each other (same match expression or similar context)
 */
export function locations_are_near(loc1: Location, loc2: Location): boolean {
  // Simple heuristic: same file and within reasonable line distance
  return loc1.file_path === loc2.file_path &&
         Math.abs(loc1.start_line - loc2.start_line) <= 5;
}

/**
 * Extract smart pointer name from type text
 */
export function extract_smart_pointer_name(type_text: string): string {
  // Match patterns like "Box<T>", "Rc<RefCell<T>>" etc.
  const match = type_text.match(/^(\w+)</);
  return match ? match[1] : type_text;
}

/**
 * Extract content from balanced angle brackets, handling nested generics
 */
export function extract_balanced_generic_content(content: string): string {
  let depth = 0;
  let result = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '<') {
      depth++;
      result += char;
    } else if (char === '>') {
      if (depth > 0) {
        depth--;
        result += char;
      } else {
        // This is the closing bracket for the outer Future<>
        break;
      }
    } else {
      result += char;
    }
  }

  return result.trim();
}

/**
 * Create a builtin type ID for primitive types
 */
export function create_builtin_type_id(type_name: string): TypeId {
  // Create synthetic TypeId for builtin types
  return `builtin_${type_name}` as TypeId;
}

/**
 * Create an abstract type ID for unresolved types
 */
export function create_abstract_type_id(type_name: string): TypeId {
  // Create synthetic TypeId for abstract/unresolved types
  return `abstract_${type_name}` as TypeId;
}