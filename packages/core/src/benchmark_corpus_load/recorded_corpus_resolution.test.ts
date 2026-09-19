/**
 * The record holds only while it stays internally consistent and comparable
 * with the baseline it is read against: the same nine corpora at the same
 * commits over the same file sets, every taxonomy closing over its own call
 * references and agreeing with its fingerprint, every reason present in every
 * row, and the refused corpus refused in the harness's own words.
 *
 * The recovery assertions are the epic's result, stated as the two figures a
 * reader acts on — how many calls the resolver places, and how many functions
 * it still reports as reached by nothing.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_CORPUS_RESOLUTION } from "./recorded_corpus_resolution";
import { RECORDED_FAILURE_TAXONOMY_BASELINE } from "./recorded_failure_taxonomy_baseline";
import { RESOLUTION_FAILURE_REASONS, unresolved_total } from "./failure_taxonomy";

const ACHIEVED = RECORDED_CORPUS_RESOLUTION;
const BASELINE = RECORDED_FAILURE_TAXONOMY_BASELINE;

/** The baseline row for a corpus, which every row here has a counterpart in. */
function baseline_for(corpus: string) {
  const row = BASELINE.rows.find((candidate) => candidate.corpus === corpus);
  if (row === undefined) throw new Error(`No baseline row for ${corpus}`);
  return row;
}

describe("RECORDED_CORPUS_RESOLUTION", () => {
  it("names both trees it compares and the box both ran on", () => {
    expect({
      ariadne_commit: ACHIEVED.ariadne_commit,
      control_commit: ACHIEVED.control_commit,
      machine: ACHIEVED.machine,
      cpu_count: ACHIEVED.cpu_count,
      total_memory_mb: ACHIEVED.total_memory_mb,
      node_version: ACHIEVED.node_version,
      tree_sitter_version: ACHIEVED.tree_sitter_version,
      tree_sitter_typescript_version: ACHIEVED.tree_sitter_typescript_version,
    }).toEqual({
      ariadne_commit: "038b7daa",
      control_commit: "a3d5beea",
      machine: "Darwin 24.6.0 x64",
      cpu_count: 6,
      total_memory_mb: 32768,
      node_version: "v22.22.1",
      tree_sitter_version: "0.25.0",
      tree_sitter_typescript_version: "0.23.2",
    });
  });

  it("covers the same ten evidence corpora as the baseline: nine measured, one refused", () => {
    expect(ACHIEVED.rows.map((row) => row.corpus)).toEqual(
      BASELINE.rows.map((row) => row.corpus),
    );
    expect(ACHIEVED.not_measured).toEqual(BASELINE.not_measured);
  });

  it("measures each corpus over exactly the file set the baseline measured", () => {
    for (const row of ACHIEVED.rows) {
      const baseline = baseline_for(row.corpus);
      expect({
        corpus_commit: row.corpus_commit,
        predicate: row.predicate,
        file_counts: row.file_counts,
      }).toEqual({
        corpus_commit: baseline.corpus_commit,
        predicate: baseline.predicate,
        file_counts: baseline.file_counts,
      });
    }
  });

  it("closes every taxonomy over its call references and agrees with the fingerprint's unresolved count", () => {
    for (const row of ACHIEVED.rows) {
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
    for (const row of ACHIEVED.rows) {
      expect(Object.keys(row.failure_taxonomy.by_reason).sort()).toEqual(expected);
    }
  });

  it("records each arm as its own process", () => {
    expect(new Set(ACHIEVED.rows.map((row) => row.session_id)).size).toEqual(
      ACHIEVED.rows.length,
    );
  });

  it("pins the call edges each corpus resolves", () => {
    expect(
      ACHIEVED.rows.map((row) => [row.corpus, row.fingerprint.call_edges.split("/")[0]]),
    ).toEqual([
      ["angular/angular", "158057"],
      ["rust-lang/rust", "96180"],
      ["tokio-rs/tokio", "7762"],
      ["launchbadge/sqlx", "3597"],
      ["django/django", "67102"],
      ["pandas-dev/pandas", "84238"],
      ["celery/celery", "9465"],
      ["expressjs/express", "5250"],
      ["mochajs/mocha", "6936"],
    ]);
  });

  it("pins the raw entry points each corpus still reports", () => {
    expect(
      ACHIEVED.rows.map((row) => [row.corpus, row.fingerprint.raw_entry_points.split("/")[0]]),
    ).toEqual([
      ["angular/angular", "3096"],
      ["rust-lang/rust", "19732"],
      ["tokio-rs/tokio", "2363"],
      ["launchbadge/sqlx", "1524"],
      ["django/django", "2289"],
      ["pandas-dev/pandas", "2085"],
      ["celery/celery", "730"],
      ["expressjs/express", "21"],
      ["mochajs/mocha", "71"],
    ]);
  });

  it("resolves more calls than the baseline where the node set is comparable", () => {
    // A corpus whose node set grew gained call references with it, so its
    // resolved count is not comparable term by term. These three hold the same
    // definitions on both trees, so the rise is recovery and nothing else.
    expect(
      ["angular/angular", "expressjs/express", "mochajs/mocha"].map((corpus) => {
        const row = ACHIEVED.rows.find((candidate) => candidate.corpus === corpus);
        return [corpus, baseline_for(corpus).failure_taxonomy.resolved, row!.failure_taxonomy.resolved];
      }),
    ).toEqual([
      ["angular/angular", 148316, 160166],
      ["expressjs/express", 5429, 5436],
      ["mochajs/mocha", 7431, 7485],
    ]);
  });

  it("records the four permanent limitations a success criterion must not target", () => {
    expect(
      ACHIEVED.permanent_limitations.map((limitation) => [
        limitation.corpus,
        limitation.site,
        limitation.registry_candidate,
      ]),
    ).toEqual([
      ["webpack/webpack", "lib/util/hash/wasm-hash.js:141", "wasm-export-invocation"],
      [
        "nestjs/nest",
        "packages/core/injector/module.ts:111",
        "dynamic-property-keyed-callback",
      ],
      ["celery/celery", "celery/canvas.py:736", "untyped-attribute-receiver"],
      [
        "tokio-rs/tokio",
        "tokio/src/net/tcp/split_owned.rs:452",
        "rust-compiler-injected-drop",
      ],
    ]);
  });
});
