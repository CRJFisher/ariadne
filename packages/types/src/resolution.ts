/**
 * Resolution outputs: a resolved candidate for a reference, with the
 * confidence and structured reason the resolver attached to it.
 */

import type { SymbolId } from "./symbol";

/**
 * Confidence level for symbol resolution
 */
export type ResolutionConfidence =
  | "certain"    // Definite resolution (direct or all polymorphic implementations)
  | "probable"   // High-confidence heuristic match
  | "possible";  // Lower-confidence candidate

/**
 * Structured reason for resolution
 *
 * Discriminated union allows type-safe analysis and serialization.
 */
export type ResolutionReason =
  | { type: "direct" }
  | { type: "interface_implementation"; interface_id: SymbolId }
  | { type: "collection_member"; collection_id: SymbolId; access_pattern?: string }
  | { type: "heuristic_match"; score: number };

/**
 * Single resolution candidate with metadata
 */
export interface Resolution {
  /** Resolved symbol identifier */
  symbol_id: SymbolId;

  /** Confidence level for this resolution */
  confidence: ResolutionConfidence;

  /** Structured reason explaining why this symbol was selected */
  reason: ResolutionReason;
}
