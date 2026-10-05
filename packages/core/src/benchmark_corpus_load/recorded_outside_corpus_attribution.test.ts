/**
 * The record holds only while it states what the change did: relabel failures
 * and resolve nothing. Every taxonomy closes over its own call references, the
 * resolved count agrees across arms, the two arms carry the same unresolved
 * total, and the corpora are the ones `RECORDED_CORPUS_RESOLUTION` names.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_CORPUS_RESOLUTION } from "./recorded_corpus_resolution";
import { RECORDED_OUTSIDE_CORPUS_ATTRIBUTION } from "./recorded_outside_corpus_attribution";
import { RESOLUTION_FAILURE_REASONS, unresolved_total } from "./failure_taxonomy";

const ROWS = RECORDED_OUTSIDE_CORPUS_ATTRIBUTION.rows;

describe("RECORDED_OUTSIDE_CORPUS_ATTRIBUTION", () => {
  it("covers the corpora RECORDED_CORPUS_RESOLUTION measures", () => {
    expect(ROWS.map((row) => row.corpus)).toEqual(
      RECORDED_CORPUS_RESOLUTION.rows.map((row) => row.corpus),
    );
  });

  it("closes every taxonomy over its call references and carries every reason", () => {
    const expected = [...RESOLUTION_FAILURE_REASONS].sort();
    for (const row of ROWS) {
      for (const taxonomy of [row.control, row.candidate]) {
        expect(taxonomy.resolved + unresolved_total(taxonomy)).toEqual(taxonomy.call_references);
        expect(Object.keys(taxonomy.by_reason).sort()).toEqual(expected);
      }
    }
  });

  it("resolves exactly the calls the control resolved, and fails exactly as many", () => {
    for (const row of ROWS) {
      expect(row.candidate.call_references).toEqual(row.control.call_references);
      expect(row.candidate.resolved).toEqual(row.control.resolved);
      expect(unresolved_total(row.candidate)).toEqual(unresolved_total(row.control));
    }
  });

  it("moves failures only into and out of the reasons the change names", () => {
    const moved = new Set(["name_not_in_scope", "method_not_on_type", "callee_is_a_language_global", "import_unresolved"]);
    for (const row of ROWS) {
      for (const reason of RESOLUTION_FAILURE_REASONS) {
        if (moved.has(reason)) continue;
        expect([row.corpus, reason, row.candidate.by_reason[reason]]).toEqual([
          row.corpus,
          reason,
          row.control.by_reason[reason],
        ]);
      }
      expect(row.control.by_reason.callee_is_a_language_global).toEqual(0);
      expect(row.control.by_reason.import_unresolved).toEqual(0);
    }
  });

  it("pins the call edges and raw entry points that must not move", () => {
    expect(
      ROWS.map((row) => [row.corpus, row.call_edges.split("/")[0], row.raw_entry_points.split("/")[0]]),
    ).toMatchInlineSnapshot(`
      [
        [
          "angular/angular",
          "168723",
          "2893",
        ],
        [
          "rust-lang/rust",
          "97911",
          "19479",
        ],
        [
          "tokio-rs/tokio",
          "7895",
          "2339",
        ],
        [
          "launchbadge/sqlx",
          "3699",
          "1461",
        ],
        [
          "microsoft/TypeScript",
          "75611",
          "727",
        ],
        [
          "django/django",
          "67057",
          "2279",
        ],
        [
          "pandas-dev/pandas",
          "84168",
          "2085",
        ],
        [
          "celery/celery",
          "9549",
          "717",
        ],
        [
          "expressjs/express",
          "5250",
          "21",
        ],
        [
          "mochajs/mocha",
          "6938",
          "70",
        ],
      ]
    `);
  });

  it("accounts for pandas's numpy and pytest receivers and rustc's prelude", () => {
    const pandas = ROWS.find((row) => row.corpus === "pandas-dev/pandas")!;
    const rustc = ROWS.find((row) => row.corpus === "rust-lang/rust")!;
    const moved_share = (control: number, candidate: number) => (control - candidate) / control;
    expect(
      moved_share(pandas.control.by_reason.method_not_on_type, pandas.candidate.by_reason.method_not_on_type),
    ).toBeGreaterThan(0.6);
    expect(
      rustc.candidate.by_reason.callee_is_a_language_global / rustc.control.by_reason.name_not_in_scope,
    ).toBeGreaterThan(0.277);
  });
});
