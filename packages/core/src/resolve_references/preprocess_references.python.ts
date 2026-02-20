/**
 * Python Reference Preprocessing
 *
 * Preprocesses Python references to convert class instantiation calls
 * to constructor calls.
 *
 * Python uses function call syntax for class instantiation (MyClass()).
 * This converts such calls to constructor_call references when the
 * callee resolves to a class definition, enabling:
 * - Proper type binding via extract_constructor_bindings()
 * - Uniform handling in resolve_calls() without special cases
 */

import type {
  FilePath,
  SymbolReference,
  FunctionCallReference,
  ConstructorCallReference,
} from "@ariadnejs/types";
import type { ReferenceRegistry } from "./registries/reference";
import type { DefinitionRegistry } from "./registries/definition";
import type { ResolutionRegistry } from "./resolve_references";

/**
 * Preprocess Python references to convert class instantiation calls
 * to constructor calls.
 *
 * For each function_call reference:
 * 1. Resolve the callee name to a symbol
 * 2. Check if the symbol is a class definition
 * 3. If so, convert to constructor_call with construct_target
 *
 * @param file_path - File being processed
 * @param references - Reference registry (will be mutated)
 * @param definitions - Definition registry (read-only)
 * @param resolutions - Resolution registry (read-only)
 */
export function preprocess_python_references(
  file_path: FilePath,
  references: ReferenceRegistry,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): void {
  const file_refs = references.get_file_references(file_path);
  if (file_refs.length === 0) return;

  const updated_refs = file_refs.map((ref): SymbolReference => {
    // Only process function_call references
    if (ref.kind !== "function_call") return ref;

    const func_ref = ref as FunctionCallReference;

    // Resolve the callee name
    const resolved = resolutions.resolve(ref.scope_id, ref.name);
    if (!resolved) return ref;

    // Check if it's a class definition
    const def = definitions.get(resolved);
    if (!def || def.kind !== "class") return ref;

    // Convert to constructor_call
    const constructor_ref: ConstructorCallReference = {
      kind: "constructor_call",
      name: ref.name,
      location: ref.location,
      scope_id: ref.scope_id,
      construct_target: func_ref.potential_construct_target,
    };

    return constructor_ref;
  });

  // Update the registry with preprocessed references
  references.update_file(file_path, updated_refs);
}
