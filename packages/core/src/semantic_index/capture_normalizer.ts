/**
 * Capture normalizer - converts language-specific captures to normalized format
 */

import type { QueryCapture } from "tree-sitter";
import type { Language, FilePath } from "@ariadnejs/types";
import type { NormalizedCapture, LanguageCaptureConfig } from "./capture_types";
import { JAVASCRIPT_CAPTURE_CONFIG } from "./language_configs/javascript";
import { TYPESCRIPT_CAPTURE_CONFIG } from "./language_configs/typescript";
import { PYTHON_CAPTURE_CONFIG } from "./language_configs/python";
import { RUST_CAPTURE_CONFIG } from "./language_configs/rust";
import { node_to_location } from "../utils/node_utils";

/**
 * Language configuration map
 */
const LANGUAGE_CONFIGS: Map<Language, LanguageCaptureConfig> = new Map([
  ["javascript", JAVASCRIPT_CAPTURE_CONFIG],
  ["typescript", TYPESCRIPT_CAPTURE_CONFIG],
  ["python", PYTHON_CAPTURE_CONFIG],
  ["rust", RUST_CAPTURE_CONFIG],
]);

/**
 * Normalize tree-sitter captures to semantic format
 */
export function normalize_captures(
  captures: QueryCapture[],
  language: Language,
  file_path: FilePath
): NormalizedCapture[] {
  const config = LANGUAGE_CONFIGS.get(language);
  if (!config) {
    throw new Error(`No capture configuration for language: ${language}`);
  }

  const normalized: NormalizedCapture[] = [];

  for (const capture of captures) {
    const mapping = config.get(capture.name);

    // Skip unmapped captures (they might be internal helpers)
    if (!mapping) {
      continue;
    }

    const normalized_capture: NormalizedCapture = {
      category: mapping.category,
      entity: mapping.entity,
      node_location: node_to_location(capture.node, file_path),
      text: capture.node.text,
      modifiers: mapping.modifiers?.(capture.node) || {},
      context: mapping.context?.(capture.node),
    };

    normalized.push(normalized_capture);
  }

  return normalized;
}

/**
 * Group normalized captures by category
 */
export function group_captures_by_category(captures: NormalizedCapture[]): {
  scopes: NormalizedCapture[];
  definitions: NormalizedCapture[];
  references: NormalizedCapture[];
  imports: NormalizedCapture[];
  exports: NormalizedCapture[];
  types: NormalizedCapture[];
  assignments: NormalizedCapture[];
  returns: NormalizedCapture[];
  decorators: NormalizedCapture[];
  modifiers: NormalizedCapture[];
} {
  const grouped = {
    scopes: [] as NormalizedCapture[],
    definitions: [] as NormalizedCapture[],
    references: [] as NormalizedCapture[],
    imports: [] as NormalizedCapture[],
    exports: [] as NormalizedCapture[],
    types: [] as NormalizedCapture[],
    assignments: [] as NormalizedCapture[],
    returns: [] as NormalizedCapture[],
    decorators: [] as NormalizedCapture[],
    modifiers: [] as NormalizedCapture[],
  };

  for (const capture of captures) {
    switch (capture.category) {
      case "scope":
        grouped.scopes.push(capture);
        break;
      case "definition":
        grouped.definitions.push(capture);
        break;
      case "reference":
        grouped.references.push(capture);
        break;
      case "import":
        grouped.imports.push(capture);
        break;
      case "export":
        grouped.exports.push(capture);
        break;
      case "type":
        grouped.types.push(capture);
        break;
      case "assignment":
        grouped.assignments.push(capture);
        break;
      case "return":
        grouped.returns.push(capture);
        break;
      case "decorator":
        grouped.decorators.push(capture);
        break;
      case "modifier":
        grouped.modifiers.push(capture);
        break;
    }
  }

  return grouped;
}
