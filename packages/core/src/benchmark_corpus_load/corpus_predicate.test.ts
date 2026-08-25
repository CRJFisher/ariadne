/**
 * Which files a row is about.
 *
 * The extension set is part of the predicate rather than a flag beside it, and
 * these tests pin why: the same folder under two predicates is two different
 * file sets that index identically and diverge on everything else.
 */

import { describe, expect, it } from "vitest";
import * as path from "node:path";
import {
  assert_pinned_file_count,
  compare_paths,
  discover_corpus,
  parse_corpus_predicate_name,
  resolve_corpus_predicate,
  PINNED_CORPUS_COUNTS,
  type CorpusIdentity,
} from "./corpus_predicate";
import { find_ariadne_repo_root } from "./measurement_row";

const CORPUS = path.join(
  find_ariadne_repo_root(),
  "packages",
  "core",
  "benchmark_corpus",
);

function vscode_at(
  overrides: Partial<CorpusIdentity> = {},
): CorpusIdentity {
  return {
    corpus_name: "microsoft/vscode",
    corpus_root: "/corpora/vscode",
    corpus_commit: "f3fa55c3",
    predicate: "src",
    ...overrides,
  };
}

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
    // The pinned smoke run is stated over `.ts` files, and `src/vs/base` holds
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
      "src/aaa_first_reader.ts",
      "src/arithmetic.ts",
      "src/callback.ts",
      "src/duplicate_exports.js",
      "src/entry.ts",
      "src/handlers.ts",
      "src/orphan.ts",
      "src/registry.ts",
      "src/unresolved.ts",
      "src/zzz_second_reader.ts",
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
      "src/aaa_first_reader.ts",
      "src/arithmetic.ts",
      "src/callback.ts",
      "src/entry.ts",
      "src/handlers.ts",
      "src/orphan.ts",
      "src/registry.ts",
      "src/unresolved.ts",
      "src/zzz_second_reader.ts",
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

describe("assert_pinned_file_count", () => {
  it("passes a walk that found the count pinned for that corpus", () => {
    expect(() => assert_pinned_file_count(vscode_at(), 8494)).not.toThrow();
  });

  it("refuses a walk that found a different count under the same name", () => {
    // Every corpus-scale figure is stated over the pinned count. A walk that
    // starts selecting a different file set re-bases all of them at once.
    expect(() => assert_pinned_file_count(vscode_at(), 8500)).toThrow(
      /found 8500 files, but 8494 is pinned for it/,
    );
  });

  it("holds each predicate to its own count", () => {
    expect(() =>
      assert_pinned_file_count(vscode_at({ predicate: "repository-root" }), 8494),
    ).toThrow(/found 8494 files, but 12654 is pinned for it/);
    expect(() =>
      assert_pinned_file_count(
        vscode_at({ predicate: "repository-root" }),
        12654,
      ),
    ).not.toThrow();
  });

  it("matches a full commit sha against the abbreviation the pin records", () => {
    expect(() =>
      assert_pinned_file_count(
        vscode_at({ corpus_commit: "f3fa55c3a1b2c3d4e5f60718293a4b5c6d7e8f90" }),
        8494,
      ),
    ).not.toThrow();
  });

  it("leaves a corpus, commit or predicate it has no count for unconstrained", () => {
    // The pin records what has been measured; it is not a whitelist of what may
    // be measured.
    expect(() =>
      assert_pinned_file_count(vscode_at({ corpus_commit: "0000000" }), 12),
    ).not.toThrow();
    expect(() =>
      assert_pinned_file_count(vscode_at({ corpus_name: "some/other" }), 12),
    ).not.toThrow();
    expect(() =>
      assert_pinned_file_count(vscode_at({ predicate: "folder:src/vs" }), 12),
    ).not.toThrow();
  });

  it("never matches a shell count, which is not a predicate the harness runs", () => {
    // The two shell rows are recorded so a count quoted from a one-liner can be
    // told apart from Ariadne's walk. Their predicate strings can never equal a
    // CorpusPredicateName.
    const shell_predicates = PINNED_CORPUS_COUNTS.filter((entry) =>
      entry.predicate.startsWith("shell: "),
    );
    expect(shell_predicates.length).toEqual(2);
    for (const entry of shell_predicates) {
      expect(() =>
        assert_pinned_file_count(
          vscode_at({ predicate: entry.predicate as never }),
          entry.file_count + 1,
        ),
      ).toThrow();
    }
  });
});
