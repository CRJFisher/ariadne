import type { TypeHierarchyGraph, LocalTypeDefinition } from "./types";
import type { TypeId, FilePath } from "@ariadnejs/types";

/**
 * Resolve type inheritance chains
 */
export function resolve_inheritance(
  type_definitions: Map<FilePath, LocalTypeDefinition[]>,
  type_registry: Map<string, TypeId>
): TypeHierarchyGraph {
  // TODO: Implement in later task
  throw new Error("Not implemented");
}