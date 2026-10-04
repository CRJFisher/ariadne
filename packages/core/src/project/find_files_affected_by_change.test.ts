import { describe, expect, it } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import type { ImportGraph } from "../resolve_references/import_resolution/import_graph";
import { find_files_affected_by_change } from "./find_files_affected_by_change";

const leaf = "leaf.ts" as FilePath;
const barrel = "barrel.ts" as FilePath;
const consumer = "consumer.ts" as FilePath;
const unrelated = "unrelated.ts" as FilePath;

/** A graph where `consumer` imports `barrel`, which re-exports `leaf`. */
function barrel_chain(
  forwards: ReadonlySet<FilePath>,
): Pick<ImportGraph, "forwards_surface_of" | "get_importing_dependents"> {
  const importers = new Map<FilePath, FilePath[]>([[barrel, [consumer]]]);
  return {
    forwards_surface_of: (file: FilePath) => forwards.has(file),
    get_importing_dependents: (file: FilePath) => new Set(importers.get(file) ?? []),
  };
}

describe("find_files_affected_by_change", () => {
  it("carries a change across a file that re-exports the changed surface", () => {
    const affected = find_files_affected_by_change(barrel_chain(new Set([barrel])), leaf, new Set([barrel]));

    expect(affected).toEqual(new Set([leaf, barrel, consumer]));
  });

  it("stops at a dependent that only imports a name out of the changed file", () => {
    const affected = find_files_affected_by_change(barrel_chain(new Set()), leaf, new Set([barrel]));

    expect(affected).toEqual(new Set([leaf, barrel]));
    expect(affected.has(unrelated)).toBe(false);
  });
});
