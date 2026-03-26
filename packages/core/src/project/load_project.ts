import * as fs from "fs/promises";
import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "./project";
import {
  find_source_files,
  is_supported_file,
  parse_gitignore,
} from "./file_loading";
import type { PersistenceStorage } from "../persistence/storage";
import { compute_content_hash } from "../persistence/content_hash";
import type { ContentHash } from "../persistence/content_hash";
import type { CacheManifest, CacheManifestEntry } from "../persistence/cache_manifest";
import {
  CURRENT_SCHEMA_VERSION,
  deserialize_manifest,
  serialize_manifest,
} from "../persistence/cache_manifest";
import {
  serialize_semantic_index,
  deserialize_semantic_index,
  validate_semantic_index_shape,
} from "../persistence/serialize_index";

export interface LoadProjectOptions {
  project_path: string;
  files?: string[];
  folders?: string[];
  /** Additional folder/pattern exclusions (appended to gitignore patterns for file discovery, passed to Project.initialize). */
  exclude?: string[];
  /** Optional per-file filter applied after discovery, before loading. Return true to include. */
  file_filter?: (file_path: string) => boolean;
  /** Optional persistence storage. When provided, unchanged files skip tree-sitter parsing. */
  storage?: PersistenceStorage;
}

/**
 * Resolve a path to absolute, relative to project_path.
 */
function resolve_to_absolute(
  path_input: string,
  project_path: string,
): string {
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
 *
 * When `storage` is provided, per-file SemanticIndex data is cached. On subsequent loads,
 * files whose content has not changed skip tree-sitter parsing entirely.
 */
export async function load_project(
  options: LoadProjectOptions,
): Promise<Project> {
  const {
    project_path,
    files = [],
    folders = [],
    exclude = [],
    file_filter,
    storage,
  } = options;

  const project = new Project();
  await project.initialize(
    project_path as FilePath,
    exclude.length > 0 ? exclude : undefined,
  );

  // Build gitignore + exclude patterns for file discovery
  const gitignore_patterns = await parse_gitignore(project_path);
  const discovery_patterns =
    exclude.length > 0
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
      const folder_files = await find_source_files(
        abs_folder,
        project_path,
        discovery_patterns,
      );
      for (const file of folder_files) {
        files_to_load.add(file);
      }
    }
  } else {
    const all_files = await find_source_files(
      project_path,
      project_path,
      discovery_patterns,
    );
    for (const file of all_files) {
      files_to_load.add(file);
    }
  }

  // Apply file_filter if provided
  const final_files = file_filter
    ? [...files_to_load].filter(file_filter)
    : files_to_load;

  // Load manifest if storage is provided
  let manifest: CacheManifest | null = null;
  if (storage) {
    try {
      const raw = await storage.read_manifest();
      if (raw !== null) {
        manifest = deserialize_manifest(raw);
        if (manifest && manifest.schema_version !== CURRENT_SCHEMA_VERSION) {
          console.warn(
            `[ariadne:persistence] Schema version mismatch: cached=${manifest.schema_version}, current=${CURRENT_SCHEMA_VERSION}. Ignoring cache.`,
          );
          manifest = null;
        }
      }
    } catch (error) {
      console.warn(
        `[ariadne:persistence] Failed to load cache manifest: ${
          error instanceof Error ? error.message : error
        }. Falling back to full re-index.`,
      );
    }
  }

  const manifest_entries = new Map<FilePath, CacheManifestEntry>();

  for (const file_path of final_files) {
    let content: string;
    try {
      content = await fs.readFile(file_path, "utf-8");
    } catch {
      continue; // Skip unreadable files
    }

    const fp = file_path as FilePath;
    const content_hash = storage
      ? compute_content_hash(content)
      : (null as ContentHash | null);
    let used_cache = false;

    if (storage && manifest && content_hash) {
      const cached_entry = manifest.entries.get(fp);

      if (cached_entry && cached_entry.content_hash === content_hash) {
        try {
          const raw_index = await storage.read_index(file_path);
          if (raw_index !== null) {
            const parsed = JSON.parse(raw_index);
            if (validate_semantic_index_shape(parsed)) {
              const cached_index = deserialize_semantic_index(raw_index);
              project.restore_file(fp, content, cached_index);
              used_cache = true;
            }
          }
        } catch (error) {
          console.warn(
            `[ariadne:persistence] Cache read error for ${file_path}: ${
              error instanceof Error ? error.message : error
            }. Re-indexing.`,
          );
        }
      }
    }

    if (!used_cache) {
      project.update_file(fp, content);
    }

    // Track hash for manifest (compute if not yet computed)
    if (storage && content_hash) {
      manifest_entries.set(fp, { content_hash });

      // Save newly indexed files to storage
      if (!used_cache) {
        try {
          const index = project.get_index_single_file(fp);
          if (index) {
            await storage.write_index(fp, serialize_semantic_index(index));
          }
        } catch (error) {
          console.warn(
            `[ariadne:persistence] Failed to save index for ${file_path}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }
    }
  }

  // Write updated manifest
  if (storage && manifest_entries.size > 0) {
    try {
      await storage.write_manifest(
        serialize_manifest({
          schema_version: CURRENT_SCHEMA_VERSION,
          entries: manifest_entries,
        }),
      );
    } catch (error) {
      console.warn(
        `[ariadne:persistence] Failed to save manifest: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  return project;
}
