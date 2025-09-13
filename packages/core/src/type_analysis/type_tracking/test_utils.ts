/**
 * Test utilities for type tracking
 * 
 * These functions are only used in tests and are not part of the public API
 */

import { FileTypeTracker } from './type_tracking';
import { Location, TypeInfo } from '@ariadnejs/types';

/**
 * Get the type of a variable at a specific position
 * Used only for testing purposes
 */
export function get_variable_type(
  tracker: FileTypeTracker,
  var_name: string,
  location?: Location
): TypeInfo | undefined {
  // First try to find in variable_types by looking for any SymbolId ending with the variable name
  for (const [symbol_id, type_info] of tracker.variable_types) {
    const parts = symbol_id.split(':');
    const name = parts.length > 7 ? parts[7] : parts[6];
    if (name === var_name) {
      // For now, just return the type_info directly if no location is specified
      if (!location) return type_info;
      
      // Check if the location matches
      if (type_info.location.line <= location.line) {
        return type_info;
      }
    }
  }
  
  // Fallback to legacy_types if available
  const legacy_list = tracker.legacy_types?.get(var_name);
  if (!legacy_list || legacy_list.length === 0) return undefined;
  
  // Convert legacy type info to TypeInfo
  const types = legacy_list.map(lt => ({
    type_name: lt.type_name as any,
    type_kind: lt.type_kind as any || 'unknown',
    location: lt.location,
    confidence: lt.confidence as any || 'assumed',
    source: lt.source,
  }));

  // If no location specified, return the latest type
  if (!location) {
    // Return the last type in the array (most recent)
    return types[types.length - 1];
  }

  // Find the type that was assigned before this position
  let last_type: TypeInfo | undefined = undefined;
  let explicit_type: TypeInfo | undefined = undefined;

  for (const type_info of types) {
    if (
      type_info.location.line > location.line ||
      (type_info.location.line === location.line &&
        type_info.location.column > location.column)
    ) {
      break;
    }
    last_type = type_info;

    // Track explicit annotations separately
    if (
      type_info.confidence === "explicit" &&
      type_info.source === "annotation"
    ) {
      explicit_type = type_info;
    }
  }

  // Prefer explicit type annotations over inferred types
  return explicit_type || last_type;
}

/**
 * Check if two types are assignable (test helper)
 */
export function is_type_assignable(
  from_type: TypeInfo,
  to_type: TypeInfo,
  language: string
): boolean {
  // Same type is always assignable
  if (from_type.type_name === to_type.type_name) {
    return true;
  }

  // Any can be assigned to/from anything
  if (from_type.type_name === 'any' || to_type.type_name === 'any') {
    return true;
  }

  // Unknown can accept anything but can't be assigned to specific types
  if (to_type.type_name === 'unknown') {
    return true;
  }

  // Null/undefined handling (TypeScript/JavaScript)
  if (language === 'typescript' || language === 'javascript') {
    // In strict mode, null/undefined are not assignable to other types
    // For simplicity, we'll assume strict mode
    if (
      (from_type.type_name === 'null' || from_type.type_name === 'undefined') &&
      to_type.type_name !== 'null' &&
      to_type.type_name !== 'undefined'
    ) {
      return false;
    }
  }

  return false;
}