import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import type { FilePath } from "@ariadnejs/types";

describe("Project", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  describe("update_file", () => {
    it("should index a simple TypeScript file", () => {
      const file1 = "file1.ts" as FilePath;
      const code = `
        function foo() {
          return 42
        }
      `;

      project.update_file(file1, code);

      const defs = project.get_file_definitions(file1);
      expect(defs.length).toBeGreaterThan(0);

      const foo_def = defs.find(d => d.name === "foo");
      expect(foo_def).toBeDefined();
      expect(foo_def!.kind).toBe("function");
    });

    it("should update file when content changes", () => {
      const file1 = "file1.ts" as FilePath;

      // First version
      project.update_file(file1, "function foo() {}");
      expect(project.get_file_definitions(file1).length).toBe(1);

      // Second version
      project.update_file(file1, "function foo() {}\nfunction bar() {}");
      expect(project.get_file_definitions(file1).length).toBe(2);
    });

    it("should invalidate resolutions when file is updated", () => {
      const file1 = "file1.ts" as FilePath;

      // First update
      project.update_file(file1, "function foo() {}");

      // Force resolution (mark as resolved)
      project.resolve_file(file1);

      // Check that it's resolved
      const stats_before = project.get_stats();
      expect(stats_before.pending_resolution_count).toBe(0);

      // Update file
      project.update_file(file1, "function bar() {}");

      // Check that resolutions are invalidated
      const stats_after = project.get_stats();
      expect(stats_after.pending_resolution_count).toBe(1);
    });

    it("should invalidate dependent files when file is updated", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // Create file1 that exports something
      project.update_file(file1, "export function foo() {}");

      // Create file2 that imports from file1
      project.update_file(file2, "import { foo } from \"./file1\"");

      // Resolve both files
      project.resolve_file(file1);
      project.resolve_file(file2);

      expect(project.get_stats().pending_resolution_count).toBe(0);

      // Update file1
      project.update_file(file1, "export function bar() {}");

      // Both files should be invalidated
      const stats = project.get_stats();
      expect(stats.pending_resolution_count).toBe(2);
    });
  });

  describe("remove_file", () => {
    it("should remove all data for a file", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      expect(project.get_file_definitions(file1).length).toBe(1);

      project.remove_file(file1);

      expect(project.get_file_definitions(file1).length).toBe(0);
      expect(project.get_all_files()).not.toContain(file1);
    });

    it("should invalidate dependent files when file is removed", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // Create file1 that exports something
      project.update_file(file1, "export function foo() {}");

      // Create file2 that imports from file1
      project.update_file(file2, "import { foo } from \"./file1\"");

      // Resolve both files
      project.resolve_file(file1);
      project.resolve_file(file2);

      expect(project.get_stats().pending_resolution_count).toBe(0);

      // Remove file1
      project.remove_file(file1);

      // file2 should be invalidated
      const stats = project.get_stats();
      expect(stats.pending_resolution_count).toBe(1);

      // file1 should be gone
      expect(project.get_all_files()).not.toContain(file1);
      expect(project.get_all_files()).toContain(file2);
    });
  });

  describe("resolve_file", () => {
    it("should not re-resolve already resolved files", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      // First resolution
      project.resolve_file(file1);
      expect(project.get_stats().pending_resolution_count).toBe(0);

      // Second resolution should be skipped (cache hit)
      project.resolve_file(file1);
      expect(project.get_stats().pending_resolution_count).toBe(0);
    });

    it("should throw error for non-indexed file", () => {
      const file1 = "non_existent.ts" as FilePath;

      expect(() => {
        project.resolve_file(file1);
      }).toThrow("Cannot resolve file");
    });
  });

  describe("get_call_graph", () => {
    it("should resolve all pending files before building graph", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      project.update_file(file1, "function foo() {}");
      project.update_file(file2, "function bar() {}");

      // Both files are pending
      expect(project.get_stats().pending_resolution_count).toBe(2);

      // Get call graph should resolve all pending
      project.get_call_graph();

      expect(project.get_stats().pending_resolution_count).toBe(0);
    });

    it("should cache call graph", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const graph1 = project.get_call_graph();
      const graph2 = project.get_call_graph();

      // Should return same instance
      expect(graph1).toBe(graph2);
    });

    it("should invalidate call graph when file changes", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const graph1 = project.get_call_graph();

      // Update file
      project.update_file(file1, "function bar() {}");

      const graph2 = project.get_call_graph();

      // Should be different instances
      expect(graph1).not.toBe(graph2);
    });
  });

  describe("get_stats", () => {
    it("should return accurate statistics", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const stats = project.get_stats();
      expect(stats.file_count).toBe(1);
      expect(stats.definition_count).toBeGreaterThan(0);
      expect(stats.pending_resolution_count).toBe(1);
      expect(stats.cached_resolution_count).toBe(0);
    });

    it("should update stats after resolution", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const stats_before = project.get_stats();
      expect(stats_before.pending_resolution_count).toBe(1);

      project.resolve_file(file1);

      const stats_after = project.get_stats();
      expect(stats_after.pending_resolution_count).toBe(0);
    });
  });

  describe("clear", () => {
    it("should remove all data", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      expect(project.get_stats().file_count).toBe(1);

      project.clear();

      expect(project.get_stats().file_count).toBe(0);
      expect(project.get_stats().definition_count).toBe(0);
      expect(project.get_stats().pending_resolution_count).toBe(0);
    });
  });

  describe("query interface", () => {
    it("should get definition by symbol_id", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const defs = project.get_file_definitions(file1);
      const foo_def = defs.find(d => d.name === "foo");
      expect(foo_def).toBeDefined();

      const retrieved = project.get_definition(foo_def!.symbol_id);
      expect(retrieved).toEqual(foo_def);
    });

    it("should get semantic index for file", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const index = project.get_semantic_index(file1);
      expect(index).toBeDefined();
      expect(index!.file_path).toBe(file1);
    });

    it("should get derived data for file", () => {
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const derived = project.get_derived_data(file1);
      expect(derived).toBeDefined();
      expect(derived!.file_path).toBe(file1);
    });

    it("should get all files in project", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      project.update_file(file1, "function foo() {}");
      project.update_file(file2, "function bar() {}");

      const files = project.get_all_files();
      expect(files).toContain(file1);
      expect(files).toContain(file2);
      expect(files.length).toBe(2);
    });

    it("should get dependents for a file", () => {
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      project.update_file(file1, "export function foo() {}");
      project.update_file(file2, "import { foo } from \"./file1\"");

      const dependents = project.get_dependents(file1);
      expect(dependents).toContain(file2);
    });
  });
});
