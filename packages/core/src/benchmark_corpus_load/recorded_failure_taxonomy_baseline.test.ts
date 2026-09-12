/**
 * The record is worth keeping only while it stays internally consistent: every
 * taxonomy closes over its own call references and agrees with the
 * fingerprint's unresolved count, every file count closes, every reason is
 * present in every row, and the ten evidence corpora are each either measured
 * or refused with the harness's own words.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_FAILURE_TAXONOMY_BASELINE } from "./recorded_failure_taxonomy_baseline";
import {
  RESOLUTION_FAILURE_REASONS,
  unresolved_total,
} from "./failure_taxonomy";

const BASELINE = RECORDED_FAILURE_TAXONOMY_BASELINE;

describe("RECORDED_FAILURE_TAXONOMY_BASELINE", () => {
  it("names its full provenance", () => {
    expect({
      ariadne_commit: BASELINE.ariadne_commit,
      machine: BASELINE.machine,
      cpu_count: BASELINE.cpu_count,
      total_memory_mb: BASELINE.total_memory_mb,
      node_version: BASELINE.node_version,
      tree_sitter_version: BASELINE.tree_sitter_version,
      tree_sitter_typescript_version: BASELINE.tree_sitter_typescript_version,
    }).toEqual({
      ariadne_commit: "279221d4",
      machine: "Darwin 24.6.0 x64",
      cpu_count: 6,
      total_memory_mb: 32768,
      node_version: "v22.22.1",
      tree_sitter_version: "0.25.0",
      tree_sitter_typescript_version: "0.23.2",
    });
  });

  it("covers the ten evidence corpora: nine measured, one refused", () => {
    expect(BASELINE.rows.map((row) => row.corpus)).toEqual([
      "angular/angular",
      "rust-lang/rust",
      "tokio-rs/tokio",
      "launchbadge/sqlx",
      "django/django",
      "pandas-dev/pandas",
      "celery/celery",
      "expressjs/express",
      "mochajs/mocha",
    ]);
    expect(BASELINE.not_measured.map((entry) => entry.corpus)).toEqual([
      "microsoft/TypeScript",
    ]);
  });

  it("pins each corpus to the commit its checkout was at, and to the triage config's file set", () => {
    expect(
      BASELINE.rows.map((row) => [row.corpus, row.corpus_commit, row.predicate]),
    ).toEqual([
      ["angular/angular", "5ad823139758b4d3a8a021d378b008c3457f8689", "repository-root"],
      [
        "rust-lang/rust",
        "e7b595554e664e6bd281c8cf881093d6c71bc0e1",
        "repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests",
      ],
      ["tokio-rs/tokio", "1a2dbbaa21389ad0b9d20f77e869698c5cab5d68", "repository-root"],
      ["launchbadge/sqlx", "1d674f51581598f55436451d5b4b73100cae0b56", "repository-root"],
      [
        "django/django",
        "957d0cee7167757ae221ffde59d2cf0a322e89c7",
        "repository-root-excluding:js_tests,scripts,docs",
      ],
      ["pandas-dev/pandas", "7986b42596f2354a0970c708ab6072172fe4d06b", "repository-root"],
      ["celery/celery", "7c5d9a62d90c685bd0e1ae002d66ae40980b2847", "repository-root"],
      ["expressjs/express", "ae6dd37680e3a00618d6c8a3e522f0ee4eeba1a4", "repository-root"],
      ["mochajs/mocha", "7cb267830c51d0b9a851086eb8d87013ee7663bd", "repository-root"],
    ]);
  });

  it("offers every discovered file to one process and accounts for all of them", () => {
    for (const row of BASELINE.rows) {
      expect(row.file_counts.offered).toEqual(row.file_counts.discovered);
      expect(row.file_counts.indexed + row.file_counts.dropped).toEqual(
        row.file_counts.offered,
      );
    }
  });

  it("closes every taxonomy over its call references and agrees with the fingerprint's unresolved count", () => {
    for (const row of BASELINE.rows) {
      const unresolved = unresolved_total(row.failure_taxonomy);
      expect(row.failure_taxonomy.resolved + unresolved).toEqual(
        row.failure_taxonomy.call_references,
      );
      const [fingerprint_count] = row.fingerprint.unresolved_calls.split("/");
      expect(Number(fingerprint_count)).toEqual(unresolved);
    }
  });

  it("carries every reason of the vocabulary in every row", () => {
    const expected = [...RESOLUTION_FAILURE_REASONS].sort();
    for (const row of BASELINE.rows) {
      expect(Object.keys(row.failure_taxonomy.by_reason).sort()).toEqual(expected);
    }
  });

  it("records the refused corpus with the harness's own refusal and the count that produced it", () => {
    expect(BASELINE.not_measured).toEqual([
      {
        corpus: "microsoft/TypeScript",
        corpus_commit: "cc5c6e2d32e2228fff83a66537bbe6042943054d",
        predicate: "repository-root-excluding:baselines",
        discovered_files: 19783,
        reason:
          "Refusing to spawn a 19783-file arm over microsoft/TypeScript: it needs a 35122 MB heap (28097 MB required plus headroom) and this box has 32768 MB of memory. Narrow the predicate, or measure on a box that can hold it; a partial arm is never recorded.",
      },
    ]);
  });

  it("records each arm as its own process, with the load the shared box was under", () => {
    // Nine distinct session ids is what "every arm ran alone, in its own
    // process" means; the loadavg and cpu/wall figures are recorded so a
    // reader can see the box was shared, and are never quoted as a cost.
    expect(new Set(BASELINE.rows.map((row) => row.session_id)).size).toEqual(
      BASELINE.rows.length,
    );
    expect(
      BASELINE.rows.map((row) => [
        row.corpus,
        row.cpu_seconds,
        row.wall_seconds,
        row.cpu_per_wall,
        row.loadavg_at_start,
      ]),
    ).toEqual([
      ["angular/angular", 101.3, 86.3, 1.17, [5.2, 4.6, 4.3]],
      ["rust-lang/rust", 95.2, 77.1, 1.24, [4.7, 4.5, 4.2]],
      ["tokio-rs/tokio", 10.3, 8, 1.3, [6.1, 4.4, 4.1]],
      ["launchbadge/sqlx", 6.1, 4.5, 1.35, [6.5, 4.4, 4.1]],
      ["django/django", 255.3, 239.7, 1.07, [4.8, 4.5, 4.2]],
      ["pandas-dev/pandas", 195.5, 182.4, 1.07, [5.6, 4.4, 4.1]],
      ["celery/celery", 20.9, 18.7, 1.12, [4.4, 3.8, 3.9]],
      ["expressjs/express", 2.9, 2.3, 1.25, [4.4, 3.8, 3.9]],
      ["mochajs/mocha", 4.8, 3.7, 1.29, [4.4, 3.8, 3.9]],
    ]);
  });
});
