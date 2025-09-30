/**
 * Capture types for backward compatibility
 * These are re-exported from scope_processor for existing language configs
 */

export {
  SemanticCategory,
  SemanticEntity,
} from "./scope_processor";

import type { SyntaxNode } from "tree-sitter";

/**
 * Mapping configuration for a capture
 */
export interface CaptureMapping {
  category: SemanticCategory;
  entity: SemanticEntity;
  modifiers?: (node: SyntaxNode) => Record<string, any>;
  context?: (node: SyntaxNode) => Record<string, any>;
}

/**
 * Language-specific capture configuration
 */
export type LanguageCaptureConfig = Map<string, CaptureMapping>;