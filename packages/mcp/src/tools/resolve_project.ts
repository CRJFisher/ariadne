import { Project, load_project } from "@ariadnejs/core";
import type { PersistenceStorage } from "@ariadnejs/core";
import type { ProjectManager } from "../project_manager";
import { path_within_project } from "./path_within_project";

/**
 * Resolve which Project to use for a tool invocation.
 *
 * When filters (files/folders) are specified, creates a scoped Project
 * containing only the filtered paths. Otherwise returns the persistent
 * ProjectManager's project (kept up-to-date via file watching).
 *
 * Throws when any supplied file or folder resolves outside `project_path` —
 * `load_project` would silently index whatever it finds at that path,
 * producing answers about a different codebase than the loaded project.
 */
export async function resolve_project(
  args: { files?: string[]; folders?: string[] },
  project_manager: Pick<ProjectManager, "get_project">,
  project_path: string,
  storage?: PersistenceStorage,
): Promise<Project> {
  const has_filters =
    (args.files && args.files.length > 0) ||
    (args.folders && args.folders.length > 0);

  if (has_filters) {
    for (const file of args.files ?? []) {
      assert_within_project(file, project_path, "files");
    }
    for (const folder of args.folders ?? []) {
      assert_within_project(folder, project_path, "folders");
    }
    return load_project({
      project_path,
      files: args.files,
      folders: args.folders,
      storage,
    });
  }

  return project_manager.get_project();
}

function assert_within_project(
  candidate: string,
  project_path: string,
  field: "files" | "folders",
): void {
  if (candidate.trim() === "") {
    throw new Error(
      `${field} entry must not be empty. Supply a path within the loaded project root '${project_path}'.`,
    );
  }
  if (!path_within_project(candidate, project_path)) {
    throw new Error(
      `${field} entry '${candidate}' is outside the loaded project root '${project_path}'. ` +
        "Configure the MCP server's PROJECT_PATH to include this path, or supply a path within the project.",
    );
  }
}
