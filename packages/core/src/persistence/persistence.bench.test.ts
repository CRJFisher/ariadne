import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "../project/project";
import {
  serialize_semantic_index,
  deserialize_semantic_index,
} from "./serialize_index";
import { compute_content_hash } from "./content_hash";
import { InMemoryStorage } from "./storage.test";
import { load_project } from "../project/load_project";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

function fp(s: string): FilePath {
  return s as FilePath;
}

function make_file_content(index: number, dep_index?: number): string {
  const import_line =
    dep_index !== undefined
      ? `import { func${dep_index} } from './file${dep_index}';\n`
      : "";
  return `${import_line}export function func${index}() { return ${index}; }
export function helper${index}(x: number) { return x + ${index}; }
const val${index} = func${index}();`;
}

describe("Persistence - Performance Benchmarks", () => {
  it(
    "serialization throughput",
    { timeout: 30000 },
    async () => {
      const project = new Project();
      await project.initialize();
      const file_count = 20;

      for (let i = 0; i < file_count; i++) {
        const content = make_file_content(i, i > 0 ? i - 1 : undefined);
        project.update_file(fp(`file${i}.ts`), content);
      }

      const indexes = project.get_all_files().map((fp) => ({
        path: fp,
        index: project.get_index_single_file(fp),
      }));

      const start = performance.now();
      for (const { index } of indexes) {
        if (index) serialize_semantic_index(index);
      }
      const elapsed = performance.now() - start;

      console.log(
        `Serialization: ${(elapsed / file_count).toFixed(2)}ms avg per file (${file_count} files)`,
      );
      expect(elapsed).toBeGreaterThan(0);
    },
  );

  it(
    "deserialization throughput",
    { timeout: 30000 },
    async () => {
      const project = new Project();
      await project.initialize();
      const file_count = 20;

      for (let i = 0; i < file_count; i++) {
        const content = make_file_content(i, i > 0 ? i - 1 : undefined);
        project.update_file(fp(`file${i}.ts`), content);
      }

      const serialized = project
        .get_all_files()
        .map((fp) => {
          const index = project.get_index_single_file(fp);
          return index ? serialize_semantic_index(index) : null;
        })
        .filter((s): s is string => s !== null);

      const start = performance.now();
      for (const json of serialized) {
        deserialize_semantic_index(json);
      }
      const elapsed = performance.now() - start;

      console.log(
        `Deserialization: ${(elapsed / file_count).toFixed(2)}ms avg per file (${file_count} files)`,
      );
      expect(elapsed).toBeGreaterThan(0);
    },
  );

  it(
    "content hash throughput",
    { timeout: 30000 },
    () => {
      const file_count = 100;
      const contents: string[] = [];
      for (let i = 0; i < file_count; i++) {
        contents.push(make_file_content(i, i > 0 ? i - 1 : undefined));
      }

      const start = performance.now();
      for (const content of contents) {
        compute_content_hash(content);
      }
      const elapsed = performance.now() - start;

      console.log(
        `Content hashing: ${(elapsed / file_count).toFixed(3)}ms avg per file (${file_count} files)`,
      );
      expect(elapsed).toBeGreaterThan(0);
    },
  );

  it(
    "warm start vs cold start",
    { timeout: 60000 },
    async () => {
      const file_count = 20;
      const temp_dir = await fs.mkdtemp(
        path.join(os.tmpdir(), "ariadne-bench-"),
      );

      try {
        // Write files to disk
        for (let i = 0; i < file_count; i++) {
          const content = make_file_content(i, i > 0 ? i - 1 : undefined);
          await fs.writeFile(
            path.join(temp_dir, `file${i}.ts`),
            content,
            "utf-8",
          );
        }

        const storage = new InMemoryStorage();

        // Cold start (populates cache)
        const cold_start = performance.now();
        await load_project({ project_path: temp_dir, storage });
        const cold_time = performance.now() - cold_start;

        // Warm start (uses cache)
        const warm_start = performance.now();
        await load_project({ project_path: temp_dir, storage });
        const warm_time = performance.now() - warm_start;

        const speedup = cold_time / warm_time;

        console.log(`\nCold start vs Warm start (${file_count} files):`);
        console.log(`  Cold: ${cold_time.toFixed(2)}ms`);
        console.log(`  Warm: ${warm_time.toFixed(2)}ms`);
        console.log(`  Speedup: ${speedup.toFixed(1)}x`);

        // Document, don't enforce strict limits (JIT warmup can make cold appear faster)
        expect(warm_time).toBeGreaterThan(0);
      } finally {
        await fs.rm(temp_dir, { recursive: true, force: true });
      }
    },
  );
});
