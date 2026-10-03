import { describe, expect, it } from "vitest";
import { RECORDED_CORPUS_RESOLUTION } from "./recorded_corpus_resolution";
import { RECORDED_HEAP_REQUIREMENT } from "./recorded_heap_requirement";
import { RECORDED_MEMORY_CONTRACT } from "./recorded_memory_contract";

describe("the arms the heap requirement is fitted to", () => {
  it("name the file sets and the caps the two earlier records hold", () => {
    const recorded = RECORDED_CORPUS_RESOLUTION.rows.map((row) => ({
      corpus: row.corpus,
      predicate: row.predicate,
      offered_files: row.file_counts.offered,
      previous_heap_cap_mb: row.heap_cap_mb,
    }));
    const fitted = RECORDED_HEAP_REQUIREMENT.rows
      .filter((row) => row.corpus !== "microsoft/vscode")
      .map((row) => ({
        corpus: row.corpus,
        predicate: row.predicate,
        offered_files: row.offered_files,
        previous_heap_cap_mb: row.previous_heap_cap_mb,
      }));
    const by_corpus = (
      a: { corpus: string },
      b: { corpus: string },
    ): number => a.corpus.localeCompare(b.corpus);
    expect([...fitted].sort(by_corpus)).toEqual(
      recorded.filter((row) => row.corpus !== "celery/celery").sort(by_corpus),
    );
  });

  it("name the vscode file sets and caps the memory contract holds", () => {
    const [src, root] = RECORDED_HEAP_REQUIREMENT.rows.filter(
      (row) => row.corpus === "microsoft/vscode",
    );
    expect([
      [src.predicate, src.offered_files, src.previous_heap_cap_mb, src.peak_rss_mb],
      [root.predicate, root.offered_files, root.previous_heap_cap_mb, root.peak_rss_mb],
    ]).toEqual([
      [
        RECORDED_MEMORY_CONTRACT.predicate,
        RECORDED_MEMORY_CONTRACT.discovered_files,
        RECORDED_MEMORY_CONTRACT.completing[0].heap_cap_mb,
        RECORDED_MEMORY_CONTRACT.completing[0].peak_rss_mb.mean,
      ],
      [
        RECORDED_MEMORY_CONTRACT.other_corpus.predicate,
        RECORDED_MEMORY_CONTRACT.other_corpus.discovered_files,
        RECORDED_MEMORY_CONTRACT.other_corpus.heap_cap_mb,
        RECORDED_MEMORY_CONTRACT.other_corpus.peak_rss_mb.mean,
      ],
    ]);
  });
});
