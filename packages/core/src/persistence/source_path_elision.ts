/**
 * The blob's own source path, removed from every reference record on write and
 * put back on read.
 *
 * Every reference in a file's index names that one file two or three times
 * over: in its own `location`, inside the `scope_id` string, and again in
 * whichever receiver or assignment target it carries. Reference records are the
 * bulk of a blob's bytes and the repeated path is the bulk of those, so storing
 * the path once in the blob header and eliding it from the records is what
 * decides whether a cached checkout of a large repository costs the user's home
 * directory gigabytes or half of them.
 *
 * The transform is exact rather than lossy: a restored index compares equal to
 * the one that was written, so a file served from cache and a file indexed cold
 * produce the same call graph.
 */

import type { Location, SymbolReference } from "@ariadnejs/types";

/**
 * Every field of a `SymbolReference` that holds a `Location`. The reference
 * kinds are a closed union, so this list is exhaustive by construction; a new
 * location-valued field on that union belongs here in the same change, or its
 * path stays in the blob.
 */
const LOCATION_FIELDS = [
  "location",
  "receiver_location",
  "potential_construct_target",
  "construct_target",
  "target_location",
] as const;

/**
 * Every field of a `SymbolReference` that holds a `TypeInfo`, whose `type_id`
 * names the file the type was declared in.
 */
const TYPE_FIELDS = ["type_info", "assignment_type"] as const;

/**
 * A `ScopeId` reads `type:file_path:line:column:end_line:end_column` and a
 * `SymbolId` reads `kind:file_path:…:name`; neither leading segment contains a
 * colon, so the path occupies exactly the span between the first and second
 * colon. An elided id leaves that span empty, which is a shape a real id cannot
 * take — that is what lets the read side tell the two apart without carrying a
 * flag.
 */
function elide_id(id: string, source_path: string): string {
  const path_start = id.indexOf(":") + 1;
  if (path_start === 0) return id;
  if (!id.startsWith(source_path, path_start)) return id;
  if (id[path_start + source_path.length] !== ":") return id;
  return id.slice(0, path_start) + id.slice(path_start + source_path.length);
}

function restore_id(id: string, source_path: string): string {
  const path_start = id.indexOf(":") + 1;
  if (path_start === 0 || id[path_start] !== ":") return id;
  return id.slice(0, path_start) + source_path + id.slice(path_start);
}

function map_type_id(
  type_info: Record<string, unknown>,
  rewrite: (id: string) => string,
): Record<string, unknown> {
  if (typeof type_info.type_id !== "string") return type_info;
  return { ...type_info, type_id: rewrite(type_info.type_id) };
}

function elide_location(
  location: Location,
  source_path: string,
): Record<string, unknown> {
  if (location.file_path !== source_path) return { ...location };
  return {
    start_line: location.start_line,
    start_column: location.start_column,
    end_line: location.end_line,
    end_column: location.end_column,
  };
}

function restore_location(
  location: Record<string, unknown>,
  source_path: string,
): Record<string, unknown> {
  if (typeof location.file_path === "string") return location;
  return { file_path: source_path, ...location };
}

/** Reference records with the blob's source path removed, ready to stringify. */
export function elide_source_path(
  references: readonly SymbolReference[],
  source_path: string,
): readonly Record<string, unknown>[] {
  return references.map((reference) => {
    const elided: Record<string, unknown> = {
      ...reference,
      scope_id: elide_id(reference.scope_id, source_path),
    };
    for (const field of LOCATION_FIELDS) {
      const location = elided[field];
      if (location !== undefined) {
        elided[field] = elide_location(location as Location, source_path);
      }
    }
    for (const field of TYPE_FIELDS) {
      const type_info = elided[field];
      if (type_info !== undefined) {
        elided[field] = map_type_id(
          type_info as Record<string, unknown>,
          (id) => elide_id(id, source_path),
        );
      }
    }
    return elided;
  });
}

/** Reference records read back from a blob, with its source path put back. */
export function restore_source_path(
  references: readonly Record<string, unknown>[],
  source_path: string,
): readonly Record<string, unknown>[] {
  return references.map((reference) => {
    const restored: Record<string, unknown> = {
      ...reference,
      scope_id: restore_id(String(reference.scope_id), source_path),
    };
    for (const field of LOCATION_FIELDS) {
      const location = restored[field];
      if (location !== undefined) {
        restored[field] = restore_location(
          location as Record<string, unknown>,
          source_path,
        );
      }
    }
    for (const field of TYPE_FIELDS) {
      const type_info = restored[field];
      if (type_info !== undefined) {
        restored[field] = map_type_id(
          type_info as Record<string, unknown>,
          (id) => restore_id(id, source_path),
        );
      }
    }
    return restored;
  });
}
