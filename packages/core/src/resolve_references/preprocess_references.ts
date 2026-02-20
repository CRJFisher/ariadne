/**
 * Reference Preprocessing
 *
 * Preprocesses references based on language-specific semantics.
 * Called AFTER name resolution, BEFORE type resolution.
 *
 * This enables language-specific reference transformations without
 * polluting the generic call resolution logic.
 *
 * Currently supports:
 * - Python: Converts class instantiation function_call to constructor_call
 */

import type { FilePath, Language } from "@ariadnejs/types";
import type { ReferenceRegistry } from "./registries/reference";
import type { DefinitionRegistry } from "./registries/definition";
import type { ResolutionRegistry } from "./resolve_references";
import { preprocess_python_references } from "./preprocess_references.python";

/**
 * Preprocess references based on language-specific semantics.
 *
 * Called AFTER name resolution, BEFORE type resolution.
 *
 * @param file_path - File being processed
 * @param language - Language of the file
 * @param references - Reference registry (will be mutated)
 * @param definitions - Definition registry (read-only)
 * @param resolutions - Resolution registry (read-only)
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

    // Future languages can add handlers here:
    // case "rust":
    //   preprocess_rust_references(...);
    //   break;

    default:
      // No preprocessing needed for this language
      break;
  }
}
