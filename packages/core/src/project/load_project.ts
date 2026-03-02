import * as fs from "fs/promises";
import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "./project";
import { find_source_files, is_supported_file, parse_gitignore } from "./file_loading";

export interface LoadProjectOptions {
  project_path: string;
  files?: string[];
  folders?: string[];
  /** Additional folder/pattern exclusions (appended to gitignore patterns for file discovery, passed to Project.initialize). */
  exclude?: string[];
  /** Optional per-file filter applied after discovery, before loading. Return true to include. */
  file_filter?: (file_path: string) => boolean;
}

/**
 * Resolve a path to absolute, relative to project_path.
 */
function resolve_to_absolute(path_input: string, project_path: string): string {
  if (path.isAbsolute(path_input)) {
    return path_input;
  }
  return path.resolve(project_path, path_input);
}

/**
 * Create and populate a Project from a path.
 *
 * When `files` or `folders` are specified, only those paths are loaded (scoped analysis).
 * Otherwise, all supported source files under `project_path` are loaded.
 */
export async function load_project(options: LoadProjectOptions): Promise<Project> {
  const { project_path, files = [], folders = [], exclude = [], file_filter } = options;

  const project = new Project();
  await project.initialize(
    project_path as FilePath,
    exclude.length > 0 ? exclude : undefined,
  );

  // Build gitignore + exclude patterns for file discovery
  const gitignore_patterns = await parse_gitignore(project_path);
  const discovery_patterns = exclude.length > 0
    ? [...gitignore_patterns, ...exclude]
    : gitignore_patterns;

  const has_filters = files.length > 0 || folders.length > 0;

  const files_to_load = new Set<string>();

  if (has_filters) {
    for (const file_path of files) {
      const abs_path = resolve_to_absolute(file_path, project_path);
      if (is_supported_file(abs_path)) {
        files_to_load.add(abs_path);
      }
    }

    for (const folder_path of folders) {
      const abs_folder = resolve_to_absolute(folder_path, project_path);
      const folder_files = await find_source_files(abs_folder, project_path, discovery_patterns);
      for (const file of folder_files) {
        files_to_load.add(file);
      }
    }
  } else {
    const all_files = await find_source_files(project_path, project_path, discovery_patterns);
    for (const file of all_files) {
      files_to_load.add(file);
    }
  }

  // Apply file_filter if provided
  const final_files = file_filter
    ? [...files_to_load].filter(file_filter)
    : files_to_load;

  for (const file_path of final_files) {
    try {
      const content = await fs.readFile(file_path, "utf-8");
      project.update_file(file_path as FilePath, content);
    } catch {
      // Skip files that can't be read
    }
  }

  return project;
}
