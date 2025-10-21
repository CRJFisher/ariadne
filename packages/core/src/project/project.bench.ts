/* global performance */
import { describe, it, expect } from "vitest";
import { Project } from "./project";
import type { FilePath } from "@ariadnejs/types";

/**
 * Lightweight performance benchmarks for Project coordination layer.
 *
 * Run with: npm test -- project.bench.ts
 *
 * Note: These are optional benchmarks to document performance characteristics,
 * not strict requirements.
 */
describe("Project - Performance Benchmarks", () => {
  describe("update_file performance", () => {
    it("should handle small file updates", { timeout: 15000 }, async () => {
      const project = new Project();
      await project.initialize();
      const file1 = "file1.ts" as FilePath;

      // Small file (~80 lines)
      const code = `
        function foo() { return 42 }
        function bar() { return foo() + 1 }
        const x = bar()
      `.repeat(20);

      const iterations = 50;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        project.update_file(file1, code + `\n// v${i}`);
      }

      const elapsed = performance.now() - start;
      const avg_time = elapsed / iterations;

      console.log(`update_file (small): ${avg_time.toFixed(2)}ms avg over ${iterations} iterations`);

      // Just document, don't enforce strict limits
      expect(avg_time).toBeGreaterThan(0);
    });
  });

  describe("eager resolution performance", () => {
    it("should demonstrate eager resolution in update_file", { timeout: 15000 }, async () => {
      const project = new Project();
      await project.initialize();
      const file1 = "file1.ts" as FilePath;

      const code = `
        function foo() { return 42 }
        function bar() { return foo() }
        function baz() { return bar() }
        const x = baz()
      `;

      // First update (includes resolution)
      const start_first = performance.now();
      project.update_file(file1, code);
      const first_time = performance.now() - start_first;

      // Subsequent updates (also include resolution)
      const iterations = 50;
      const start_updates = performance.now();

      for (let i = 0; i < iterations; i++) {
        project.update_file(file1, code + `\n// v${i}`);
      }

      const avg_update_time = (performance.now() - start_updates) / iterations;

      console.log(`Eager resolution - first: ${first_time.toFixed(2)}ms, avg: ${avg_update_time.toFixed(2)}ms`);

      // Just document, don't enforce strict limits
      expect(avg_update_time).toBeGreaterThan(0);
    });
  });

  describe("incremental vs full rebuild", () => {
    it("should compare incremental update vs full rebuild", { timeout: 15000 }, async () => {
      const file_count = 20;

      // === INCREMENTAL APPROACH ===
      const project_incremental = new Project();
      await project_incremental.initialize();
      const files = Array.from({ length: file_count }, (_, i) => `file${i}.ts` as FilePath);

      // Initial build (resolution happens automatically in update_file)
      for (let i = 0; i < files.length; i++) {
        const imports = i > 0 ? `import { func${i - 1} } from './file${i - 1}'` : "";
        project_incremental.update_file(files[i], `
          ${imports}
          export function func${i}() { return ${i} }
        `);
      }

      // Update one file (resolution happens automatically for file and dependents)
      const start_incremental = performance.now();
      project_incremental.update_file(files[0], `
        export function func0() { return 999 }
      `);
      const incremental_time = performance.now() - start_incremental;

      // === FULL REBUILD ===
      const project_full = new Project();
      await project_full.initialize();
      const start_full = performance.now();

      for (let i = 0; i < files.length; i++) {
        const imports = i > 0 ? `import { func${i - 1} } from './file${i - 1}'` : "";
        const content = i === 0
          ? "export function func0() { return 999 }"
          : `${imports}\nexport function func${i}() { return ${i} }`;

        project_full.update_file(files[i], content);
        // Note: Resolution now happens automatically during update_file (eager resolution)
      }
      const full_rebuild_time = performance.now() - start_full;

      const speedup = full_rebuild_time / incremental_time;

      console.log(`\nIncremental vs Full Rebuild (${file_count} files):`);
      console.log(`  Incremental: ${incremental_time.toFixed(2)}ms`);
      console.log(`  Full rebuild: ${full_rebuild_time.toFixed(2)}ms`);
      console.log(`  Speedup: ${speedup.toFixed(1)}x`);

      // Incremental should be faster
      expect(incremental_time).toBeLessThan(full_rebuild_time);
    });
  });

  describe("cache hit rate", () => {
    it("should measure resolution cache behavior", async () => {
      const project = new Project();
      await project.initialize();
      const files = Array.from({ length: 10 }, (_, i) => `file${i}.ts` as FilePath);

      // Create files with dependencies
      for (let i = 0; i < files.length; i++) {
        const imports = i > 0 ? `import { func${i - 1} } from './file${i - 1}'` : "";
        project.update_file(files[i], `
          ${imports}
          export function func${i}() { return ${i} }
        `);
      }

      // Note: Resolution now happens automatically during update_file (eager resolution)
      // No need for explicit resolve_file() calls

      const stats_before = project.get_stats();
      console.log("\nAfter initial indexing:");
      console.log(`  Total resolutions: ${stats_before.resolution_count}`);
      console.log(`  File count: ${stats_before.file_count}`);
      console.log(`  Definition count: ${stats_before.definition_count}`);

      // Update one file in the middle
      project.update_file(files[5], `
        import { func4 } from './file4'
        export function func5() { return 555 }
      `);

      const stats_after_update = project.get_stats();
      console.log("After updating file5:");
      console.log(`  Total resolutions: ${stats_after_update.resolution_count}`);
      console.log(`  File count: ${stats_after_update.file_count}`);

      // Resolutions should be maintained (eager resolution keeps everything up to date)
      expect(stats_after_update.resolution_count).toBeGreaterThan(0);
    });
  });
});
