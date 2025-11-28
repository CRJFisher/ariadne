import type { FilePath } from "@ariadnejs/types";
import type { CaptureNode } from "../../semantic_index";

/**
 * Common parameters for symbol creation
 */
export interface SymbolCreationContext {
  capture: CaptureNode;
  file_path: FilePath;
}
