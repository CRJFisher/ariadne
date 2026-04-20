import type { AnyDefinition, SymbolName } from "@ariadnejs/types";
import type { Project } from "../project/project";

/**
 * List every definition in the project whose name matches `name`.
 *
 * Returns all definitions unconditionally — callers decide what counts as
 * a collision (typically `length > 1`). Observational only: no filtering
 * by kind, language, or export status, since those would encode classifier
 * opinions into a facts-only API.
 */
export function list_name_collisions(
  project: Project,
  name: SymbolName
): readonly AnyDefinition[] {
  return project.definitions.get_definitions_by_name(name);
}
