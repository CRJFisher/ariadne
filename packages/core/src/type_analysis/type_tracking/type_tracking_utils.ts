/**
 * Type tracking utility functions
 * 
 * Batch operations and type utilities for the type tracking module
 */

import { Language } from '@ariadnejs/types';
import {
  FileTypeTracker,
  TypeInfo,
  set_variable_type,
  mark_as_exported,
} from './type_tracking';

/**
 * Batch set multiple variable types
 */
export function set_variable_types(
  tracker: FileTypeTracker,
  types: Map<string, TypeInfo>
): FileTypeTracker {
  let updated = tracker;
  for (const [name, info] of types) {
    updated = set_variable_type(updated, name, info);
  }
  return updated;
}

/**
 * Batch mark multiple definitions as exported
 */
export function mark_as_exported_batch(
  tracker: FileTypeTracker,
  names: string[]
): FileTypeTracker {
  let updated = tracker;
  for (const name of names) {
    updated = mark_as_exported(updated, name);
  }
  return updated;
}

/**
 * Determine type kind from type name
 */
export function infer_type_kind(type_name: string, language: Language): TypeInfo['type_kind'] {
  // Primitive types
  const primitives = ['string', 'number', 'boolean', 'null', 'undefined', 'void', 'any', 'unknown'];
  if (primitives.includes(type_name.toLowerCase())) {
    return 'primitive';
  }
  
  // Array types
  if (type_name.endsWith('[]') || type_name.startsWith('Array<')) {
    return 'array';
  }
  
  // Object/class types
  if (type_name[0] === type_name[0].toUpperCase()) {
    return 'class';
  }
  
  return 'unknown';
}

/**
 * Check if two types are assignable
 */
export function is_type_assignable(
  from: TypeInfo,
  to: TypeInfo,
  language: Language
): boolean {
  // Same type is always assignable
  if (from.type_name === to.type_name) {
    return true;
  }
  
  // Any/unknown handling
  if (to.type_name === 'any' || to.type_name === 'unknown') {
    return true;
  }
  
  // Null/undefined handling
  if (from.type_name === 'null' || from.type_name === 'undefined') {
    return to.type_kind === 'primitive' || to.type_name === 'any';
  }
  
  // Array covariance
  if (from.type_kind === 'array' && to.type_kind === 'array') {
    return true; // Simplified - would need element type checking
  }
  
  // Class inheritance would require more context
  if (from.type_kind === 'class' && to.type_kind === 'class') {
    return false; // Would need inheritance chain
  }
  
  return false;
}