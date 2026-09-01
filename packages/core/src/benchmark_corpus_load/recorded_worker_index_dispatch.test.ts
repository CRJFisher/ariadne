/**
 * The record is only worth keeping while it stays internally consistent:
 * provenance complete, the arms genuinely interleaved across two checkouts, the
 * wall target computed from a share measured before any pool code existed, and
 * the four claims it exists to carry — wall meets the computed target, CPU
 * stays inside the permitted rise, nothing the pipeline reports moves, and the
 * memory contract still holds — still true of the numbers written down.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_WORKER_INDEX_DISPATCH } from "./recorded_worker_index_dispatch";
import { RECORDED_ORDER_INDEPENDENCE } from "./recorded_order_independence";
import { compute_worker_width } from "../dispatch_to_workers/worker_width";

const RECORD = RECORDED_WORKER_INDEX_DISPATCH;

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function arms_named(name: string) {
  return RECORD.arms.filter((arm) => arm.arm === name);
}

describe("RECORDED_WORKER_INDEX_DISPATCH", () => {
  it("names its full provenance", () => {
    expect({
      corpus: RECORD.corpus,
      corpus_commit: RECORD.corpus_commit,
      predicate: RECORD.predicate,
      discovered_files: RECORD.discovered_files,
      indexed_files: RECORD.indexed_files,
      dropped_files: RECORD.dropped_files,
      machine: RECORD.machine,
      node_version: RECORD.node_version,
      cpu_count: RECORD.cpu_count,
      ingest_order: RECORD.ingest_order,
      control_commit: RECORD.control_commit,
      candidate_commit: RECORD.candidate_commit,
      heap_ceiling_mb: RECORD.heap_ceiling_mb,
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
      control_commit: "2b13f344",
      candidate_commit: "ecca77cd",
      heap_ceiling_mb: 12288,
    });
  });

  it("takes the share on the tree BEFORE the pool, so the target was not fitted to the result", () => {
    expect(RECORD.share_arm_commit).toBe(RECORD.control_commit);
    expect(RECORD.share_arm_commit).not.toBe(RECORD.candidate_commit);
  });

  it("computes the share from the phase split it records", () => {
    const share =
      RECORD.share_arm_phases.parse_and_index_s / RECORD.share_arm_cpu_s;
    expect(share).toBeCloseTo(RECORD.parallelisable_share, 3);
  });

  it("accounts for the whole of the share arm's CPU in its phases", () => {
    const phases = RECORD.share_arm_phases;
    const summed =
      phases.initialize_s +
      phases.read_s +
      phases.parse_and_index_s +
      phases.apply_to_registries_s +
      phases.resolve_corpus_s +
      phases.trace_call_graph_s;
    expect(summed).toBeCloseTo(RECORD.share_arm_cpu_s, 0);
  });

  it("computes the wall target from the measured share and the criterion's efficiency", () => {
    const share = RECORD.parallelisable_share;
    const target =
      RECORD.serial_wall_s * (1 - share + share / RECORD.target_efficiency);
    expect(target).toBeCloseTo(RECORD.target_wall_s, 1);
  });

  it("meets the computed wall target", () => {
    expect(RECORD.achieved_wall_s).toBeLessThan(RECORD.target_wall_s);
  });

  it("takes its wall and CPU figures from the arms it records", () => {
    const serial = arms_named("serial");
    const pooled = arms_named("pool-w5");
    expect(serial).toHaveLength(2);
    expect(pooled).toHaveLength(2);
    expect(mean(serial.map((arm) => arm.wall_s))).toBeCloseTo(
      RECORD.serial_wall_s,
      1,
    );
    expect(mean(pooled.map((arm) => arm.wall_s))).toBeCloseTo(
      RECORD.achieved_wall_s,
      1,
    );
    expect(mean(serial.map((arm) => arm.cpu_s))).toBeCloseTo(
      RECORD.serial_cpu_s,
      1,
    );
    expect(mean(pooled.map((arm) => arm.cpu_s))).toBeCloseTo(
      RECORD.pooled_cpu_s,
      1,
    );
  });

  it("interleaves the two checkouts rather than running each to completion", () => {
    const commits = [...RECORD.arms]
      .filter((arm) => arm.arm === "serial" || arm.arm === "pool-w5")
      .sort((a, b) => a.sequence_index - b.sequence_index)
      .map((arm) => arm.ariadne_commit);
    expect(commits).toEqual([
      RECORD.control_commit,
      RECORD.candidate_commit,
      RECORD.control_commit,
      RECORD.candidate_commit,
    ]);
  });

  it("spends more CPU than the serial arm, inside what the criterion permits", () => {
    expect(RECORD.cpu_ratio).toBeCloseTo(
      RECORD.pooled_cpu_s / RECORD.serial_cpu_s,
      3,
    );
    expect(RECORD.cpu_ratio).toBeGreaterThan(1);
    expect(RECORD.cpu_ratio).toBeLessThan(RECORD.cpu_ratio_permitted);
  });

  it("reports the main-thread deserialize the pool cannot remove", () => {
    const pooled = arms_named("pool-w5");
    for (const arm of pooled) expect(arm.main_deserialize_s).toBeGreaterThan(0);
    expect(
      mean(pooled.map((arm) => arm.main_deserialize_s / arm.wall_s)),
    ).toBeCloseTo(RECORD.main_deserialize_share_of_wall, 2);
  });

  it("records the width its own rule computes at each load it saw", () => {
    for (const reading of RECORD.width_on_this_box) {
      expect(compute_worker_width(RECORD.cpu_count, reading.loadavg)).toBe(
        reading.computed_width,
      );
    }
  });

  it("computes a width of one under contention, which is what makes the contended arm the width-one arm", () => {
    const contended = RECORD.arms.find(
      (arm) => arm.arm === "contended-computed",
    );
    expect(contended?.worker_width).toBe(1);
    expect(
      compute_worker_width(RECORD.cpu_count, contended?.loadavg_at_start ?? 0),
    ).toBe(1);
  });

  it("reports the same call graph as the serial arm at every size and width", () => {
    expect(RECORD.fingerprint_agreement.map((row) => row.offered_files)).toEqual(
      [200, 1200, 8494],
    );
    for (const row of RECORD.fingerprint_agreement) {
      expect(row.identical_to_serial).toBe(true);
      expect(row.widths).toEqual([5, 1]);
    }
  });

  it("reports the fingerprint this corpus already has on record", () => {
    const full_corpus = RECORDED_ORDER_INDEPENDENCE.slices.find(
      (slice) => slice.offered_files === RECORD.discovered_files,
    );
    const agreed = full_corpus?.agreed_components;
    expect(agreed).toBeDefined();
    if (agreed === undefined) return;

    for (const [component, digest] of Object.entries(agreed)) {
      expect(RECORD.full_corpus_fingerprint[component]).toBe(
        `${digest.count}/${digest.hash}`,
      );
    }
    expect(RECORD.canonical_hash).toBe(full_corpus?.agreed_canonical_hash);
  });

  it("keeps the retention arms it drew its transport conclusion from", () => {
    const by_transport = new Map(
      RECORD.retention.map((arm) => [arm.transport, arm]),
    );
    const direct = by_transport.get("built directly");
    const json = by_transport.get("JSON");
    const shared = by_transport.get("JSON, strings shared");

    for (const arm of RECORD.retention) {
      expect(arm.offered_files).toBe(1200);
      expect(arm.live_heap_mb.length).toBeGreaterThanOrEqual(2);
    }
    expect(mean(json?.live_heap_mb ?? [])).toBeGreaterThan(
      mean(direct?.live_heap_mb ?? []),
    );
    expect(mean(shared?.live_heap_mb ?? [])).toBeLessThan(
      mean(direct?.live_heap_mb ?? []),
    );
  });

  it("retains less over the whole corpus than the serial load it replaces", () => {
    expect(RECORD.corpus_live_heap_mb_unshared).toBeGreaterThan(
      RECORD.serial_live_heap_mb,
    );
    expect(RECORD.corpus_live_heap_mb_shared).toBeLessThan(
      RECORD.serial_live_heap_mb,
    );
  });

  it("carries every claim its own arms refute", () => {
    expect(RECORD.corrections.length).toBe(4);
    for (const correction of RECORD.corrections) {
      expect(correction.claim.length).toBeGreaterThan(0);
      expect(correction.measured.length).toBeGreaterThan(0);
    }
  });
});
