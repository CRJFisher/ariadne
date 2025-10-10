import { describe, it, expect, beforeEach } from "vitest";
import { ImportGraph } from "./import_graph";
import type { FilePath, Import, SymbolName } from "@ariadnejs/types";

// Helper to create a simple named import for testing
function create_import(source: FilePath, file: FilePath): Import {
  return {
    kind: "named",
    source,
    imports: [
      {
        name: "foo" as SymbolName,
        is_type_only: false,
      },
    ],
    location: {
      file_path: file,
      start_line: 1,
      start_column: 0,
      end_line: 1,
      end_column: 10,
    },
    language: "typescript",
    node_type: "import_statement",
    modifiers: [],
  };
}

describe("ImportGraph", () => {
  let graph: ImportGraph;

  beforeEach(() => {
    graph = new ImportGraph();
  });

  describe("update_file", () => {
    it("should add import relationships", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      const imports: Import[] = [create_import(file2, file1)];

      graph.update_file(file1, imports);

      expect(graph.get_dependencies(file1).has(file2)).toBe(true);
      expect(graph.get_dependents(file2).has(file1)).toBe(true);
    });

    it("should handle multiple imports", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      const imports: Import[] = [
        create_import(file2, file1),
        create_import(file3, file1),
      ];

      graph.update_file(file1, imports);

      const deps = graph.get_dependencies(file1);
      expect(deps.size).toBe(2);
      expect(deps.has(file2)).toBe(true);
      expect(deps.has(file3)).toBe(true);
    });

    it("should replace imports when file is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // First version: imports file2
      graph.update_file(file1, [create_import(file2, file1)]);

      expect(graph.get_dependencies(file1).has(file2)).toBe(true);
      expect(graph.get_dependents(file2).has(file1)).toBe(true);

      // Second version: imports file3 instead
      graph.update_file(file1, [create_import(file3, file1)]);

      expect(graph.get_dependencies(file1).has(file2)).toBe(false);
      expect(graph.get_dependencies(file1).has(file3)).toBe(true);
      expect(graph.get_dependents(file2).has(file1)).toBe(false);
      expect(graph.get_dependents(file3).has(file1)).toBe(true);
    });

    it("should handle empty imports", () => {
      const file1 = "file1.ts" as FilePath;

      graph.update_file(file1, []);

      expect(graph.get_dependencies(file1).size).toBe(0);
    });

    it("should deduplicate imports to same file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // Multiple imports from the same file
      const imports: Import[] = [
        create_import(file2, file1),
        create_import(file2, file1),
      ];

      graph.update_file(file1, imports);

      const deps = graph.get_dependencies(file1);
      expect(deps.size).toBe(1);
      expect(deps.has(file2)).toBe(true);
    });
  });

  describe("get_dependencies", () => {
    it("should return empty set for file with no imports", () => {
      const file1 = "file1.ts" as FilePath;
      expect(graph.get_dependencies(file1).size).toBe(0);
    });

    it("should return a copy of the set", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      const deps1 = graph.get_dependencies(file1);
      const deps2 = graph.get_dependencies(file1);

      expect(deps1).not.toBe(deps2);  // Different objects
      expect(deps1).toEqual(deps2);   // Same content
    });
  });

  describe("get_dependents", () => {
    it("should return empty set for file with no dependents", () => {
      const file1 = "file1.ts" as FilePath;
      expect(graph.get_dependents(file1).size).toBe(0);
    });

    it("should return all files importing from a file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // Both file2 and file3 import from file1
      graph.update_file(file2, [create_import(file1, file2)]);
      graph.update_file(file3, [create_import(file1, file3)]);

      const dependents = graph.get_dependents(file1);
      expect(dependents.size).toBe(2);
      expect(dependents.has(file2)).toBe(true);
      expect(dependents.has(file3)).toBe(true);
    });
  });

  describe("get_transitive_dependencies", () => {
    it("should find all transitive dependencies", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // file1 → file2 → file3
      graph.update_file(file1, [create_import(file2, file1)]);
      graph.update_file(file2, [create_import(file3, file2)]);

      const transitive = graph.get_transitive_dependencies(file1);
      expect(transitive.size).toBe(2);
      expect(transitive.has(file2)).toBe(true);
      expect(transitive.has(file3)).toBe(true);
    });

    it("should handle cycles gracefully", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // file1 → file2 → file1 (cycle)
      graph.update_file(file1, [create_import(file2, file1)]);
      graph.update_file(file2, [create_import(file1, file2)]);

      // Should not hang
      const transitive = graph.get_transitive_dependencies(file1);
      expect(transitive.has(file2)).toBe(true);
      expect(transitive.has(file1)).toBe(false);  // Shouldn't include self
    });

    it("should handle complex dependency chains", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;
      const file4 = "file4.ts" as FilePath;
      const file5 = "file5.ts" as FilePath;

      // file1 → file2 → file4
      //      ↘ file3 → file5
      graph.update_file(file1, [create_import(file2, file1), create_import(file3, file1)]);
      graph.update_file(file2, [create_import(file4, file2)]);
      graph.update_file(file3, [create_import(file5, file3)]);

      const transitive = graph.get_transitive_dependencies(file1);
      expect(transitive.size).toBe(4);
      expect(transitive.has(file2)).toBe(true);
      expect(transitive.has(file3)).toBe(true);
      expect(transitive.has(file4)).toBe(true);
      expect(transitive.has(file5)).toBe(true);
    });

    it("should handle diamond dependencies", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;
      const file4 = "file4.ts" as FilePath;

      // file1 → file2 → file4
      //      ↘ file3 ↗
      graph.update_file(file1, [create_import(file2, file1), create_import(file3, file1)]);
      graph.update_file(file2, [create_import(file4, file2)]);
      graph.update_file(file3, [create_import(file4, file3)]);

      const transitive = graph.get_transitive_dependencies(file1);
      expect(transitive.size).toBe(3);
      expect(transitive.has(file2)).toBe(true);
      expect(transitive.has(file3)).toBe(true);
      expect(transitive.has(file4)).toBe(true);
    });

    it("should not include the starting file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      const transitive = graph.get_transitive_dependencies(file1);
      expect(transitive.has(file1)).toBe(false);
    });
  });

  describe("get_transitive_dependents", () => {
    it("should find all transitive dependents", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // file1 → file2 → file3
      // So file3 has transitive dependents: file2, file1
      graph.update_file(file1, [create_import(file2, file1)]);
      graph.update_file(file2, [create_import(file3, file2)]);

      const transitive = graph.get_transitive_dependents(file3);
      expect(transitive.size).toBe(2);
      expect(transitive.has(file2)).toBe(true);
      expect(transitive.has(file1)).toBe(true);
    });

    it("should handle complex dependent chains", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;
      const file4 = "file4.ts" as FilePath;
      const file5 = "file5.ts" as FilePath;

      // file1 → file3 ← file2
      //              ↓
      //         file4 ← file5
      graph.update_file(file1, [create_import(file3, file1)]);
      graph.update_file(file2, [create_import(file3, file2)]);
      graph.update_file(file3, [create_import(file4, file3)]);
      graph.update_file(file5, [create_import(file4, file5)]);

      const transitive = graph.get_transitive_dependents(file4);
      expect(transitive.size).toBe(4);
      expect(transitive.has(file1)).toBe(true);
      expect(transitive.has(file2)).toBe(true);
      expect(transitive.has(file3)).toBe(true);
      expect(transitive.has(file5)).toBe(true);
    });

    it("should not include the starting file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      const transitive = graph.get_transitive_dependents(file2);
      expect(transitive.has(file2)).toBe(false);
    });
  });

  describe("has_dependency", () => {
    it("should return true for direct dependency", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      expect(graph.has_dependency(file1, file2)).toBe(true);
    });

    it("should return false for non-existent dependency", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      expect(graph.has_dependency(file1, file2)).toBe(false);
    });

    it("should return false for transitive-only dependency", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // file1 → file2 → file3
      graph.update_file(file1, [create_import(file2, file1)]);
      graph.update_file(file2, [create_import(file3, file2)]);

      expect(graph.has_dependency(file1, file3)).toBe(false);
    });
  });

  describe("detect_cycle", () => {
    it("should detect simple cycle", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // file1 → file2 → file1
      graph.update_file(file1, [create_import(file2, file1)]);
      graph.update_file(file2, [create_import(file1, file2)]);

      const cycle = graph.detect_cycle(file1);
      expect(cycle.length).toBeGreaterThan(0);
    });

    it("should detect longer cycle", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // file1 → file2 → file3 → file1
      graph.update_file(file1, [create_import(file2, file1)]);
      graph.update_file(file2, [create_import(file3, file2)]);
      graph.update_file(file3, [create_import(file1, file3)]);

      const cycle = graph.detect_cycle(file1);
      expect(cycle.length).toBeGreaterThan(0);
    });

    it("should return empty for acyclic graph", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      const cycle = graph.detect_cycle(file1);
      expect(cycle).toEqual([]);
    });

    it("should return empty for file with no dependencies", () => {
      const file1 = "file1.ts" as FilePath;

      const cycle = graph.detect_cycle(file1);
      expect(cycle).toEqual([]);
    });
  });

  describe("remove_file", () => {
    it("should remove all relationships for a file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      graph.remove_file(file1);

      expect(graph.get_dependencies(file1).size).toBe(0);
      expect(graph.get_dependents(file2).size).toBe(0);
    });

    it("should not affect other files", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);
      graph.update_file(file3, [create_import(file2, file3)]);

      graph.remove_file(file1);

      // file3's relationship with file2 should remain
      expect(graph.get_dependencies(file3).has(file2)).toBe(true);
      expect(graph.get_dependents(file2).has(file3)).toBe(true);
    });

    it("should handle removing file that is a dependency", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      graph.remove_file(file2);

      // file1's dependency on file2 should be removed
      expect(graph.get_dependencies(file1).size).toBe(0);
    });

    it("should handle removing non-existent file gracefully", () => {
      const unknown_file = "unknown.ts" as FilePath;
      expect(() => graph.remove_file(unknown_file)).not.toThrow();
    });
  });

  describe("get_all_files", () => {
    it("should return empty set for empty graph", () => {
      expect(graph.get_all_files().size).toBe(0);
    });

    it("should return all files in the graph", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);
      graph.update_file(file2, [create_import(file3, file2)]);

      const files = graph.get_all_files();
      expect(files.size).toBe(3);
      expect(files.has(file1)).toBe(true);
      expect(files.has(file2)).toBe(true);
      expect(files.has(file3)).toBe(true);
    });

    it("should include files that only have dependents", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      const files = graph.get_all_files();
      expect(files.has(file2)).toBe(true);  // file2 has no dependencies but has dependents
    });
  });

  describe("get_stats", () => {
    it("should return zero stats for empty graph", () => {
      const stats = graph.get_stats();
      expect(stats).toEqual({
        file_count: 0,
        edge_count: 0,
        avg_dependencies: 0,
        avg_dependents: 0,
      });
    });

    it("should calculate correct statistics", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;
      const file3 = "file3.ts" as FilePath;

      // file1 → file2
      // file1 → file3
      // Total: 3 files, 2 edges
      graph.update_file(file1, [create_import(file2, file1), create_import(file3, file1)]);

      const stats = graph.get_stats();
      expect(stats.file_count).toBe(3);
      expect(stats.edge_count).toBe(2);
      expect(stats.avg_dependencies).toBeCloseTo(2 / 3);
      expect(stats.avg_dependents).toBeCloseTo(2 / 3);
    });
  });

  describe("clear", () => {
    it("should remove all relationships", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      graph.update_file(file1, [create_import(file2, file1)]);

      expect(graph.get_all_files().size).toBeGreaterThan(0);

      graph.clear();

      expect(graph.get_all_files().size).toBe(0);
      expect(graph.get_dependencies(file1).size).toBe(0);
      expect(graph.get_dependents(file2).size).toBe(0);
    });
  });
});
