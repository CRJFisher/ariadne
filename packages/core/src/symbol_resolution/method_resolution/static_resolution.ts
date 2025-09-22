/**
 * Static vs instance method resolution
 *
 * Determines whether a method call is static or instance
 */

import type {
  SymbolId,
  Location,
} from "@ariadnejs/types";
import type { MemberAccessReference } from "../../semantic_index/references/member_access_references/member_access_references";
import type { MethodLookupContext } from "./method_types";
import { find_symbol_definition } from "./type_lookup";

/**
 * Determine if a member access is a static call
 */
export function determine_if_static_call(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): boolean {
  // 1. Check if member access is explicitly marked as static
  if (member_access.is_static_access === true) {
    return true;
  }

  // 2. Check if receiver is a type identifier rather than instance
  const receiver_symbol = find_symbol_at_location(
    member_access.object.location,
    context
  );

  if (receiver_symbol) {
    const symbol_def = context.current_index.symbols.get(receiver_symbol);
    if (symbol_def && (symbol_def.kind === "class" || symbol_def.kind === "type_alias" || symbol_def.kind === "interface")) {
      return true; // Calling method on class/type directly
    }
  }

  // 3. Default to instance method
  return false;
}

/**
 * Get the kind of a method symbol
 */
export function get_method_kind(
  method_symbol: SymbolId,
  context: MethodLookupContext
): "instance" | "static" | "constructor" {
  const symbol_def = find_symbol_definition(method_symbol, context);
  if (!symbol_def) {
    return "instance"; // Default
  }

  if (symbol_def.kind === "constructor") {
    return "constructor";
  }

  // Check for static modifier if it exists on this symbol type
  if ('modifiers' in symbol_def && Array.isArray(symbol_def.modifiers)) {
    if (symbol_def.modifiers.includes("static")) {
      return "static";
    }
  }

  return "instance";
}

/**
 * Find symbol at a specific location
 */
export function find_symbol_at_location(
  location: Location | undefined,
  context: MethodLookupContext
): SymbolId | null {
  if (!location) {
    return null;
  }

  // Find symbol definition that contains this location
  for (const [symbol_id, symbol_def] of context.current_index.symbols) {
    if (locations_overlap(symbol_def.location, location)) {
      return symbol_id;
    }
  }
  return null;
}

/**
 * Check if two locations overlap
 */
function locations_overlap(loc1: Location, loc2: Location): boolean {
  return (
    loc1.file_path === loc2.file_path &&
    loc1.line <= loc2.end_line &&
    loc1.end_line >= loc2.line
  );
}