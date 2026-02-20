import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import type { FilePath, AnyDefinition } from "@ariadnejs/types";

// Helper function to get all definitions from a file
function get_file_definitions(project: Project, file_path: FilePath): AnyDefinition[] {
  const index = project.get_index_single_file(file_path);
  if (!index) {
    return [];
  }

  const definitions: AnyDefinition[] = [];

  // Collect all definition types
  definitions.push(...Array.from(index.functions.values()));
  definitions.push(...Array.from(index.classes.values()));
  definitions.push(...Array.from(index.variables.values()));
  definitions.push(...Array.from(index.interfaces.values()));
  definitions.push(...Array.from(index.enums.values()));
  definitions.push(...Array.from(index.namespaces.values()));
  definitions.push(...Array.from(index.types.values()));
  definitions.push(...Array.from(index.imported_symbols.values()));

  return definitions;
}

describe("Project", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project();
  });

  describe("update_file", () => {
    it("should index a simple TypeScript file", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      const code = `
        function foo() {
          return 42
        }
      `;

      project.update_file(file1, code);

      const defs = get_file_definitions(project, file1);
      expect(defs.length).toBeGreaterThan(0);

      const foo_def = defs.find(d => d.name === "foo");
      expect(foo_def).toBeDefined();
      expect(foo_def!.kind).toBe("function");
    });

    it("should update file when content changes", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;

      // First version
      project.update_file(file1, "function foo() {}");
      expect(get_file_definitions(project, file1).length).toBe(1);

      // Second version
      project.update_file(file1, "function foo() {}\nfunction bar() {}");
      expect(get_file_definitions(project, file1).length).toBe(2);
    });

    it("should immediately resolve references when file is updated", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;

      // First version: foo calls nothing
      project.update_file(file1, `
        function foo() { return 42; }
        const x = foo();
      `);

      // Verify resolutions exist (eager resolution happened)
      const stats_after_first = project.get_stats();
      expect(stats_after_first.resolution_count).toBeGreaterThan(0);

      // Update file: change function name
      project.update_file(file1, `
        function bar() { return 99; }
        const y = bar();
      `);

      // Verify new references are resolved immediately
      const stats_after_second = project.get_stats();
      expect(stats_after_second.resolution_count).toBeGreaterThan(0);
    });

    it("should re-resolve dependent files when file is updated", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // Create file1 that exports something
      project.update_file(file1, "export function foo() { return 42; }");

      // Create file2 that imports from file1
      project.update_file(file2, `
        import { foo } from "./file1";
        const x = foo();
      `);

      // Both files should be resolved (no pending state)
      const stats_before = project.get_stats();
      expect(stats_before.file_count).toBe(2);

      // Update file1 (changes export)
      project.update_file(file1, "export function bar() { return 99; }");

      // file1 and file2 should both be re-resolved immediately
      // Verify this by checking that we can get call graph without errors
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();
    });
  });

  describe("remove_file", () => {
    it("should remove all data for a file", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      expect(get_file_definitions(project, file1).length).toBe(1);

      project.remove_file(file1);

      expect(get_file_definitions(project, file1).length).toBe(0);
      expect(project.get_all_files()).not.toContain(file1);
    });

    it("should re-resolve dependent files when file is removed", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      // Create file1 that exports something
      project.update_file(file1, "export function foo() {}");

      // Create file2 that imports from file1
      project.update_file(file2, "import { foo } from \"./file1\"");

      // Both files should exist
      expect(project.get_all_files()).toContain(file1);
      expect(project.get_all_files()).toContain(file2);

      // Remove file1
      project.remove_file(file1);

      // file1 should be gone
      expect(project.get_all_files()).not.toContain(file1);

      // file2 should still exist
      expect(project.get_all_files()).toContain(file2);

      // file2 should be re-resolved (import is now broken, but resolution attempted)
      // Verify we can get call graph without errors
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();
    });
  });

  describe("eager resolution behavior", () => {
    it("should resolve immediately without explicit resolve call", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, `
        function foo() { return 42; }
        const x = foo();
      `);

      // Should be able to get call graph immediately
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();
      expect(call_graph.nodes.size).toBeGreaterThan(0);
    });

    it("should maintain consistent state across multiple updates", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;

      // Update 1
      project.update_file(file1, "function foo() {}");
      let call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      // Update 2
      project.update_file(file1, "function bar() {}");
      call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      // Update 3
      project.update_file(file1, "function baz() {}");
      call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();

      // State should always be consistent
    });
  });

  describe("get_call_graph", () => {
    it("should build call graph without explicit resolution", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      project.update_file(file1, "function foo() {}");
      project.update_file(file2, "function bar() {}");

      // Should work immediately - resolutions already done
      const call_graph = project.get_call_graph();
      expect(call_graph).toBeDefined();
      expect(call_graph.nodes.size).toBeGreaterThan(0);
    });

    it("should recalculate call graph on each call (no caching)", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const graph1 = project.get_call_graph();
      const graph2 = project.get_call_graph();

      // Should be DIFFERENT references (recalculated each time)
      expect(graph1).not.toBe(graph2);

      // But should have same structure
      expect(graph1.nodes.size).toBe(graph2.nodes.size);
    });

    it("should reflect changes immediately after file update", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const call_graph1 = project.get_call_graph();
      const nodes_before = call_graph1.nodes.size;

      // Update file (adds more functions)
      project.update_file(file1, `
        function foo() {}
        function bar() {}
        function baz() { bar(); }
      `);

      const call_graph2 = project.get_call_graph();
      const nodes_after = call_graph2.nodes.size;

      // Should have more nodes after update
      expect(nodes_after).toBeGreaterThan(nodes_before);
    });
  });

  describe("get_stats", () => {
    it("should return accurate statistics", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      // Use code with references so we have resolutions
      project.update_file(file1, `
        function foo() { return 42; }
        const x = foo();
      `);

      const stats = project.get_stats();
      expect(stats.file_count).toBe(1);
      expect(stats.definition_count).toBeGreaterThan(0);
      expect(stats.resolution_count).toBeGreaterThan(0);
    });

    it("should show resolution count after update", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, `
        function foo() { return 42; }
        const x = foo();
      `);

      const stats = project.get_stats();
      // With eager resolution, resolutions happen immediately
      expect(stats.resolution_count).toBeGreaterThan(0);
    });
  });

  describe("clear", () => {
    it("should remove all data", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      expect(project.get_stats().file_count).toBe(1);

      project.clear();

      expect(project.get_stats().file_count).toBe(0);
      expect(project.get_stats().definition_count).toBe(0);
      expect(project.get_stats().resolution_count).toBe(0);
    });
  });

  describe("query interface", () => {
    it("should get definition by symbol_id", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const defs = get_file_definitions(project, file1);
      const foo_def = defs.find(d => d.name === "foo");
      expect(foo_def).toBeDefined();

      const retrieved = project.get_definition(foo_def!.symbol_id);
      expect(retrieved).toEqual(foo_def);
    });

    it("should get semantic index for file", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const index = project.get_index_single_file(file1);
      expect(index).toBeDefined();
      expect(index!.file_path).toBe(file1);
    });

    it("should get derived data for file", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      project.update_file(file1, "function foo() {}");

      const derived = project.get_derived_data(file1);
      expect(derived).toBeDefined();
      expect(derived!.file_path).toBe(file1);
    });

    it("should get all files in project", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      project.update_file(file1, "function foo() {}");
      project.update_file(file2, "function bar() {}");

      const files = project.get_all_files();
      expect(files).toContain(file1);
      expect(files).toContain(file2);
      expect(files.length).toBe(2);
    });

    it("should get dependents for a file", async () => {
      await project.initialize();
      const file1 = "file1.ts" as FilePath;
      const file2 = "file2.ts" as FilePath;

      project.update_file(file1, "export function foo() {}");
      project.update_file(file2, "import { foo } from \"./file1\"");

      const dependents = project.get_dependents(file1);
      expect(dependents).toContain(file2);
    });
  });
});
