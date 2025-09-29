/**
 * Rust pattern matching resolution
 *
 * Handles match expressions, if-let, while-let, destructuring patterns, and pattern-bound variables
 */

import type { Location, LocationKey, TypeId, SymbolId } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../../index_single_file/semantic_index";
import type { TypeResolutionMap } from "../../types";
import type { NormalizedCapture } from "../../../index_single_file/capture_types";
import {
  SemanticEntity,
  SemanticCategory,
} from "../../../index_single_file/capture_types";
import { appears_to_be_rust_code, locations_are_near } from "./rust_type_utils";

/**
 * Pattern matching information
 */
export interface PatternMatchInfo {
  pattern_type:
    | "match_arm"
    | "if_let"
    | "while_let"
    | "for_loop"
    | "let_destructure";
  bound_variables: SymbolId[];
  matched_type?: TypeId;
  destructure_type?: "struct" | "tuple" | "enum" | "slice";
  location: Location;
}

/**
 * Resolve pattern matching constructs and bound variables
 */
export function resolve_pattern_matching(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): Map<LocationKey, PatternMatchInfo> {
  const pattern_matches = new Map<LocationKey, PatternMatchInfo>();

  // Only process if this appears to be Rust code
  if (!appears_to_be_rust_code(index)) {
    return pattern_matches;
  }

  // Safe iteration over references
  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return pattern_matches;
  }

  // Process match arms
  for (const ref of all_references) {
    if (ref.capture_name === "pattern.match_arm" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "match_arm",
        bound_variables: bound_vars,
        location: ref.location,
      });
    }

    // Process if-let expressions
    if (ref.capture_name === "pattern.if_let" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      const matched_type = resolve_if_let_matched_type(
        ref,
        all_references,
        type_resolution
      );
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "if_let",
        bound_variables: bound_vars,
        matched_type,
        location: ref.location,
      });
    }

    // Process while-let expressions
    if (ref.capture_name === "pattern.while_let" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      const matched_type = resolve_while_let_matched_type(
        ref,
        all_references,
        type_resolution
      );
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "while_let",
        bound_variables: bound_vars,
        matched_type,
        location: ref.location,
      });
    }

    // Process struct destructuring
    if (ref.capture_name === "pattern.struct_destructure" && ref.location) {
      const bound_vars = find_struct_destructure_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "let_destructure",
        bound_variables: bound_vars,
        destructure_type: "struct",
        location: ref.location,
      });
    }

    // Process tuple destructuring
    if (ref.capture_name === "pattern.tuple_destructure" && ref.location) {
      const bound_vars = find_tuple_destructure_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "let_destructure",
        bound_variables: bound_vars,
        destructure_type: "tuple",
        location: ref.location,
      });
    }
  }

  return pattern_matches;
}

/**
 * Find variables bound by a pattern
 */
function find_pattern_bound_variables(
  pattern_ref: NormalizedCapture,
  all_references: NormalizedCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Look for variable.pattern captures near this pattern location
  for (const ref of all_references) {
    if (
      ref.capture_name === "variable.pattern" &&
      ref.location &&
      pattern_ref.location &&
      locations_are_near(ref.location, pattern_ref.location)
    ) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Find variables bound by struct destructuring
 */
function find_struct_destructure_variables(
  struct_pattern: NormalizedCapture,
  all_references: NormalizedCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Look for pattern variables within the struct destructuring location
  for (const ref of all_references) {
    if (
      ref.entity === SemanticEntity.VARIABLE &&
      ref.category === SemanticCategory.DEFINITION &&
      ref.location &&
      struct_pattern.location &&
      locations_are_near(ref.location, struct_pattern.location)
    ) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Find variables bound by tuple destructuring
 */
function find_tuple_destructure_variables(
  tuple_pattern: NormalizedCapture,
  all_references: NormalizedCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Similar to struct destructuring but for tuple patterns
  for (const ref of all_references) {
    if (
      ref.entity === SemanticEntity.VARIABLE &&
      ref.category === SemanticCategory.DEFINITION &&
      ref.location &&
      tuple_pattern.location &&
      locations_are_near(ref.location, tuple_pattern.location)
    ) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Resolve the type being matched in if-let expressions
 */
function resolve_if_let_matched_type(
  if_let_pattern: NormalizedCapture,
  all_references: NormalizedCapture[],
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // Look for the corresponding if_let_value capture
  for (const ref of all_references) {
    if (
      ref.capture_name === "pattern.if_let_value" &&
      ref.location &&
      if_let_pattern.location &&
      locations_are_near(ref.location, if_let_pattern.location)
    ) {
      // Try to resolve the type of the value being matched
      const value_type = type_resolution.reference_types.get(
        location_key(ref.location)
      );
      if (value_type) {
        return value_type;
      }
    }
  }

  return undefined;
}

/**
 * Resolve the type being matched in while-let expressions
 */
function resolve_while_let_matched_type(
  while_let_pattern: NormalizedCapture,
  all_references: NormalizedCapture[],
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // Look for the corresponding while_let_value capture
  for (const ref of all_references) {
    if (
      ref.capture_name === "pattern.while_let_value" &&
      ref.location &&
      while_let_pattern.location &&
      locations_are_near(ref.location, while_let_pattern.location)
    ) {
      // Try to resolve the type of the value being matched
      const value_type = type_resolution.reference_types.get(
        location_key(ref.location)
      );
      if (value_type) {
        return value_type;
      }
    }
  }

  return undefined;
}

/**
 * Resolve pattern-conditional method calls
 * These are method calls that happen within pattern match arms or if-let/while-let blocks
 */
export function resolve_pattern_conditional_calls(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  pattern_matches: Map<LocationKey, PatternMatchInfo>
): Map<
  LocationKey,
  { method_call: LocationKey; pattern_context: PatternMatchInfo }
> {
  const conditional_calls = new Map<
    LocationKey,
    { method_call: LocationKey; pattern_context: PatternMatchInfo }
  >();

  if (!appears_to_be_rust_code(index) || !index.references?.calls) {
    return conditional_calls;
  }

  // Look for method calls within pattern match contexts
  for (const call of index.references.calls) {
    if (call.location) {
      const call_key = location_key(call.location);

      // Find if this call is within any pattern context
      for (const [pattern_key, pattern_info] of pattern_matches) {
        if (call_is_in_pattern_scope(call.location, pattern_info)) {
          conditional_calls.set(call_key, {
            method_call: call_key,
            pattern_context: pattern_info,
          });
          break;
        }
      }
    }
  }

  return conditional_calls;
}

/**
 * Check if a method call is within a pattern match scope
 */
function call_is_in_pattern_scope(
  call_location: Location,
  pattern_info: PatternMatchInfo
): boolean {
  // Simple heuristic: call is after the pattern and within reasonable distance
  return (
    call_location.file_path === pattern_info.location.file_path &&
    call_location.start_line >= pattern_info.location.start_line &&
    call_location.start_line <= pattern_info.location.start_line + 10
  ); // Reasonable scope distance
}

/**
 * Integrate pattern matching information into the main type resolution
 */
export function integrate_pattern_matching_into_type_resolution(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeResolutionMap {
  if (!appears_to_be_rust_code(index)) {
    return type_resolution;
  }

  const pattern_matches = resolve_pattern_matching(index, type_resolution);
  const conditional_calls = resolve_pattern_conditional_calls(
    index,
    type_resolution,
    pattern_matches
  );

  // Create enhanced type resolution with pattern information
  // For now, we'll extend the existing maps rather than create new interfaces
  // In a complete implementation, this would need dedicated pattern-aware type maps

  const enhanced_symbol_types = new Map(type_resolution.symbol_types);
  const enhanced_reference_types = new Map(type_resolution.reference_types);

  // Process pattern-bound variables and their types
  for (const [pattern_key, pattern_info] of pattern_matches) {
    // If we know the matched type, assign it to bound variables
    if (pattern_info.matched_type) {
      for (const var_id of pattern_info.bound_variables) {
        enhanced_symbol_types.set(var_id, pattern_info.matched_type);
      }
    }

    // For destructuring patterns, we'd need to resolve field types
    // This would require more sophisticated type analysis
  }

  return {
    ...type_resolution,
    symbol_types: enhanced_symbol_types as ReadonlyMap<SymbolId, TypeId>,
    reference_types: enhanced_reference_types as ReadonlyMap<
      LocationKey,
      TypeId
    >,
  };
}
