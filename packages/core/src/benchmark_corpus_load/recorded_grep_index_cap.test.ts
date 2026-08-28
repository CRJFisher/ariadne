/**
 * The record is only worth keeping while it stays internally consistent:
 * provenance complete, the arms genuinely interleaved, and the four claims it
 * exists to carry — the cap frees memory, it costs no CPU, it reports the same
 * call graph and the same evidence, and the stoplist beside it was measured and
 * refuted — still true of the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_GREP_INDEX_CAP } from "./recorded_grep_index_cap";
import { RECORDED_ORDER_INDEPENDENCE } from "./recorded_order_independence";
import { MAX_GREP_HITS } from "../classify_entry_points/extract_entry_point_diagnostics";

const ARMS = RECORDED_GREP_INDEX_CAP.arms;
const STOPLIST = RECORDED_GREP_INDEX_CAP.stoplist;

const CONTROL_ARMS = ARMS.filter((arm) => arm.arm === "control");
const CANDIDATE_ARMS = ARMS.filter((arm) => arm.arm === "candidate");

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("RECORDED_GREP_INDEX_CAP", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORDED_GREP_INDEX_CAP.corpus,
      corpus_commit: RECORDED_GREP_INDEX_CAP.corpus_commit,
      predicate: RECORDED_GREP_INDEX_CAP.predicate,
      discovered_files: RECORDED_GREP_INDEX_CAP.discovered_files,
      indexed_files: RECORDED_GREP_INDEX_CAP.indexed_files,
      dropped_files: RECORDED_GREP_INDEX_CAP.dropped_files,
      machine: RECORDED_GREP_INDEX_CAP.machine,
      node_version: RECORDED_GREP_INDEX_CAP.node_version,
      cpu_count: RECORDED_GREP_INDEX_CAP.cpu_count,
      ingest_order: RECORDED_GREP_INDEX_CAP.ingest_order,
      heap_ceiling_mb: RECORDED_GREP_INDEX_CAP.heap_ceiling_mb,
      base_commit: RECORDED_GREP_INDEX_CAP.base_commit,
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
      discovered_files: 8494,
      indexed_files: 8494,
      dropped_files: 0,
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      ingest_order: "forward",
      heap_ceiling_mb: 12288,
      base_commit: "743d963c",
    });
  });

  it("runs the candidate between two controls", () => {
    expect(ARMS.map((arm) => arm.arm)).toEqual([
      "control",
      "candidate",
      "control",
    ]);
    expect(ARMS.map((arm) => arm.sequence_index)).toEqual([0, 1, 2]);
  });

  it("measures over the 8,494-file set rather than the pre-readmission one", () => {
    // TASK-381.8 readmits 603 files, so the pre-figure is this session's own
    // control arms and not the 1,083,422 hits measured over 7,891 files.
    expect(RECORDED_GREP_INDEX_CAP.indexed_files).toEqual(
      RECORDED_GREP_INDEX_CAP.discovered_files,
    );
    for (const arm of CONTROL_ARMS) {
      expect(arm.hits_retained).toEqual(
        RECORDED_GREP_INDEX_CAP.hits_retained.uncapped,
      );
      expect(arm.retained_mb).toEqual(
        RECORDED_GREP_INDEX_CAP.retained_mb.uncapped,
      );
    }
    for (const arm of CANDIDATE_ARMS) {
      expect(arm.hits_retained).toEqual(
        RECORDED_GREP_INDEX_CAP.hits_retained.capped,
      );
      expect(arm.retained_mb).toEqual(
        RECORDED_GREP_INDEX_CAP.retained_mb.capped,
      );
    }
  });

  it("frees the hits and the bytes the criterion asks for", () => {
    const hit_ratio =
      RECORDED_GREP_INDEX_CAP.hits_retained.uncapped /
      RECORDED_GREP_INDEX_CAP.hits_retained.capped;
    const byte_ratio =
      RECORDED_GREP_INDEX_CAP.retained_mb.uncapped /
      RECORDED_GREP_INDEX_CAP.retained_mb.capped;
    expect(hit_ratio).toBeGreaterThanOrEqual(4.9);
    expect(byte_ratio).toBeGreaterThanOrEqual(3.7);
  });

  it("keeps at most MAX_GREP_HITS of the name that dominates the index", () => {
    expect(RECORDED_GREP_INDEX_CAP.largest_name_hits.capped).toEqual(
      MAX_GREP_HITS,
    );
    expect(
      RECORDED_GREP_INDEX_CAP.largest_name_hits.uncapped,
    ).toBeGreaterThan(RECORDED_GREP_INDEX_CAP.hits_retained.capped / 2);
  });

  it("costs no CPU over the whole corpus, and says so", () => {
    const control_total = mean(CONTROL_ARMS.map((arm) => arm.total_cpu_ms));
    const candidate_total = mean(CANDIDATE_ARMS.map((arm) => arm.total_cpu_ms));
    const run_ratio = candidate_total / control_total;
    expect(run_ratio).toBeGreaterThan(0.95);
    expect(run_ratio).toBeLessThan(1.05);

    // The load phase is identical code in both arms, so whatever it moves by is
    // the session's own drift — and it accounts for most of the run's move.
    const control_load = mean(CONTROL_ARMS.map((arm) => arm.load_cpu_ms));
    const candidate_load = mean(CANDIDATE_ARMS.map((arm) => arm.load_cpu_ms));
    const load_drift = Math.abs(1 - candidate_load / control_load);
    expect(load_drift).toBeGreaterThan(Math.abs(1 - run_ratio) / 2);

    expect(RECORDED_GREP_INDEX_CAP.verdict).toContain("MEMORY FIX");
    expect(RECORDED_GREP_INDEX_CAP.verdict).toContain("not a speedup");
  });

  it("reports the same call graph and the same diagnostics payload", () => {
    const identity = RECORDED_GREP_INDEX_CAP.identity_arms;
    const components = Object.entries(identity.fingerprint);
    expect(components).toHaveLength(7);
    for (const [, value] of components) {
      expect(value).toMatch(/^\d+\/[0-9a-f]{16}$/);
    }
    expect(identity.fingerprint.raw_entry_points.split("/")[0]).toEqual(
      String(identity.entry_points),
    );
    expect(identity.fingerprint.dropped_files.split("/")[0]).toEqual(
      String(RECORDED_GREP_INDEX_CAP.dropped_files),
    );
    // Both hashes, not just the canonical one: a cap fed in walk order would
    // move membership, and a cap that reordered evidence would move only the
    // emitted hash. Neither moves.
    expect(identity.diag_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(identity.canonical_hash).toMatch(/^[0-9a-f]{16}$/);

    // And it is the value already on record for this corpus in this order, so
    // the pair of arms is anchored rather than merely self-consistent.
    const full_corpus = RECORDED_ORDER_INDEPENDENCE.slices.find(
      (slice) => slice.offered_files === RECORDED_GREP_INDEX_CAP.discovered_files,
    );
    if (!full_corpus) throw new Error("expected a full-corpus slice on record");
    const forward = full_corpus.arms.find(
      (arm) => arm.ingest_order === RECORDED_GREP_INDEX_CAP.ingest_order,
    );
    if (!forward) throw new Error("expected a forward arm on record");
    expect(identity.fingerprint).toEqual(
      Object.fromEntries(
        Object.entries(forward.components).map(([component, digest]) => [
          component,
          `${digest.count}/${digest.hash}`,
        ]),
      ),
    );
    expect({
      diag_hash: identity.diag_hash,
      canonical_hash: identity.canonical_hash,
    }).toEqual({
      diag_hash: forward.diag_hash,
      canonical_hash: forward.canonical_hash,
    });

    // The pass that contains the change costs the same wall to run.
    const extraction_ratio =
      identity.extraction_wall_ms.capped / identity.extraction_wall_ms.uncapped;
    expect(extraction_ratio).toBeGreaterThan(0.99);
    expect(extraction_ratio).toBeLessThan(1.01);
  });

  it("exposes the identical readable window under both shapes", () => {
    expect(RECORDED_GREP_INDEX_CAP.readable_window_digest).toMatch(
      /^[0-9a-f]{40}$/,
    );
    // The capped index IS the readable window: every hit it holds is one an
    // investigator can reach, so the two counts are the same number.
    expect(RECORDED_GREP_INDEX_CAP.hits_retained.capped).toEqual(
      STOPLIST.window_hits,
    );
  });

  it("keeps the stoplist refuted by the measurement that refuted it", () => {
    expect(STOPLIST.digest).not.toEqual(
      RECORDED_GREP_INDEX_CAP.readable_window_digest,
    );
    expect(STOPLIST.hits_removed_from_window).toBeGreaterThan(0);
    // The window it damages is a rounding error against the index the cap
    // already emptied — the trade the verdict refuses.
    expect(STOPLIST.hits_removed_from_window / STOPLIST.window_hits).toBeLessThan(
      0.01,
    );
    expect(STOPLIST.hits_removed_from_uncapped_index).toBeLessThan(
      RECORDED_GREP_INDEX_CAP.hits_retained.uncapped -
        RECORDED_GREP_INDEX_CAP.hits_retained.capped,
    );
    // The four names the premise breaks on are legal TypeScript method names.
    for (const keyword of ["catch", "new", "for", "typeof"]) {
      expect(STOPLIST.keywords).toContain(keyword);
    }
    expect(STOPLIST.verdict).toContain("Refuted");
  });
});
