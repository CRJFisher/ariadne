/**
 * Constructor Call Resolution
 *
 * Resolves constructor calls and enriches class-resolving calls with
 * constructor references. Handles:
 * - Direct constructor calls: new ClassName(), ClassName() (Python)
 * - Inherited constructors: SubClass() where parent has __init__
 * - Post-resolution enrichment: any call resolving to a class symbol
 *   also references the constructor
 *
 * Integration points:
 * - Uses ResolutionRegistry for EAGER O(1) class name resolution
 * - Uses DefinitionRegistry to look up class definitions and constructors
 */

import type {
  SymbolId,
  SymbolName,
  SymbolReference,
  ClassDefinition,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { ResolutionRegistry } from "../resolve_references";

/**
 * Resolve a constructor call to zero, one, or more symbols
 *
 * EAGER approach: Uses pre-computed resolutions from ResolutionRegistry.
 *
 * Steps:
 * 1. Resolve class name using EAGER resolution
 * 2. Verify it's a class definition
 * 3. Return constructor symbol if exists, otherwise class symbol
 *
 * @param call_ref - Constructor call reference from semantic index
 * @param definitions - Definition registry for class lookup
 * @param resolutions - Resolution registry with eager resolutions
 * @returns Array of resolved constructor/class symbol_ids (empty if resolution fails)
 */
export function resolve_constructor_call(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  // Step 1: Resolve class name using EAGER resolution
  const class_symbol = resolutions.resolve(
    call_ref.scope_id,
    call_ref.name as SymbolName
  );

  if (!class_symbol) {
    return [];
  }

  // Step 2: Verify it's actually a class and get constructor
  const class_def = find_class_definition(class_symbol, definitions);

  if (!class_def) {
    return [];
  }

  // Step 3: Return constructor symbol if exists, otherwise class symbol
  const constructor_symbol = class_def.constructors?.[0]?.symbol_id;

  return [constructor_symbol || class_symbol];
}

/**
 * Post-resolution enrichment: add constructor references for class symbols.
 *
 * When any call resolution (method_call, function_call, constructor_call)
 * resolves to a class symbol, this function ensures the class's constructor
 * is also included in the resolved symbols. This handles cases like:
 * - module.ClassName() → resolves to class, should also reference __init__
 * - <Component /> (JSX) → resolves to class, should also reference constructor
 * - SubClass() (no own __init__) → should reference parent's __init__
 *
 * @param resolved_symbols - Symbols resolved by the primary resolution step
 * @param definitions - Definition registry for class/constructor lookup
 * @param resolutions - Resolution registry for resolving parent class names
 * @returns Enriched symbol array with constructors added for class symbols
 */
export function enrich_class_calls_with_constructors(
  resolved_symbols: SymbolId[],
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  const result = [...resolved_symbols];

  for (const sym of resolved_symbols) {
    const def = definitions.get(sym);
    if (def?.kind !== "class") continue;

    const class_def = def as ClassDefinition;
    const constructor_sym = find_constructor_in_class_hierarchy(
      class_def,
      definitions,
      resolutions
    );

    if (constructor_sym && !result.includes(constructor_sym)) {
      result.push(constructor_sym);
    }
  }

  return result;
}

/**
 * Walk the class hierarchy to find the nearest constructor.
 *
 * Checks the given class first, then walks up the extends chain
 * to find an inherited constructor. Handles:
 * - Direct constructors: class has own __init__ / constructor
 * - Inherited constructors: parent class has the constructor
 * - Cycle protection: prevents infinite loops in malformed hierarchies
 *
 * @param class_def - Class definition to start from
 * @param definitions - Definition registry for parent class lookup
 * @param resolutions - Resolution registry for resolving parent class names
 * @param visited - Set of visited class SymbolIds for cycle protection
 * @returns Constructor SymbolId or null if no constructor found in hierarchy
 */
export function find_constructor_in_class_hierarchy(
  class_def: ClassDefinition,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  visited?: Set<SymbolId>
): SymbolId | null {
  // Check this class's own constructors
  if (class_def.constructors && class_def.constructors.length > 0) {
    return class_def.constructors[0].symbol_id;
  }

  // No own constructor — walk up extends chain
  if (class_def.extends.length === 0) {
    return null;
  }

  const visited_set = visited ?? new Set<SymbolId>();
  visited_set.add(class_def.symbol_id);

  for (const parent_name of class_def.extends) {
    // Resolve parent class name in the class's defining scope
    const parent_id = resolutions.resolve(
      class_def.defining_scope_id,
      parent_name
    );
    if (!parent_id) continue;

    // Cycle protection
    if (visited_set.has(parent_id)) continue;

    const parent_def = find_class_definition(parent_id, definitions);
    if (!parent_def) continue;

    const constructor_sym = find_constructor_in_class_hierarchy(
      parent_def,
      definitions,
      resolutions,
      visited_set
    );
    if (constructor_sym) return constructor_sym;
  }

  return null;
}

/**
 * Find class definition from DefinitionRegistry.
 *
 * @param class_symbol - Class symbol ID
 * @param definitions - Definition registry
 * @returns ClassDefinition or null if not found or not a class
 */
export function find_class_definition(
  class_symbol: SymbolId,
  definitions: DefinitionRegistry
): ClassDefinition | null {
  const def = definitions.get(class_symbol);

  if (!def || def.kind !== "class") {
    return null;
  }

  return def as ClassDefinition;
}
