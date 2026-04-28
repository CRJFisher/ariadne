/**
 * Folder preview for first-time project-config setup.
 *
 * Walks the project directory up to a bounded depth and returns one entry per
 * descendant directory with source-file counts. Skips paths the indexer would
 * already exclude (`IGNORED_DIRECTORIES`, `.gitignore`) so the caller sees
 * only directories that would actually be indexed.
 */

import * as path from "path";

import { find_source_files } from "@ariadnejs/core";

export interface FolderPreview {
  relative_path: string;
  depth: number;
  file_count_recursive: number;
  file_count_direct: number;
}

export interface FolderPreviewResult {
  project_path: string;
  max_depth: number;
  total_source_files: number;
  directories: FolderPreview[];
}

export const DEFAULT_MAX_DEPTH = 5;

interface PreviewFoldersOptions {
  project_path: string;
  max_depth?: number;
}

export async function preview_folders(
  opts: PreviewFoldersOptions,
): Promise<FolderPreviewResult> {
  const project_path = path.resolve(opts.project_path);
  const max_depth = opts.max_depth ?? DEFAULT_MAX_DEPTH;

  const source_files = await find_source_files(project_path, project_path);

  const accumulators = new Map<string, FolderPreview>();
  for (const file_path of source_files) {
    const relative = path.relative(project_path, file_path);
    const parts = relative.split(path.sep);
    const leaf_depth = parts.length - 1;
    const upper = Math.min(leaf_depth, max_depth);
    for (let d = 1; d <= upper; d++) {
      const dir_relative = parts.slice(0, d).join(path.sep);
      let entry = accumulators.get(dir_relative);
      if (entry === undefined) {
        entry = {
          relative_path: dir_relative,
          depth: d,
          file_count_direct: 0,
          file_count_recursive: 0,
        };
        accumulators.set(dir_relative, entry);
      }
      entry.file_count_recursive += 1;
      if (d === leaf_depth) entry.file_count_direct += 1;
    }
  }

  const directories = [...accumulators.values()].sort((a, b) => {
    if (b.file_count_recursive !== a.file_count_recursive) {
      return b.file_count_recursive - a.file_count_recursive;
    }
    return a.relative_path.localeCompare(b.relative_path, "en");
  });

  return {
    project_path,
    max_depth,
    total_source_files: source_files.length,
    directories,
  };
}
