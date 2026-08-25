/**
 * How an arm's result survives the process that produced it.
 *
 * The file's guarantees are that it never holds its members as one string, and
 * that reading it re-derives every digest — so a truncated file is refused
 * rather than compared.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { read_arm_result, write_arm_result } from "./arm_result_file";
import type { ArmResult } from "./benchmark_corpus_load";
import {
  FINGERPRINT_COMPONENT_NAMES,
  FINGERPRINT_SCHEMA_VERSION,
  type CallGraphFingerprint,
  type FingerprintComponentName,
} from "./call_graph_fingerprint";
import { digest_members } from "./streaming_digest";
import type { MeasurementRow } from "./measurement_row";

const TEMP_DIRS: string[] = [];

function temp_file(name: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "arm-result-")));
  TEMP_DIRS.push(dir);
  return path.join(dir, name);
}

afterAll(() => {
  for (const dir of TEMP_DIRS) fs.rmSync(dir, { recursive: true, force: true });
});

function component(members: readonly string[]) {
  const sorted = [...members].sort();
  return { count: sorted.length, hash: digest_members(sorted), members: sorted };
}

/** Enough members to cross several stream writes. */
const MANY = Array.from({ length: 2500 }, (_, index) => `member-${index}`);

function build_result(): ArmResult {
  const fingerprint = {
    nodes: component(["nodes-a", "nodes-b"]),
    call_edges: component(MANY),
    unresolved_calls: component(["unresolved_calls-a", "unresolved_calls-b"]),
    raw_entry_points: component(["raw_entry_points-a", "raw_entry_points-b"]),
    indirect_reachability_keys: component([
      "indirect_reachability_keys-a",
      "indirect_reachability_keys-b",
    ]),
    dropped_files: component(["dropped_files-a", "dropped_files-b"]),
    indirect_reachability_evidence: component([
      "indirect_reachability_evidence-a",
      "indirect_reachability_evidence-b",
    ]),
  } satisfies CallGraphFingerprint;

  const row = {
    arm: "control",
    sequence_index: 0,
    corpus: {
      corpus_name: "ariadne/benchmark_corpus",
      corpus_root: "/corpus",
      corpus_commit: "in-repo",
      predicate: "src",
    },
    file_counts: { discovered: 8, offered: 8, indexed: 7, dropped: 1 },
    ingest_order: "forward",
    seed: 1,
    include_tests: false,
    cpu_user_ms: 1,
    cpu_system_ms: 1,
    wall_ms: 1,
    cpu_per_wall: 1,
    load_cpu_ms: 1,
    trace_cpu_ms: 1,
    loadavg_at_start: [0, 0, 0],
    loadavg_at_end: [0, 0, 0],
    peak_rss_mb: 1,
    rss_at_end_mb: 1,
    settled_heap_mb: 1,
    fingerprint: {
      schema_version: FINGERPRINT_SCHEMA_VERSION,
      components: Object.fromEntries(
        FINGERPRINT_COMPONENT_NAMES.map((name) => [
          name,
          { count: fingerprint[name].count, hash: fingerprint[name].hash },
        ]),
      ) as Record<FingerprintComponentName, { count: number; hash: string }>,
    },
    environment: {
      machine: "Darwin 21.6.0 x64",
      hostname: "measure-01",
      cpu_count: 4,
      total_memory_mb: 16384,
      node_version: "v22.23.2",
      pid: 1,
      heap_cap_mb: 6144,
      tree_sitter_version: "0.25.0",
      tree_sitter_typescript_version: "0.23.2",
      ariadne_commit: "12458246",
      session_id: "session-a",
    },
  } as MeasurementRow;

  return { row, fingerprint };
}

describe("write_arm_result / read_arm_result", () => {
  it("round-trips a result across the process boundary", async () => {
    const file = temp_file("control.arm");
    const written = build_result();
    await write_arm_result(file, written);
    const read = await read_arm_result(file);

    expect(read.row).toEqual(written.row);
    for (const name of FINGERPRINT_COMPONENT_NAMES) {
      expect([...read.fingerprint[name].members]).toEqual([
        ...written.fingerprint[name].members,
      ]);
    }
  });

  it("writes the row last, so its presence proves the file is complete", async () => {
    const file = temp_file("control.arm");
    await write_arm_result(file, build_result());
    const lines = fs.readFileSync(file, "utf-8").trimEnd().split("\n");
    expect(lines[lines.length - 1].startsWith("row\t")).toEqual(true);
  });

  it("refuses a file whose arm died before writing the row", async () => {
    const file = temp_file("truncated.arm");
    await write_arm_result(file, build_result());
    const lines = fs.readFileSync(file, "utf-8").split("\n");
    fs.writeFileSync(file, lines.slice(0, 10).join("\n"));

    await expect(read_arm_result(file)).rejects.toThrow(
      /holds no measurement row/,
    );
  });

  it("refuses a file that does not reproduce its own digest", async () => {
    // A hash-function change cannot quietly revalue an already-recorded
    // baseline: reading re-derives every digest from the members on disk.
    const file = temp_file("tampered.arm");
    await write_arm_result(file, build_result());
    const contents = fs.readFileSync(file, "utf-8");
    fs.writeFileSync(file, contents.replace("nodes\t\"nodes-a\"", "nodes\t\"nodes-z\""));

    await expect(read_arm_result(file)).rejects.toThrow(
      /does not reproduce its own "nodes" component/,
    );
  });

  it("refuses a line with no component separator", async () => {
    const file = temp_file("garbled.arm");
    fs.writeFileSync(file, "this line has no tab\n");
    await expect(read_arm_result(file)).rejects.toThrow(
      /no component separator/,
    );
  });

  it("refuses a line naming a component the fingerprint does not have", async () => {
    // A component name is read straight off the line. An unknown one means the
    // file came from a different fingerprint schema, and silently dropping it
    // would read the file back as a complete result with a component missing.
    const file = temp_file("unknown-component.arm");
    await write_arm_result(file, build_result());
    const contents = fs.readFileSync(file, "utf-8");
    fs.writeFileSync(file, `renamed_component\t"a"\n${contents}`);

    await expect(read_arm_result(file)).rejects.toThrow(
      /names an unknown fingerprint component "renamed_component"/,
    );
  });

  it("survives a member holding the tab it is delimited with", async () => {
    // Members are JSON-encoded on their line, so a symbol whose name carried a
    // tab neither corrupts the line format nor silently merges two members.
    const file = temp_file("tabbed.arm");
    const result = build_result();
    const tabbed = component(["has\ttab", "plain"]);
    const written: ArmResult = {
      row: {
        ...result.row,
        fingerprint: {
          ...result.row.fingerprint,
          components: {
            ...result.row.fingerprint.components,
            dropped_files: { count: tabbed.count, hash: tabbed.hash },
          },
        },
      },
      fingerprint: { ...result.fingerprint, dropped_files: tabbed },
    };
    await write_arm_result(file, written);
    const read = await read_arm_result(file);
    expect([...read.fingerprint.dropped_files.members]).toEqual([
      "has\ttab",
      "plain",
    ]);
  });
});
