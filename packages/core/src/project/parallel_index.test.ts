import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { FilePath } from "@ariadnejs/types";
import { index_files_across_threads, type IndexedFile } from "./parallel_index";

/**
 * The pool boots the BUILT worker under `dist`. A checkout with no `dist` has
 * no worker to dispatch to, and a test that quietly passed there would be
 * asserting nothing.
 */
const WORKER_ENTRY_BUILT = fs.existsSync(
  path.join(__dirname, "..", "..", "dist", "dispatch_to_workers", "worker_entry.js"),
);

let corpus_dir: string;
let paths: FilePath[];

beforeAll(() => {
  corpus_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-parallel-index-"));
  paths = [];
  for (let i = 0; i < 8; i++) {
    const file_path = path.join(corpus_dir, `mod_${i}.ts`);
    fs.writeFileSync(
      file_path,
      `export function fn_${i}(): number {\n  return ${i};\n}\n`,
    );
    paths.push(file_path as FilePath);
  }
});

afterAll(() => {
  fs.rmSync(corpus_dir, { recursive: true, force: true });
});

async function collect(
  file_paths: readonly FilePath[],
  width: number,
): Promise<{ files: IndexedFile[]; deserialize_ms: number }> {
  const files: IndexedFile[] = [];
  const stats = await index_files_across_threads(file_paths, width, (file) => {
    files.push(file);
  });
  return { files, deserialize_ms: stats.main_deserialize_ms };
}

describe.runIf(WORKER_ENTRY_BUILT)("index_files_across_threads", () => {
  it("hands each file's index back in the caller's path order", async () => {
    const { files } = await collect(paths, 3);

    expect(files.map((file) => file.file_path)).toEqual(paths);
    for (const [i, file] of files.entries()) {
      expect(file.outcome).toBe("indexed");
      if (file.outcome !== "indexed") continue;
      expect([...file.index.functions.values()].map((fn) => fn.name)).toEqual([
        `fn_${i}`,
      ]);
      expect(file.index.file_path).toBe(paths[i]);
      expect(file.content).toBe(fs.readFileSync(paths[i], "utf-8"));
    }
  });

  it("produces the same indexes at width one as at width three", async () => {
    const wide = await collect(paths, 3);
    const narrow = await collect(paths, 1);

    expect(narrow.files.map((file) => file.file_path)).toEqual(
      wide.files.map((file) => file.file_path),
    );
    expect(
      narrow.files.map((file) =>
        file.outcome === "indexed" ? [...file.index.functions.keys()] : [],
      ),
    ).toEqual(
      wide.files.map((file) =>
        file.outcome === "indexed" ? [...file.index.functions.keys()] : [],
      ),
    );
  });

  it("charges the main thread for deserializing what the workers produced", async () => {
    const { deserialize_ms } = await collect(paths, 2);

    expect(deserialize_ms).toBeGreaterThan(0);
  });

  it("reports a file that cannot be read as unreadable, not as a drop", async () => {
    const absent = path.join(corpus_dir, "gone.ts") as FilePath;
    const { files } = await collect([paths[0], absent, paths[1]], 2);

    expect(files.map((file) => file.outcome)).toEqual([
      "indexed",
      "unreadable",
      "indexed",
    ]);
  });
});
