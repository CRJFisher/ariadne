import type { Language } from "@ariadnejs/types";
import type { MetadataExtractors } from "./types";

export function get_metadata_extractor(_language: Language): MetadataExtractors {
  // Placeholder - will be implemented as extractors are migrated
  throw new Error(`Metadata extractor not yet implemented for ${_language}`);
}

export type { MetadataExtractors, ReceiverInfo, ExtractionResult, NodeTraversal, ExtractionContext } from "./types";
