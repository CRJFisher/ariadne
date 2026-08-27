/**
 * The record is worth keeping only while it stays internally consistent:
 * provenance complete, file counts closing, both arms of every ratio repeated
 * in one session across two trees, the ratios reproducible from the
 * repetitions beside them, and the claims it exists to carry still true of the
 * numbers written down — name resolution collapsing to a single call, the
 * repairable import residue reaching zero, the removed entry points named by
 * symbol, and every edge loss accounted for as either pre-existing
 * order-dependence or a stable loss with its callees listed.
 */

import { describe, expect, it } from "vitest";
import { RECORDED_CORPUS_PASS_COST } from "./recorded_corpus_pass_cost";

const RECORD = RECORDED_CORPUS_PASS_COST;

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

describe("RECORDED_CORPUS_PASS_COST", () => {
  it("names its full provenance and both trees", () => {
    expect({
      corpus: RECORD.corpus,
      corpus_commit: RECORD.corpus_commit,
      machine: RECORD.machine,
      node_version: RECORD.node_version,
      cpu_count: RECORD.cpu_count,
      ingest_order: RECORD.ingest_order,
      seed: RECORD.seed,
      unpatched_commit: RECORD.unpatched_commit,
      patched_commit: RECORD.patched_commit,
    }).toEqual({
      corpus: "microsoft/vscode",
      corpus_commit: "f3fa55c3",
      machine: "Darwin 24.6.0 x64",
      node_version: "v22.22.1",
      cpu_count: 6,
      ingest_order: "forward",
      seed: 1,
      unpatched_commit: "39f6c190",
      patched_commit: "b1051ae5",
    });
  });

  it("collapses name resolution to one call at every size", () => {
    expect(RECORD.resolve_names.map((size) => size.calls.after)).toEqual([
      1, 1, 1,
    ]);
    for (const size of RECORD.resolve_names) {
      expect(size.indexed + size.dropped).toEqual(size.file_count);
      // The single call is handed every indexed file, once.
      expect(size.files_resolved.after).toEqual(size.indexed);
      expect(size.calls.before).toBeGreaterThan(size.calls.after);
      expect(size.peak_heap_mb.after).toBeLessThan(size.peak_heap_mb.before);
    }
  });

  it("explains the count rather than only stating it", () => {
    expect(RECORD.resolve_names_reason).toContain("evict_ingested_file");
    expect(RECORD.resolve_names_reason).toContain("resolve_corpus");
  });

  it("holds the n=200 slice's peak heap under 200 MB", () => {
    const slice = RECORD.resolve_names.find(
      (size) => size.file_count === 200 && size.predicate === "src",
    )!;
    expect(slice.peak_heap_mb.after).toBeLessThanOrEqual(200);
    expect(slice.peak_heap_mb.before).toBeGreaterThan(200);
  });

  it("leaves no repairable import pointing at its import statement", () => {
    for (const size of RECORD.import_locations) {
      expect(size.repairable.after).toEqual(0);
      expect(size.repairable.before).toBeGreaterThan(0);
      // The residue is exactly the two shapes that have no declaration to name.
      expect(size.still_on_the_import_statement.after).toEqual(
        size.wildcard_edges + size.name_absent_from_source_exports,
      );
      expect(size.repairable.before).toEqual(
        size.still_on_the_import_statement.before -
          size.wildcard_edges -
          size.name_absent_from_source_exports,
      );
      expect(size.still_on_the_import_statement.before).toBeLessThanOrEqual(
        size.in_corpus_imports,
      );
    }
  });

  it("names every removed entry point by symbol and path:line", () => {
    const repair = RECORD.unreachable_repair;
    expect(
      repair.raw_entry_points.before - repair.raw_entry_points.after,
    ).toEqual(repair.false_entry_points_removed.length);
    expect(repair.entry_points_added).toEqual(0);
    expect(repair.false_entry_points_removed).toEqual([
      {
        symbol: "ToggleActionViewItem.focus",
        path_line: "src/vs/base/browser/ui/toggle/toggle.ts:106",
      },
      {
        symbol: "ToggleActionViewItem.blur",
        path_line: "src/vs/base/browser/ui/toggle/toggle.ts:111",
      },
      {
        symbol: "CheckboxActionViewItem.blur",
        path_line: "src/vs/base/browser/ui/toggle/toggle.ts:516",
      },
    ]);
    for (const entry of repair.false_entry_points_removed) {
      expect(entry.path_line).toMatch(/^src\/.+\.ts:\d+$/);
      expect(entry.symbol).toMatch(/^\w+\.\w+$/);
    }
  });

  it("states a ratio its own repetitions reproduce, in one session, across two trees", () => {
    for (const size of RECORD.reverse_index_ratio) {
      expect(size.indexed + size.dropped).toEqual(size.file_count);
      expect(size.control.ariadne_commit).not.toEqual(
        size.candidate.ariadne_commit,
      );
      expect(size.control.cpu_seconds.length).toBeGreaterThanOrEqual(2);
      expect(size.candidate.cpu_seconds.length).toEqual(
        size.control.cpu_seconds.length,
      );
      for (const arm of [size.control, size.candidate]) {
        expect(arm.cpu_user_ms.length).toEqual(arm.cpu_seconds.length);
        expect(arm.cpu_per_wall.length).toEqual(arm.cpu_seconds.length);
        expect(arm.loadavg_at_start.length).toEqual(arm.cpu_seconds.length);
        expect(arm.peak_rss_mb.length).toEqual(arm.cpu_seconds.length);
      }
      const ratio = mean(size.control.cpu_seconds) / mean(size.candidate.cpu_seconds);
      expect(Math.round(ratio * 100) / 100).toEqual(size.speedup);
    }
  });

  it("carries the seven components and both diagnostics digests the arms agreed on", () => {
    for (const size of RECORD.reverse_index_ratio) {
      const components = Object.entries(size.fingerprint);
      expect(components).toHaveLength(7);
      for (const [, value] of components) {
        expect(value).toMatch(/^\d+\/[0-9a-f]{16}$/);
      }
      expect(size.fingerprint.dropped_files.split("/")[0]).toEqual(
        String(size.dropped),
      );
      for (const hash of size.diagnostics_hashes) {
        expect(hash).toMatch(/^[0-9a-f]{16}$/);
      }
    }
  });

  it("accounts for every lost edge in all four orders", () => {
    expect(RECORD.edge_losses.map((loss) => loss.ingest_order)).toEqual([
      "forward",
      "reversed",
      "descending_size",
      "shuffled",
    ]);
    for (const loss of RECORD.edge_losses) {
      expect(loss.order_dependent_on_unpatched + loss.stable_on_unpatched).toEqual(
        loss.lost,
      );
      expect(
        loss.retargeted + loss.now_unresolved + loss.no_unresolved_record,
      ).toEqual(loss.stable_on_unpatched);
      expect(loss.candidate_edges - loss.control_edges).toEqual(
        loss.gained - loss.lost,
      );
      const callee_total = Object.values(loss.stable_loss_callees).reduce(
        (total, count) => total + count,
        0,
      );
      expect(callee_total).toEqual(loss.stable_on_unpatched - loss.retargeted);
    }
  });

  it("records the refutation rather than the claim it replaced", () => {
    // Both halves of the original rule are false of the landed code, and a
    // record that stated only the surviving half would read as a pass.
    expect(RECORD.edge_loss_verdict).toContain("refuted");
    expect(RECORD.edge_loss_verdict).toContain("TASK-381.11");
    const reversed = RECORD.edge_losses.find(
      (loss) => loss.ingest_order === "reversed",
    )!;
    expect(reversed.control_edges).not.toEqual(reversed.candidate_edges);
    expect(
      RECORD.edge_losses.some((loss) => loss.stable_on_unpatched > 0),
    ).toEqual(true);
  });
});
