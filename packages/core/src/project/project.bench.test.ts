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
    it("should compare incremental update vs full rebuild", { timeout: 30000 }, async () => {
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

  describe("get_call_graph performance", () => {
    async function build_chained_project(file_count: number): Promise<Project> {
      const project = new Project();
      await project.initialize();
      for (let i = 0; i < file_count; i++) {
        const imports = i > 0 ? `import { func${i - 1} } from './file${i - 1}'` : "";
        project.update_file(
          `file${i}.ts` as FilePath,
          `
            ${imports}
            export function func${i}() {
              ${i > 0 ? `return func${i - 1}() + ${i}` : `return ${i}`}
            }
            export function helper${i}() { return func${i}() * 2 }
          `,
        );
      }
      return project;
    }

    it("should baseline call-graph build + classification cost", { timeout: 30000 }, async () => {
      const file_count = 50;
      const project = await build_chained_project(file_count);

      const cold_start = performance.now();
      const cold = project.get_call_graph();
      const cold_time = performance.now() - cold_start;

      const warm_start = performance.now();
      const warm = project.get_call_graph();
      const warm_time = performance.now() - warm_start;

      console.log(
        `\nget_call_graph (${file_count} files):\n  Cold: ${cold_time.toFixed(2)}ms\n  Warm: ${warm_time.toFixed(2)}ms\n  Entry points: ${cold.entry_points.length}`,
      );

      // Cache identity: warm reads the same EnrichedCallGraph the cold
      // call populated. Asserts the cache key holds without depending on
      // wall-clock timing.
      expect(warm.nodes).toBe(cold.nodes);
      expect(warm.entry_points).toEqual(cold.entry_points);
    });

    it("should baseline get_classified_entry_points cost", { timeout: 30000 }, async () => {
      const file_count = 50;
      const project = await build_chained_project(file_count);

      project.get_call_graph();

      const start = performance.now();
      const first = project.get_classified_entry_points();
      const elapsed = performance.now() - start;
      const second = project.get_classified_entry_points();

      console.log(
        `get_classified_entry_points (warm, ${file_count} files): ${elapsed.toFixed(2)}ms; ${first.true_entry_points.length} TP / ${first.known_false_positives.length} FP`,
      );

      // Cache identity between get_call_graph and get_classified_entry_points
      // — both methods share a single EnrichedCallGraph, so triage callers
      // never repeat classification.
      expect(second).toBe(first);
    });
  });

  describe("wildcard fan-out performance", () => {
    it("baselines resolve_all_exports across a star-re-export fan", { timeout: 60000 }, async () => {
      const project = new Project();
      await project.initialize();

      // The src/services/_namespaces/ts.ts shape: one barrel starring 20 leaf
      // modules, 5 of which are barrels starring 4 further modules each.
      const leaf_files: FilePath[] = [];
      const import_names: string[] = [];
      for (let i = 0; i < 20; i++) {
        if (i < 5) {
          const nested: string[] = [];
          for (let j = 0; j < 4; j++) {
            const nested_file = `deep${i}_${j}.ts` as FilePath;
            const fns = Array.from(
              { length: 10 },
              (_, k) => `export function fn_d${i}_${j}_${k}() { return ${k}; }`
            ).join("\n");
            project.update_file(nested_file, fns);
            nested.push(`export * from './deep${i}_${j}';`);
          }
          project.update_file(`leaf${i}.ts` as FilePath, nested.join("\n"));
        } else {
          const fns = Array.from(
            { length: 10 },
            (_, k) => `export function fn_${i}_${k}() { return ${k}; }`
          ).join("\n");
          project.update_file(`leaf${i}.ts` as FilePath, fns);
          import_names.push(`fn_${i}_0`);
        }
        leaf_files.push(`leaf${i}.ts` as FilePath);
      }
      project.update_file(
        "barrel.ts" as FilePath,
        leaf_files.map((f) => `export * from './${f.replace(".ts", "")}';`).join("\n")
      );

      const consumer = "consumer.ts" as FilePath;
      const consumer_code = `import { fn_d0_0_0, ${import_names.join(", ")} } from './barrel';
export function drive() { return fn_d0_0_0()${import_names.map((n) => ` + ${n}()`).join("")}; }
`;

      const cold_start = performance.now();
      project.update_file(consumer, consumer_code);
      const cold_time = performance.now() - cold_start;

      // Re-indexing a starred leaf drops the resolve_all_exports memo and
      // forces a full fan re-walk for the consumer's re-resolution.
      const leaf_iterations = 50;
      const leaf_start = performance.now();
      for (let i = 0; i < leaf_iterations; i++) {
        project.update_file(
          "leaf10.ts" as FilePath,
          Array.from(
            { length: 10 },
            (_, k) => `export function fn_10_${k}() { return ${k + i}; }`
          ).join("\n")
        );
      }
      const leaf_avg = (performance.now() - leaf_start) / leaf_iterations;

      const unrelated = "unrelated.ts" as FilePath;
      const unrelated_iterations = 50;
      const unrelated_start = performance.now();
      for (let i = 0; i < unrelated_iterations; i++) {
        project.update_file(unrelated, `export function standalone() { return ${i}; }`);
      }
      const unrelated_avg = (performance.now() - unrelated_start) / unrelated_iterations;

      console.log(
        `\nWildcard fan (20 leaves, 5 nested barrels):\n  Consumer cold update: ${cold_time.toFixed(2)}ms\n  Starred-leaf update avg: ${leaf_avg.toFixed(2)}ms\n  Unrelated update avg: ${unrelated_avg.toFixed(2)}ms`
      );

      const call = project.resolutions
        .get_calls_for_file(consumer)
        .find((c) => c.name === ("fn_d0_0_0" as string));
      expect(call!.resolutions.length).toEqual(1);
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
