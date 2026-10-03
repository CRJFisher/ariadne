import { describe, expect, it } from "vitest";
import { heap_mb_for, required_heap_mb } from "./heap_requirement";
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
    const by_corpus = (a: { corpus: string }, b: { corpus: string }): number =>
      a.corpus.localeCompare(b.corpus);
    expect([...fitted].sort(by_corpus)).toEqual(
      recorded.filter((row) => row.corpus !== "celery/celery").sort(by_corpus)
    );
  });

  it("name the vscode file sets and caps the memory contract holds", () => {
    const [src, root] = RECORDED_HEAP_REQUIREMENT.rows.filter(
      (row) => row.corpus === "microsoft/vscode"
    );
    expect([
      [
        src.predicate,
        src.offered_files,
        src.previous_heap_cap_mb,
        src.peak_rss_mb,
      ],
      [
        root.predicate,
        root.offered_files,
        root.previous_heap_cap_mb,
        root.peak_rss_mb,
      ],
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

describe("the ten evidence corpora re-run under the bytes-fitted caps", () => {
  const RERUN = RECORDED_HEAP_REQUIREMENT.rerun;

  it("cover the ten corpora of the earlier record, over the same file sets", () => {
    const describe_row = (
      corpus: string,
      predicate: string,
      offered: number,
      indexed: number
    ): string => `${corpus} ${predicate} ${offered} ${indexed}`;
    expect(
      RERUN.map((row) =>
        describe_row(row.corpus, row.predicate, row.offered_files, row.indexed)
      ).sort()
    ).toEqual(
      RECORDED_CORPUS_RESOLUTION.rows
        .map((row) =>
          describe_row(
            row.corpus,
            row.predicate,
            row.file_counts.offered,
            row.file_counts.indexed
          )
        )
        .sort()
    );
  });

  it("ran under the cap the requirement gives each, which V8 reports 48 MB above the flag", () => {
    expect(
      RERUN.filter(
        (row) => row.heap_cap_mb !== heap_mb_for(row.offered_bytes) + 48
      )
    ).toEqual([]);
  });

  it("reached a peak below the requirement for its file set", () => {
    expect(
      RERUN.filter(
        (row) => row.peak_rss_mb >= required_heap_mb(row.offered_bytes)
      )
    ).toEqual([]);
  });

  it("reported every call-graph fingerprint component byte-identical to the control arm of the same tree", () => {
    expect(
      RERUN.filter(
        (row) =>
          JSON.stringify(row.fingerprint) !==
          JSON.stringify(row.control.fingerprint)
      ).map((row) => row.corpus)
    ).toEqual([]);
  });

  it("changed the cap on the corpora large enough for it to differ, and only the memory columns moved", () => {
    expect(
      RERUN.map((row) => [row.corpus, row.control.heap_cap_mb, row.heap_cap_mb])
    ).toEqual([
      ["angular/angular", 11700, 5722],
      ["rust-lang/rust", 6750, 7693],
      ["tokio-rs/tokio", 2144, 2096],
      ["launchbadge/sqlx", 2144, 2096],
      ["microsoft/TypeScript", 14336, 5990],
      ["django/django", 5868, 3253],
      ["pandas-dev/pandas", 3239, 3643],
      ["celery/celery", 2144, 2096],
      ["expressjs/express", 2144, 2096],
      ["mochajs/mocha", 2144, 2096],
    ]);
  });
});
