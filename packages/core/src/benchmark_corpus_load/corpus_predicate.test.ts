/**
 * Which files a row is about.
 *
 * The extension set is part of the predicate rather than a flag beside it, and
 * these tests pin why: the same folder under two predicates is two different
 * file sets that index identically and diverge on everything else.
 */

import { describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  compare_paths,
  discover_corpus,
  parse_corpus_predicate_name,
  resolve_corpus_predicate,
  PINNED_CORPUS_COUNTS,
} from "./corpus_predicate";

function find_repo_root(): string {
  let dir = __dirname;
  while (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("could not locate repo root");
    dir = parent;
  }
  return dir;
}

const CORPUS = path.join(find_repo_root(), "packages", "core", "benchmark_corpus");

describe("resolve_corpus_predicate", () => {
  it("walks src/ for the src predicate", () => {
    expect(resolve_corpus_predicate("src").folders).toEqual(["src"]);
    expect(resolve_corpus_predicate("src").extensions).toEqual([]);
  });

  it("walks the root itself for the repository-root predicate", () => {
    // Empty folders is what `load_project({project_path})` does with no filter.
    expect(resolve_corpus_predicate("repository-root").folders).toEqual([]);
  });

  it("builds a folder predicate that admits everything discovery returns", () => {
    const predicate = resolve_corpus_predicate("folder:src/vs/base");
    expect(predicate.folders).toEqual(["src/vs/base"]);
    expect(predicate.extensions).toEqual([]);
  });

  it("builds a .ts-only folder predicate", () => {
    // AC #3's smoke run is stated over `.ts` files, and `src/vs/base` holds
    // four `.js` files, two of which sort inside the first 200.
    const predicate = resolve_corpus_predicate("folder-ts:src/vs/base");
    expect(predicate.folders).toEqual(["src/vs/base"]);
    expect(predicate.extensions).toEqual([".ts"]);
  });

  it("refuses an unknown predicate, naming the forms that exist", () => {
    expect(() =>
      parse_corpus_predicate_name("srcc"),
    ).toThrow(/Unknown corpus predicate "srcc"/);
  });

  it("refuses a folder predicate with no folder", () => {
    expect(() => parse_corpus_predicate_name("folder:")).toThrow(
      /needs a path/,
    );
  });

  it("refuses a predicate that is not a string", () => {
    expect(() => parse_corpus_predicate_name(7)).toThrow(/must be a string/);
  });
});

describe("discover_corpus over the in-repo benchmark corpus", () => {
  it("selects the src tree for the src predicate", async () => {
    const files = await discover_corpus(CORPUS, "src");
    expect(files.map((file) => path.relative(CORPUS, file))).toEqual([
      "src/callback.ts",
      "src/duplicate_exports.js",
      "src/entry.ts",
      "src/handlers.ts",
      "src/orphan.ts",
      "src/registry.ts",
      "src/unresolved.ts",
      "src/utils.ts",
    ]);
  });

  it("selects one more file at the repository root than under src", async () => {
    // The two predicates answer differently, which is why a row names which
    // one it is for and rows for the two are never compared.
    const from_src = await discover_corpus(CORPUS, "src");
    const from_root = await discover_corpus(CORPUS, "repository-root");
    expect(from_root.length - from_src.length).toEqual(1);
    expect(
      from_root
        .map((file) => path.relative(CORPUS, file))
        .filter((file) => !file.startsWith("src/")),
    ).toEqual(["tools/build_report.ts"]);
  });

  it("drops the .js file under a .ts-only predicate", async () => {
    const files = await discover_corpus(CORPUS, "folder-ts:src");
    expect(files.map((file) => path.relative(CORPUS, file))).toEqual([
      "src/callback.ts",
      "src/entry.ts",
      "src/handlers.ts",
      "src/orphan.ts",
      "src/registry.ts",
      "src/unresolved.ts",
      "src/utils.ts",
    ]);
  });

  it("returns files in a path order that does not depend on the filesystem", async () => {
    const files = await discover_corpus(CORPUS, "src");
    expect([...files].sort(compare_paths)).toEqual(files);
  });
});

describe("PINNED_CORPUS_COUNTS", () => {
  it("records the four defensible counts of one corpus at one commit", () => {
    // Quoting any one of them alone has already caused an argument: two are
    // shell `find` results and two are Ariadne's own walk, differing by 49%.
    expect(
      PINNED_CORPUS_COUNTS.map((entry) => [entry.predicate, entry.file_count]),
    ).toEqual([
      ["src", 8494],
      ["repository-root", 12654],
      ["shell: `.ts` under `src/` excluding `.d.ts`", 8451],
      ["shell: `.ts` under `src/` including `.d.ts`", 8648],
    ]);
  });

  it("pins every count to the corpus commit that produced it", () => {
    expect(
      PINNED_CORPUS_COUNTS.every(
        (entry) =>
          entry.corpus === "microsoft/vscode" && entry.corpus_commit === "f3fa55c3",
      ),
    ).toEqual(true);
  });
});
