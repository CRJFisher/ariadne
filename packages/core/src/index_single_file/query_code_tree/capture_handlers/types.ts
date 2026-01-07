import type { DefinitionBuilder } from "../../definitions/definitions";
import type { CaptureNode, ProcessingContext } from "../../index_single_file";

/**
 * Handler function signature for processing tree-sitter captures
 */
export type HandlerFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

/**
 * Registry mapping capture names to handler functions
 * Uses object literal (not Map) to preserve call graph traceability
 */
export type HandlerRegistry = Readonly<Record<string, HandlerFunction>>;
