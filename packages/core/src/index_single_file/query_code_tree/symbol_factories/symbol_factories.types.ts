import type { FilePath } from "@ariadnejs/types";
import type { CaptureNode } from "../../index_single_file";

/**
 * Common parameters for symbol creation
 */
export interface SymbolCreationContext {
  capture: CaptureNode;
  file_path: FilePath;
}
