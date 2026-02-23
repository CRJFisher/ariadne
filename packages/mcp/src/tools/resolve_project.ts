import { Project, load_project } from "@ariadnejs/core";
import type { ProjectManager } from "../project_manager";

/**
 * Resolve which Project to use for a tool invocation.
 *
 * When filters (files/folders) are specified, creates a scoped Project
 * containing only the filtered paths. Otherwise returns the persistent
 * ProjectManager's project (kept up-to-date via file watching).
 */
export async function resolve_project(
  args: { files?: string[]; folders?: string[] },
  project_manager: ProjectManager,
  project_path: string,
): Promise<Project> {
  const has_filters =
    (args.files && args.files.length > 0) ||
    (args.folders && args.folders.length > 0);

  if (has_filters) {
    return load_project({
      project_path,
      files: args.files,
      folders: args.folders,
    });
  }

  return project_manager.get_project();
}
