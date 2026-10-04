import type { FilePath } from "@ariadnejs/types";
import type { ImportGraph } from "../resolve_references/import_resolution/import_graph";

/**
 * Every file whose resolutions a change to `file_id` can alter: the file
 * itself, its direct dependents, and — transitively — the dependents of any
 * dependent that puts the changed file's surface onward rather than importing
 * one name out of it. That second hop is the barrel chain, where a leaf's
 * names reach consumers only through re-exporting files, and the Rust `mod`
 * chain, where `crate::a::b::item` reaches through `a.rs` into `b.rs`.
 *
 * Only importers are carried across that hop: a file that reached the changed
 * file through a `::` path already holds a direct edge to every module file
 * its path read, so it is a leaf of this walk rather than another hub.
 */
export function find_files_affected_by_change(
  imports: ImportGraph,
  file_id: FilePath,
  dependents: Set<FilePath>,
): Set<FilePath> {
  const affected_files = new Set([file_id, ...dependents]);
  const frontier = [...dependents].map((dependent) => ({
    file: dependent,
    source: file_id,
  }));

  for (let next = frontier.pop(); next !== undefined; next = frontier.pop()) {
    const { file, source } = next;
    if (!imports.forwards_surface_of(file, source)) {
      continue;
    }
    for (const dependent of imports.get_importing_dependents(file)) {
      if (!affected_files.has(dependent)) {
        affected_files.add(dependent);
        frontier.push({ file: dependent, source: file });
      }
    }
  }

  return affected_files;
}
