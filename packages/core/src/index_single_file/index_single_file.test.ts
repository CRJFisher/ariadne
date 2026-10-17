/**
 * Semantic Index Tests - language-agnostic orchestration
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { QueryCapture } from "tree-sitter";
import type { FilePath, SemanticIndex } from "@ariadnejs/types";
import { build_index_single_file } from "./index_single_file";
import { parse_file } from "../project/parse_file";
import { detect_language } from "../detect_language";

// Captures that start at the same byte reach the pipeline in whatever order
// tree-sitter's matches complete. The mock lets a test reverse every such run
// to prove the index does not depend on that order.
const capture_order = vi.hoisted(() => ({ reverse_same_start_runs: false }));

vi.mock("./query_code_tree", async (import_original) => {
  const actual = await import_original<typeof import("./query_code_tree")>();
  return {
    ...actual,
    query_tree: (...args: Parameters<typeof actual.query_tree>): QueryCapture[] => {
      const captures = actual.query_tree(...args);
      return capture_order.reverse_same_start_runs
        ? reverse_same_start_runs(captures)
        : captures;
    },
  };
});

function reverse_same_start_runs(captures: readonly QueryCapture[]): QueryCapture[] {
  const reordered: QueryCapture[] = [];
  let run: QueryCapture[] = [];
  let run_start = -1;
  for (const capture of captures) {
    const start = capture.node.startIndex;
    if (start !== run_start) {
      reordered.push(...run.reverse());
      run = [];
      run_start = start;
    }
    run.push(capture);
  }
  reordered.push(...run.reverse());
  return reordered;
}

const FIXTURES_DIR = path.join(__dirname, "..", "..", "tests", "fixtures");

function fixture_source_files(): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entry_path = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(entry_path);
      else if (detect_language(entry_path) !== null) files.push(entry_path);
    }
  };
  for (const language_dir of ["javascript", "typescript", "python", "rust"]) {
    visit(path.join(FIXTURES_DIR, language_dir));
  }
  return files.sort();
}

function index_fixture(file_path: string): SemanticIndex {
  const content = fs.readFileSync(file_path, "utf8");
  const parsed = parse_file(
    file_path as FilePath,
    content,
    Math.max(32 * 1024, content.length * 2)
  );
  return build_index_single_file(parsed, parsed.tree, parsed.lang);
}

/**
 * References are emitted one per capture, in capture order, so their list is
 * the one part of the index whose order follows the captures'; everything
 * else must match exactly.
 */
function with_references_in_canonical_order(index: SemanticIndex): SemanticIndex {
  const keyed = index.references.map((reference) => ({
    key: JSON.stringify(reference),
    reference,
  }));
  keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { ...index, references: keyed.map(({ reference }) => reference) };
}

describe("build_index_single_file", () => {
  afterEach(() => {
    capture_order.reverse_same_start_runs = false;
  });

  it("builds the same index whatever order same-start captures arrive in", () => {
    const files = fixture_source_files();
    expect(new Set(files.map((file_path) => detect_language(file_path)))).toEqual(
      new Set(["javascript", "typescript", "python", "rust"])
    );

    const differing = files.filter((file_path) => {
      capture_order.reverse_same_start_runs = false;
      const in_document_order = with_references_in_canonical_order(index_fixture(file_path));
      capture_order.reverse_same_start_runs = true;
      const reversed = with_references_in_canonical_order(index_fixture(file_path));
      return !isDeepStrictEqual(reversed, in_document_order);
    });

    expect(differing.map((file_path) => path.relative(FIXTURES_DIR, file_path))).toEqual([]);
  }, 120_000);
});
