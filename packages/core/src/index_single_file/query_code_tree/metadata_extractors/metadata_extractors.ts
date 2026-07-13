import type { Language } from "@ariadnejs/types";
import type { MetadataExtractors } from "./metadata_extractor_types";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.javascript";
import { TYPESCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.typescript";
import { PYTHON_METADATA_EXTRACTORS } from "./metadata_extractors.python";
import { RUST_METADATA_EXTRACTORS } from "./metadata_extractors.rust";

/**
 * Get language-specific metadata extractors
 *
 * TypeScript reuses the JavaScript extractors for most methods but overrides
 * type-annotation extraction, so it dispatches its own extractor set.
 */
export function get_metadata_extractors(
  language: Language
): MetadataExtractors | undefined {
  switch (language) {
    case "javascript":
      return JAVASCRIPT_METADATA_EXTRACTORS;
    case "typescript":
      return TYPESCRIPT_METADATA_EXTRACTORS;
    case "python":
      return PYTHON_METADATA_EXTRACTORS;
    case "rust":
      return RUST_METADATA_EXTRACTORS;
    default:
      return undefined;
  }
}
