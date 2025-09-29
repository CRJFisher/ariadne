/**
 * Enhanced Method Resolution
 *
 * Uses rich semantic index data directly for improved accuracy
 */

import {
  type FilePath,
  type SymbolName,
  type SymbolId,
  type LocationKey,
  type Location,
  location_key,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { MethodAndConstructorResolutionMap } from "../types";
import { build_enhanced_context, type EnhancedMethodResolutionContext } from "./enhanced_context";
import { resolve_method_enhanced, type MethodIndex } from "./enhanced_heuristic_resolver";
import { build_method_index } from "./heuristic_resolver";

/**
 * Enhanced method and constructor resolution using rich semantic data
 */
export function resolve_methods_enhanced(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): MethodAndConstructorResolutionMap {
  const method_calls = new Map<LocationKey, SymbolId>();
  const constructor_calls = new Map<LocationKey, SymbolId>();
  const calls_to_method = new Map<SymbolId, Location[]>();

  // Build global method index for efficient lookup
  const method_index = build_method_index(indices);

  // Process each file with enhanced context
  for (const [file_path, index] of indices) {
    const file_imports = imports.get(file_path) || new Map();

    // Build enhanced context with direct semantic data
    const enhanced_context = build_enhanced_context(index, file_imports, file_path);

    // Process method calls with enhanced resolution
    if (index.references?.member_accesses) {
      for (const member_access of index.references.member_accesses) {
        if (member_access.access_type !== "method") continue;

        // Use enhanced resolution
        const resolution = resolve_method_enhanced(
          member_access,
          enhanced_context,
          method_index
        );

        if (resolution) {
          const loc_key = location_key(member_access.location);
          method_calls.set(loc_key, resolution.method_id);

          const calls = calls_to_method.get(resolution.method_id) || [];
          calls.push(member_access.location);
          calls_to_method.set(resolution.method_id, calls);

          // Log high-confidence resolutions for debugging
          if (resolution.confidence >= 0.95) {
            console.debug(
              `High-confidence resolution: ${member_access.member_name} -> ${resolution.method_id} (strategy: ${resolution.strategy}, confidence: ${resolution.confidence})`
            );
          }
        }
      }
    }

    // Process constructor calls with enhanced resolution
    if (index.local_type_flow?.constructor_calls) {
      for (const ctor_call of index.local_type_flow.constructor_calls) {
        const resolved = resolve_constructor_enhanced(
          ctor_call,
          enhanced_context,
          indices
        );

        if (resolved) {
          const loc_key = location_key(ctor_call.location);
          constructor_calls.set(loc_key, resolved);

          // Update reverse mapping
          const calls = calls_to_method.get(resolved) || [];
          calls.push(ctor_call.location);
          calls_to_method.set(resolved, calls);
        }
      }
    }
  }

  return {
    method_calls,
    constructor_calls,
    calls_to_method,
  };
}

/**
 * Enhanced constructor resolution using semantic data
 */
function resolve_constructor_enhanced(
  ctor_call: any,
  context: EnhancedMethodResolutionContext,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): SymbolId | null {
  const type_name = ctor_call.class_name;

  // Try imports first
  const imported_symbol = context.imports.get(type_name);
  if (imported_symbol) {
    // Verify it's a class
    for (const [_, index] of indices) {
      if (index.classes?.has(imported_symbol)) {
        return imported_symbol;
      }
    }
  }

  // Try local classes
  if (context.current_index.classes) {
    for (const [symbol_id, class_def] of context.current_index.classes) {
      if (class_def.name === type_name) {
        return symbol_id;
      }
    }
  }

  // Try local type info for more complex cases
  for (const type_info of context.local_types) {
    if (type_info.type_name === type_name && type_info.kind === 'class') {
      // LocalTypeInfo doesn't have symbol_id - need to look it up from the index
      // For now, return null and rely on other resolution methods
      return null;
    }
  }

  return null;
}

/**
 * Migration helper: Compare enhanced resolution with original
 */
export function compare_resolution_accuracy(
  original_results: MethodAndConstructorResolutionMap,
  enhanced_results: MethodAndConstructorResolutionMap
): void {
  const original_methods = original_results.method_calls.size;
  const enhanced_methods = enhanced_results.method_calls.size;

  console.log(`Method resolution comparison:`);
  console.log(`  Original: ${original_methods} resolved`);
  console.log(`  Enhanced: ${enhanced_methods} resolved`);
  console.log(`  Improvement: ${enhanced_methods - original_methods} additional resolutions`);

  // Find differences
  let matches = 0;
  let conflicts = 0;
  let new_resolutions = 0;

  for (const [loc_key, enhanced_id] of enhanced_results.method_calls) {
    const original_id = original_results.method_calls.get(loc_key);
    if (original_id) {
      if (original_id === enhanced_id) {
        matches++;
      } else {
        conflicts++;
        console.warn(`Conflict at ${loc_key}: original=${original_id}, enhanced=${enhanced_id}`);
      }
    } else {
      new_resolutions++;
    }
  }

  console.log(`  Matches: ${matches}`);
  console.log(`  Conflicts: ${conflicts}`);
  console.log(`  New resolutions: ${new_resolutions}`);
}