import { describe, expect, it } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { ImportGraph } from "../resolve_references/import_resolution/import_graph";
import { find_files_affected_by_change } from "./find_files_affected_by_change";

const leaf = "leaf.ts" as FilePath;
const barrel = "barrel.ts" as FilePath;
const consumer = "consumer.ts" as FilePath;
const unrelated = "unrelated.ts" as FilePath;

/** A graph where `consumer` imports `barrel`, which re-exports `leaf` when `forwards` holds it. */
class BarrelChain extends ImportGraph {
  constructor(private readonly forwards: ReadonlySet<FilePath>) {
    super();
  }

  override forwards_surface_of(file: FilePath): boolean {
    return this.forwards.has(file);
  }

  override get_importing_dependents(file: FilePath): Set<FilePath> {
    return file === barrel ? new Set([consumer]) : new Set();
  }
}

function barrel_chain(forwards: ReadonlySet<FilePath>): ImportGraph {
  return new BarrelChain(forwards);
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
