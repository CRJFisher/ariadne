import type { LocalTypeAnnotation } from "./types";
import type { TypeId, SymbolName, FilePath } from "@ariadnejs/types";

/**
 * Resolve type annotation strings to TypeIds
 */
export function resolve_type_annotations(
  annotations: LocalTypeAnnotation[],
  type_names: Map<FilePath, Map<SymbolName, TypeId>>
): Map<string, TypeId> {
  // TODO: Implement in later task
  throw new Error("Not implemented");
}