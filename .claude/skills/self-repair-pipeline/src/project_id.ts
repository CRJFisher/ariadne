import path from "path";

/** Convert a resolved project path to a collision-free identifier for file naming. */
export function path_to_project_id(project_path: string): string {
  return project_path.replace(/\//g, "-");
}

/**
 * Derive a project identifier from config fields.
 * Internal projects (project_path=".") require an explicit name.
 * External projects derive the identifier from the resolved absolute path.
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
  return path_to_project_id(path.resolve(raw_project_path));
}
