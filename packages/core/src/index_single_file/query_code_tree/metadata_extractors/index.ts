import type { Language } from "@ariadnejs/types";
import type { MetadataExtractors } from "./types";
import { JAVASCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.javascript";
import { TYPESCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.typescript";
import { PYTHON_METADATA_EXTRACTORS } from "./metadata_extractors.python";
import { RUST_METADATA_EXTRACTORS } from "./metadata_extractors.rust";

export function get_metadata_extractor(language: Language): MetadataExtractors {
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
      throw new Error(`No metadata extractor for language: ${language}`);
  }
}

export type { MetadataExtractors, ReceiverInfo, ExtractionResult, NodeTraversal, ExtractionContext } from "./types";
export { JAVASCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.javascript";
export { TYPESCRIPT_METADATA_EXTRACTORS } from "./metadata_extractors.typescript";
export { PYTHON_METADATA_EXTRACTORS } from "./metadata_extractors.python";
export { RUST_METADATA_EXTRACTORS } from "./metadata_extractors.rust";
