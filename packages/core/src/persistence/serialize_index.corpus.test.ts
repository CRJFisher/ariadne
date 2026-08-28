/**
 * The two transports a `SemanticIndex` takes, guarded over real corpus files.
 *
 * A cached file re-enters the pipeline through JSON and a worker-indexed file
 * through the structured-clone algorithm. The two fail a field that holds a
 * function in opposite ways: JSON drops it silently, so a restored file carries
 * a different reference record from a cold one and nothing reports the
 * divergence, while structuredClone refuses and the file never crosses at all.
 * Neither failure is visible in a hand-written snippet — it takes idiomatic
 * source, which is what this slice supplies.
 *
 * The slice is the first 200 path-sorted `.ts` files of `src/vs/base` at
 * microsoft/vscode `f3fa55c3`, the file set every slice-scale figure in the
 * TASK-381 epic is stated over. A corpus of that scale is absent in CI and in
 * most checkouts, so these rows skip cleanly; the mechanism they guard is
 * exercised on every test run by the snippet cases in `serialize_index.test.ts`.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import type { FilePath, SemanticIndex } from "@ariadnejs/types";
import { discover_corpus } from "../benchmark_corpus_load";
import { nested_slice } from "../benchmark_corpus_load/nested_slice";
import { build_index_single_file } from "../index_single_file/index_single_file";
import { parse_file } from "../project/parse_file";
import { compute_content_hash } from "./content_hash";
import {
  CURRENT_SCHEMA_VERSION,
  deserialize_cached_index,
  serialize_cached_index,
} from "./cached_index";
import { INDEXER_VERSION } from "./indexer_version";

const CORPUS_ROOT = path.join(
  os.homedir(),
  ".ariadne",
  "triage-entrypoints",
  "repos",
  "microsoft--vscode",
);
const PREDICATE = "folder-ts:src/vs/base";
const SLICE_SIZE = 200;
const DISCOVERED_FILES = 479;

const corpus_present = fs.existsSync(path.join(CORPUS_ROOT, "src", "vs", "base"));

interface SliceIndex {
  readonly file: string;
  readonly index: SemanticIndex;
}

interface Slice {
  readonly discovered: number;
  readonly indexes: readonly SliceIndex[];
}

let slice: Promise<Slice> | null = null;

/** Index the slice once and share it across the rows. */
function load_slice(): Promise<Slice> {
  slice ??= index_slice();
  return slice;
}

async function index_slice(): Promise<Slice> {
  const discovered = await discover_corpus(CORPUS_ROOT, PREDICATE);
  const indexes: SliceIndex[] = [];
  // The parser buffer grows to fit the largest file seen, as `Project` does.
  let buffer_size = 32 * 1024;
  for (const file of nested_slice(discovered, SLICE_SIZE)) {
    const content = fs.readFileSync(file, "utf-8");
    buffer_size = Math.max(buffer_size, content.length * 2);
    const parsed = parse_file(file as FilePath, content, buffer_size);
    indexes.push({
      file: path.relative(CORPUS_ROOT, file),
      index: build_index_single_file(parsed, parsed.tree, parsed.lang),
    });
  }
  return { discovered: discovered.length, indexes };
}

/** The cache's own write-then-read path, stamp and path elision included. */
function restore_from_cache(
  source_path: string,
  index: SemanticIndex,
): SemanticIndex {
  const blob = serialize_cached_index({
    schema_version: CURRENT_SCHEMA_VERSION,
    indexer_version: INDEXER_VERSION,
    source_path: source_path as FilePath,
    content_hash: compute_content_hash(source_path),
    index,
  });
  const restored = deserialize_cached_index(blob, source_path as FilePath);
  if (restored === null) {
    throw new Error("The cache rejected a blob it had just written.");
  }
  return restored.index;
}

describe.skipIf(!corpus_present)("the vs/base slice through both index transports", () => {
  it("names the file set the rows below are stated over", async () => {
    const { discovered, indexes } = await load_slice();
    expect({ discovered, probed: indexes.length }).toEqual({
      discovered: DISCOVERED_FILES,
      probed: SLICE_SIZE,
    });
  }, 300_000);

  it("clones every file's index across a worker boundary", async () => {
    const { indexes } = await load_slice();
    const refused: string[] = [];
    for (const { file, index } of indexes) {
      try {
        globalThis.structuredClone(index);
      } catch {
        refused.push(file);
      }
    }
    expect(refused).toEqual([]);
  }, 300_000);

  it("restores every file's reference records unchanged from the cache", async () => {
    const { indexes } = await load_slice();
    const diverged: string[] = [];
    for (const { file, index } of indexes) {
      const restored = restore_from_cache(index.file_path, index);
      try {
        expect([...restored.references]).toEqual([...index.references]);
      } catch {
        diverged.push(file);
      }
    }
    expect(diverged).toEqual([]);
  }, 300_000);

  // The blob header holds the source path; the reference records that would
  // otherwise repeat it two or three times apiece hold none of it.
  it("names the source path in no stored reference record", async () => {
    const { indexes } = await load_slice();
    const leaking: string[] = [];
    for (const { file, index } of indexes) {
      const blob = serialize_cached_index({
        schema_version: CURRENT_SCHEMA_VERSION,
        indexer_version: INDEXER_VERSION,
        source_path: index.file_path,
        content_hash: compute_content_hash(index.file_path),
        index,
      });
      const stored = JSON.stringify(JSON.parse(blob).index.references);
      if (stored.includes(index.file_path)) leaking.push(file);
    }
    expect(leaking).toEqual([]);
  }, 300_000);
});
