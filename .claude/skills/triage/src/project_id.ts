import path from "path";

import { repos_clone_id } from "./store/store_layout.js";

/** Convert a resolved project path to a collision-free identifier for file naming. */
export function path_to_project_id(project_path: string): string {
  return project_path.replace(/\//g, "-");
}

/**
 * Derive a project identifier from config fields.
 * Internal projects (project_path=".") require an explicit name.
 * A corpus that is a clone under the store's `repos/` takes the clone's
 * owner-qualified slug — the id its runs, published results and `targets.yaml`
 * are filed under. Any other external project derives the identifier from its
 * resolved absolute path.
 */
export function project_id_from_config(
  raw_project_path: string,
  explicit_name: string | undefined,
): string {
  if (raw_project_path === ".") {
    if (!explicit_name) {
      throw new Error("Internal project (project_path=\".\") requires explicit project_name");
    }
    return explicit_name;
  }
  const resolved = path.resolve(raw_project_path);
  return repos_clone_id(resolved) ?? path_to_project_id(resolved);
}
