/**
 * The record is worth keeping only while it stays internally consistent, so
 * every summary here is recomputed from the observations it summarizes rather
 * than trusted, every file count is made to close, and the phase split is made
 * to partition the run it was taken from.
 *
 * The three claims the record exists to carry are asserted directly: the corpus
 * completes in one process, the rollback path through the incremental API is
 * never taken, and no figure is admitted without at least two processes behind
 * it.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_FULL_CORPUS_BASELINE } from "./recorded_full_corpus_baseline";
import { summarize_samples } from "./compare_measurements";

const BASELINE = RECORDED_FULL_CORPUS_BASELINE;
const TOP_LEVEL = "the run";

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** A lookup that fails the test where the record is incomplete, not where it is read. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`the record holds no ${what}`);
  return value;
}

describe("RECORDED_FULL_CORPUS_BASELINE", () => {
  it("names its full provenance", () => {
    expect({
      corpus: BASELINE.corpus,
      corpus_commit: BASELINE.corpus_commit,
      machine: BASELINE.machine,
      node_version: BASELINE.node_version,
      cpu_count: BASELINE.cpu_count,
      ariadne_commit: BASELINE.ariadne_commit,
      control_commit: BASELINE.control_commit,
      ingest_order: BASELINE.ingest_order,
      predicates: BASELINE.corpora.map((arm) => arm.predicate),
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      ariadne_commit: "25af64a8",
      control_commit: "2970604b",
      ingest_order: "forward",
      predicates: ["src", "repository-root"],
    });
  });

  it("records the four defensible file counts for this corpus", () => {
    expect(BASELINE.discovery_counts).toEqual({
      "Ariadne's walk over `src/`": 8494,
      "Ariadne's walk at the repository root": 12654,
      "shell: `.ts` under `src/` excluding `.d.ts`": 8451,
      "shell: `.ts` under `src/` including `.d.ts`": 8648,
    });
  });

  it("offers every discovered file to one process and accounts for all of them", () => {
    for (const arm of BASELINE.corpora) {
      expect(arm.offered).toEqual(arm.discovered_files);
      expect(arm.indexed + arm.dropped).toEqual(arm.offered);
      expect(BASELINE.discovery_counts).toHaveProperty(
        arm.predicate === "src"
          ? "Ariadne's walk over `src/`"
          : "Ariadne's walk at the repository root",
        arm.discovered_files,
      );
    }
  });

  it("reports every corpus figure over at least two processes", () => {
    for (const arm of BASELINE.corpora) {
      expect(arm.processes).toBeGreaterThanOrEqual(2);
      expect(arm.cpu_seconds.observations).toHaveLength(arm.processes);
      expect(arm.peak_rss_mb.observations).toHaveLength(arm.processes);
      expect(arm.settled_heap_mb.observations).toHaveLength(arm.processes);
      expect(arm.wall_seconds).toHaveLength(arm.processes);
      expect(arm.cpu_per_wall).toHaveLength(arm.processes);
      expect(arm.loadavg_at_arm_start).toHaveLength(arm.processes);
    }
  });

  it("summarizes each spread the way the harness does", () => {
    for (const arm of BASELINE.corpora) {
      for (const spread of [
        arm.cpu_seconds,
        arm.peak_rss_mb,
        arm.settled_heap_mb,
      ]) {
        const recomputed = summarize_samples(spread.observations, arm.predicate);
        expect({
          mean: spread.mean,
          min: spread.min,
          max: spread.max,
          spread_percent: spread.spread_percent,
          cv_percent: spread.cv_percent,
        }).toEqual({
          mean: recomputed.mean,
          min: recomputed.min,
          max: recomputed.max,
          spread_percent: recomputed.spread_pct,
          cv_percent: recomputed.cv_pct,
        });
      }
    }
  });

  it("carries all seven fingerprint components for each corpus", () => {
    for (const arm of BASELINE.corpora) {
      expect(Object.keys(arm.fingerprint).sort()).toEqual([
        "call_edges",
        "dropped_files",
        "indirect_reachability_evidence",
        "indirect_reachability_keys",
        "nodes",
        "raw_entry_points",
        "unresolved_calls",
      ]);
      expect(arm.fingerprint.dropped_files.split("/")[0]).toEqual(
        String(arm.dropped),
      );
      expect(arm.fingerprint.raw_entry_points.split("/")[0]).toEqual(
        String(arm.diagnostics.entry_point_count),
      );
    }
  });

  it("names the corpus its phase split was taken over", () => {
    const predicates = BASELINE.corpora.map((arm) => arm.predicate);
    expect(predicates).toContain(BASELINE.phase_split_predicate);
  });

  it("partitions the run with its top-level phases and nests the rest inside one of them", () => {
    const top_level = BASELINE.phase_split.filter(
      (phase) => phase.contained_by === TOP_LEVEL,
    );
    const summed = top_level.reduce((total, phase) => total + phase.cpu_ms, 0);
    expect(summed).toBeCloseTo(BASELINE.phase_split_total_cpu_ms, 1);

    for (const phase of BASELINE.phase_split) {
      if (phase.contained_by === TOP_LEVEL) continue;
      const parent = must(
        BASELINE.phase_split.find(
          (candidate) => candidate.phase === phase.contained_by,
        ),
        `a phase named ${phase.contained_by}`,
      );
      expect(phase.cpu_ms).toBeLessThanOrEqual(parent.cpu_ms);
    }
  });

  it("states each exact phase's share against the run it was taken from", () => {
    for (const phase of BASELINE.phase_split) {
      if (phase.source !== "cpuUsage delta at the boundary") continue;
      expect(phase.share_percent).toBeCloseTo(
        (phase.cpu_ms / BASELINE.phase_split_total_cpu_ms) * 100,
        1,
      );
    }
  });

  it("takes exactly one phase from a sampling profiler, and says which", () => {
    const sampled = BASELINE.phase_split.filter(
      (phase) => phase.source === "cpu-prof sample",
    );
    expect(sampled.map((phase) => phase.phase)).toEqual([
      "resolve_callback_invocations",
    ]);
    expect(sampled[0].contained_by).toEqual("resolve_calls_for_files");
  });

  it("never rolls a dropped file back through the incremental API", () => {
    const incremental = must(
      BASELINE.phase_split.find(
        (phase) => phase.boundary === "Project.remove_file",
      ),
      "a phase for Project.remove_file",
    );
    expect({ calls: incremental.calls, cpu_ms: incremental.cpu_ms }).toEqual({
      calls: 0,
      cpu_ms: 0,
    });

    const rollback = must(
      BASELINE.phase_split.find(
        (phase) => phase.boundary === "Project.evict_ingested_file",
      ),
      "a phase for Project.evict_ingested_file",
    );
    const src = must(
      BASELINE.corpora.find((arm) => arm.predicate === "src"),
      "an arm over `src`",
    );
    expect(rollback.calls).toEqual(src.dropped);
  });

  it("takes every ratio from an interleaved control arm over a nested slice", () => {
    const src = must(
      BASELINE.corpora.find((arm) => arm.predicate === "src"),
      "an arm over `src`",
    );
    for (const slice of BASELINE.control_arm) {
      expect(slice.indexed + slice.dropped).toEqual(slice.offered_files);
      expect(slice.offered_files).toBeLessThan(src.discovered_files);
      expect(slice.reps_per_arm).toBeGreaterThanOrEqual(2);
      expect(slice.control_cpu_seconds).toHaveLength(slice.reps_per_arm);
      expect(slice.candidate_cpu_seconds).toHaveLength(slice.reps_per_arm);
      expect(slice.ratio).toBeCloseTo(
        mean(slice.control_cpu_seconds) / mean(slice.candidate_cpu_seconds),
        2,
      );
    }
  });

  it("shows the ratio rising with the file set, which is why none of them is the corpus's", () => {
    for (let i = 1; i < BASELINE.control_arm.length; i += 1) {
      expect(BASELINE.control_arm[i].offered_files).toBeGreaterThan(
        BASELINE.control_arm[i - 1].offered_files,
      );
      expect(BASELINE.control_arm[i].ratio).toBeGreaterThan(
        BASELINE.control_arm[i - 1].ratio,
      );
    }
  });

  it("keeps each superseded figure with the reason it was replaced", () => {
    expect(BASELINE.superseded.length).toBeGreaterThanOrEqual(5);
    for (const entry of BASELINE.superseded) {
      expect(entry.claim.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.outcome.length).toBeGreaterThan(0);
    }
    const claims = BASELINE.superseded.map((entry) => entry.claim).join(" ");
    expect(claims).toContain("855 s");
    expect(claims).toContain("WITHHELD");
  });
});
