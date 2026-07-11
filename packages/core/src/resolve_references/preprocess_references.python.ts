import type {
  FilePath,
  SymbolReference,
  ConstructorCallReference,
  ScopeId,
  SymbolName,
  SymbolId,
} from "@ariadnejs/types";
import type { ReferenceRegistry } from "./registries/reference";
import type { DefinitionRegistry } from "./registries/definition";

interface NameResolver {
  resolve(scope_id: ScopeId, name: SymbolName): SymbolId | null;
}

/**
 * Rewrite Python class-instantiation calls into constructor calls.
 *
 * Python instantiates with plain call syntax (`MyClass()`), so the indexer
 * captures every instantiation as a `function_call`. Rewriting the ones whose
 * callee resolves to a class into `constructor_call` lets constructor type
 * binding and call resolution treat them uniformly with `new`-based languages,
 * instead of each stage re-deriving the class/function distinction.
 *
 * Mutates `references`; reads `definitions` and `resolutions`.
 */
export function preprocess_python_references(
  file_path: FilePath,
  references: ReferenceRegistry,
  definitions: DefinitionRegistry,
  resolutions: NameResolver
): void {
  const file_refs = references.get_file_references(file_path);
  if (file_refs.length === 0) return;

  const updated_refs = file_refs.map((ref): SymbolReference => {
    if (ref.kind !== "function_call") return ref;

    const resolved = resolutions.resolve(ref.scope_id, ref.name);
    if (!resolved) return ref;

    const def = definitions.get(resolved);
    if (!def || def.kind !== "class") return ref;

    const constructor_ref: ConstructorCallReference = {
      kind: "constructor_call",
      name: ref.name,
      location: ref.location,
      scope_id: ref.scope_id,
      construct_target: ref.potential_construct_target,
    };

    return constructor_ref;
  });

  references.update_file(file_path, updated_refs);
}
