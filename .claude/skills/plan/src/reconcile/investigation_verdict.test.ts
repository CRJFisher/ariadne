import { describe, expect, it } from "vitest";

import {
  parse_investigation_verdict,
  reconcile_verdicts,
  type InvestigationVerdict,
  type RowFlag,
} from "./investigation_verdict.js";
import type { PermanentLimitationReroute } from "./permanent_reroute.js";

describe("parse_investigation_verdict", () => {
  it("parses a well-formed permanent-limitation verdict", () => {
    const raw = {
      outcome: "permanent_limitation",
      boundary: "call reaches through a runtime string-keyed dispatch map",
      row_ids: ["pt-a", "pt-b"],
    };
    expect(parse_investigation_verdict(raw, "verdict.json")).toEqual(raw);
  });

  it("rejects an unknown outcome", () => {
    expect(() =>
      parse_investigation_verdict({ outcome: "maybe", boundary: "x", row_ids: ["pt-a"] }, "verdict.json"),
    ).toThrow(/outcome must be "permanent_limitation" or "fixable"/);
  });

  it("rejects an empty boundary", () => {
    expect(() =>
      parse_investigation_verdict({ outcome: "fixable", boundary: "", row_ids: ["pt-a"] }, "v"),
    ).toThrow(/boundary must be a non-empty string/);
  });

  it("rejects empty row_ids", () => {
    expect(() =>
      parse_investigation_verdict({ outcome: "fixable", boundary: "b", row_ids: [] }, "v"),
    ).toThrow(/row_ids must be a non-empty array of strings/);
  });
});

describe("reconcile_verdicts", () => {
  const flags = new Map<string, RowFlag>([
    ["pt-a", { fault_area: "name_resolution", is_permanent_limitation: false }],
    ["pt-b", { fault_area: "method_lookup", is_permanent_limitation: true }],
  ]);

  it("records a fixable→permanent flip", () => {
    const verdicts: InvestigationVerdict[] = [
      { outcome: "permanent_limitation", boundary: "dynamic dispatch", row_ids: ["pt-a"] },
    ];
    const expected: PermanentLimitationReroute[] = [
      {
        row_id: "pt-a",
        fault_area: "name_resolution",
        was_permanent_limitation: false,
        now_permanent_limitation: true,
        boundary: "dynamic dispatch",
      },
    ];
    expect(reconcile_verdicts(verdicts, flags)).toEqual({
      reroutes: expected,
      unknown_row_ids: [],
      conflicting_row_ids: [],
    });
  });

  it("re-records an already-permanent row a verdict re-confirms (idempotent re-run of the wedge set)", () => {
    // On a re-run the flag is already flipped, yet the wedge record must persist —
    // reroutes are a function of the verdict, not of the current flag.
    const verdicts: InvestigationVerdict[] = [
      { outcome: "permanent_limitation", boundary: "framework invocation", row_ids: ["pt-b"] },
    ];
    const expected: PermanentLimitationReroute[] = [
      {
        row_id: "pt-b",
        fault_area: "method_lookup",
        was_permanent_limitation: true,
        now_permanent_limitation: true,
        boundary: "framework invocation",
      },
    ];
    expect(reconcile_verdicts(verdicts, flags)).toEqual({
      reroutes: expected,
      unknown_row_ids: [],
      conflicting_row_ids: [],
    });
  });

  it("records a permanent→fixable flip", () => {
    const verdicts: InvestigationVerdict[] = [
      { outcome: "fixable", boundary: "resolver can carry the receiver type", row_ids: ["pt-b"] },
    ];
    const expected: PermanentLimitationReroute[] = [
      {
        row_id: "pt-b",
        fault_area: "method_lookup",
        was_permanent_limitation: true,
        now_permanent_limitation: false,
        boundary: "resolver can carry the receiver type",
      },
    ];
    expect(reconcile_verdicts(verdicts, flags)).toEqual({
      reroutes: expected,
      unknown_row_ids: [],
      conflicting_row_ids: [],
    });
  });

  it("leaves a fixable-agreeing row alone (no reroute)", () => {
    const verdicts: InvestigationVerdict[] = [
      { outcome: "fixable", boundary: "resolver upgrade", row_ids: ["pt-a"] },
    ];
    expect(reconcile_verdicts(verdicts, flags)).toEqual({
      reroutes: [],
      unknown_row_ids: [],
      conflicting_row_ids: [],
    });
  });

  it("collects an unknown row id without a reroute", () => {
    const verdicts: InvestigationVerdict[] = [
      { outcome: "fixable", boundary: "b", row_ids: ["pt-a", "pt-ghost"] },
    ];
    expect(reconcile_verdicts(verdicts, flags)).toEqual({
      reroutes: [],
      unknown_row_ids: ["pt-ghost"],
      conflicting_row_ids: [],
    });
  });

  it("flags a row two verdicts place in conflicting outcomes (no silent last-write-wins)", () => {
    const verdicts: InvestigationVerdict[] = [
      { outcome: "permanent_limitation", boundary: "dynamic dispatch", row_ids: ["pt-a"] },
      { outcome: "fixable", boundary: "resolver upgrade", row_ids: ["pt-a"] },
    ];
    const result = reconcile_verdicts(verdicts, flags);
    expect(result.conflicting_row_ids).toEqual(["pt-a"]);
    // The first (permanent) verdict is the one recorded; the conflict is surfaced, not silently merged.
    expect(result.reroutes.map((r) => r.now_permanent_limitation)).toEqual([true]);
  });
});
