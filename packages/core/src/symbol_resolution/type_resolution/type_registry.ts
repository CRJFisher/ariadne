import type { GlobalTypeRegistry, LocalTypeDefinition } from "./types";
import type { FilePath } from "@ariadnejs/types";

/**
 * Build the global type registry from local type definitions
 */
export function build_type_registry(
  type_definitions: Map<FilePath, LocalTypeDefinition[]>
): GlobalTypeRegistry {
  // TODO: Implement in later task
  throw new Error("Not implemented");
}