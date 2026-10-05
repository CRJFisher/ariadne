import type { FilePath, Language } from "@ariadnejs/types";
import type { ReferenceRegistry } from "./registries/reference";
import type { DefinitionRegistry } from "./registries/definition";
import type { ResolutionRegistry } from "./resolution_registry";
import { preprocess_python_references } from "./preprocess_references.python";

/**
 * Rewrite references in place to reflect language-specific call semantics
 * before call resolution runs. Languages with no rewrites are a no-op.
 *
 * Runs after name resolution (so callees can be classified) and before type
 * resolution (so rewritten references feed type binding).
 *
 * `references` is mutated; `definitions` and `resolutions` are read-only.
 */
export function preprocess_references(
  file_path: FilePath,
  language: Language,
  references: ReferenceRegistry,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): void {
  switch (language) {
    case "python":
      preprocess_python_references(
        file_path,
        references,
        definitions,
        resolutions
      );
      break;
    default:
      break;
  }
}
