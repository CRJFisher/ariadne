/**
 * The taxonomy is a summary of every CallReference a load produced, and it is
 * only worth recording while it closes: a call with neither a target nor a
 * reason is refused rather than summed over, because summing over it would be
 * a taxonomy stated over fewer calls than it claims.
 */

import { describe, expect, it } from "vitest";
import type {
  CallReference,
  FilePath,
  ResolutionFailureReason,
  ScopeId,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";
import {
  RESOLUTION_FAILURE_REASONS,
  count_failure_taxonomy,
  format_failure_taxonomy_table,
  unresolved_total,
  type FailureTaxonomy,
} from "./failure_taxonomy";

const FILE_A = "/corpus/a.ts" as FilePath;
const FILE_B = "/corpus/b.ts" as FilePath;

function call(
  file: FilePath,
  line: number,
  outcome: "resolved" | ResolutionFailureReason | "silent",
): CallReference {
  const base = {
    location: {
      file_path: file,
      start_line: line,
      start_column: 0,
      end_line: line,
      end_column: 4,
    },
    name: "f" as SymbolName,
    scope_id: `scope:${file}:file:0:0` as ScopeId,
    call_type: "function" as const,
  };
  if (outcome === "resolved") {
    return {
      ...base,
      resolutions: [
        {
          symbol_id: `function:${file}:1:0:2:1:f` as SymbolId,
          confidence: "certain",
          reason: { type: "direct" },
        },
      ],
    };
  }
  if (outcome === "silent") {
    return { ...base, resolutions: [] };
  }
  return {
    ...base,
    resolutions: [],
    resolution_failure: {
      stage: "name_resolution",
      reason: outcome,
      partial_info: {},
    },
  };
}

function source(calls: ReadonlyMap<FilePath, readonly CallReference[]>) {
  return {
    get_calls_for_file: (file: FilePath) => calls.get(file) ?? [],
  };
}

function zeroed(
  overrides: Partial<Record<ResolutionFailureReason, number>>,
): Record<ResolutionFailureReason, number> {
  const counts = {} as Record<ResolutionFailureReason, number>;
  for (const reason of RESOLUTION_FAILURE_REASONS) counts[reason] = 0;
  return { ...counts, ...overrides };
}

describe("count_failure_taxonomy", () => {
  it("counts every call of every indexed file as resolved or under its reason", () => {
    const calls = new Map<FilePath, readonly CallReference[]>([
      [
        FILE_A,
        [
          call(FILE_A, 1, "resolved"),
          call(FILE_A, 2, "name_not_in_scope"),
          call(FILE_A, 3, "receiver_type_unknown"),
        ],
      ],
      [FILE_B, [call(FILE_B, 1, "name_not_in_scope"), call(FILE_B, 2, "resolved")]],
    ]);

    expect(count_failure_taxonomy(source(calls), [FILE_A, FILE_B])).toEqual({
      call_references: 5,
      resolved: 2,
      by_reason: zeroed({ name_not_in_scope: 2, receiver_type_unknown: 1 }),
    });
  });

  it("reads only the files it is asked over, so a file the load dropped counts nothing", () => {
    const calls = new Map<FilePath, readonly CallReference[]>([
      [FILE_A, [call(FILE_A, 1, "resolved")]],
      [FILE_B, [call(FILE_B, 1, "name_not_in_scope")]],
    ]);

    expect(count_failure_taxonomy(source(calls), [FILE_A])).toEqual({
      call_references: 1,
      resolved: 1,
      by_reason: zeroed({}),
    });
  });

  it("carries every reason of the vocabulary at zero when nothing failed", () => {
    const taxonomy = count_failure_taxonomy(source(new Map()), []);
    expect(Object.keys(taxonomy.by_reason).sort()).toEqual(
      [...RESOLUTION_FAILURE_REASONS].sort(),
    );
    expect(taxonomy).toEqual({
      call_references: 0,
      resolved: 0,
      by_reason: zeroed({}),
    });
  });

  it("refuses a call that carries neither a target nor a reason", () => {
    const calls = new Map<FilePath, readonly CallReference[]>([
      [FILE_A, [call(FILE_A, 1, "resolved"), call(FILE_A, 7, "silent")]],
    ]);

    expect(() => count_failure_taxonomy(source(calls), [FILE_A])).toThrow(
      "The call to \"f\" at /corpus/a.ts:7:0:7:4 carries neither a target nor a resolution failure",
    );
  });
});

describe("unresolved_total", () => {
  it("sums the per-reason counts, which is what closes the taxonomy over its references", () => {
    const taxonomy: FailureTaxonomy = {
      call_references: 10,
      resolved: 6,
      by_reason: zeroed({ name_not_in_scope: 3, dynamic_dispatch: 1 }),
    };
    expect(unresolved_total(taxonomy)).toEqual(4);
    expect(taxonomy.resolved + unresolved_total(taxonomy)).toEqual(
      taxonomy.call_references,
    );
  });
});

describe("format_failure_taxonomy_table", () => {
  const control: FailureTaxonomy = {
    call_references: 100,
    resolved: 60,
    by_reason: zeroed({ name_not_in_scope: 30, receiver_type_unknown: 10 }),
  };
  const candidate: FailureTaxonomy = {
    call_references: 100,
    resolved: 65,
    by_reason: zeroed({ name_not_in_scope: 30, receiver_type_unknown: 5 }),
  };

  it("prints the arms side by side with the delta last, reasons in the first arm's order", () => {
    const lines = format_failure_taxonomy_table([
      { label: "control", taxonomy: control },
      { label: "candidate", taxonomy: candidate },
    ]);
    const cells = lines.map((line) => line.trim().split(/\s+/));
    expect(cells[0]).toEqual(["control", "candidate", "delta"]);
    expect(cells[1]).toEqual(["call_references", "100", "100", "0"]);
    expect(cells[2]).toEqual(["resolved", "60", "65", "5"]);
    expect(cells[3]).toEqual(["unresolved", "40", "35", "-5"]);
    expect(cells[4]).toEqual(["name_not_in_scope", "30", "30", "0"]);
    expect(cells[5]).toEqual(["receiver_type_unknown", "10", "5", "-5"]);
    expect(lines).toHaveLength(4 + RESOLUTION_FAILURE_REASONS.length);
  });

  it("starts every row's first column at one index, the longest reason included", () => {
    const lines = format_failure_taxonomy_table([
      { label: "control", taxonomy: control },
      { label: "candidate", taxonomy: candidate },
    ]);
    // Asserted on the raw lines, because every other test here trims them: a
    // reader reads a reason against the `unresolved` it breaks down by running
    // an eye down one column, and the two 30-character reasons are the ones a
    // width taken from the bare names pushes out of it. Every cell is fixed
    // width, so one line length is one set of columns.
    expect([...new Set(lines.map((line) => line.length))]).toEqual([68]);
    expect(
      lines.find((line) => line.includes("polymorphic_no_implementations")),
    ).toEqual(
      "  polymorphic_no_implementations           0           0           0",
    );
  });

  it("prints one arm with no delta column", () => {
    const lines = format_failure_taxonomy_table([
      { label: "baseline", taxonomy: control },
    ]);
    const cells = lines.map((line) => line.trim().split(/\s+/));
    expect(cells[0]).toEqual(["baseline"]);
    expect(cells[1]).toEqual(["call_references", "100"]);
    expect(cells[3]).toEqual(["unresolved", "40"]);
  });
});
