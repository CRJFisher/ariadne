import { describe, it, expect } from "vitest";

import {
  RUN_ID_REGEX,
  build_run_id,
  compare_run_ids,
  is_run_id,
  parse_run_id,
} from "./run_id.js";

describe("build_run_id", () => {
  it("builds a well-formed id from a short commit and round-trips through validation", () => {
    const id = build_run_id("deadbee");
    expect(is_run_id(id)).toBe(true);
    expect(parse_run_id(id)).toBe(id);
    expect(id.startsWith("deadbee-")).toBe(true);
  });

  it("uses the nogit prefix for a non-git project", () => {
    const id = build_run_id(null);
    expect(id.startsWith("nogit-")).toBe(true);
    expect(is_run_id(id)).toBe(true);
  });
});

describe("RUN_ID_REGEX / is_run_id", () => {
  it("accepts the canonical example shape", () => {
    expect(RUN_ID_REGEX.test("deadbee-2026-04-28T13-42-07.812Z")).toBe(true);
    expect(is_run_id("nogit-2026-04-28T13-42-07.812Z")).toBe(true);
  });

  it("rejects malformed ids", () => {
    // un-replaced colons in the time component
    expect(is_run_id("deadbee-2026-04-28T13:42:07.812Z")).toBe(false);
    // wrong-length / uppercase hash
    expect(is_run_id("deadbe-2026-04-28T13-42-07.812Z")).toBe(false);
    expect(is_run_id("deadbeef-2026-04-28T13-42-07.812Z")).toBe(false);
    expect(is_run_id("DEADBEE-2026-04-28T13-42-07.812Z")).toBe(false);
    // legacy bare timestamp, no commit prefix
    expect(is_run_id("2026-04-16T18-10-16.855Z")).toBe(false);
    // missing milliseconds
    expect(is_run_id("deadbee-2026-04-28T13-42-07Z")).toBe(false);
    // trailing junk
    expect(is_run_id("deadbee-2026-04-28T13-42-07.812Z.json")).toBe(false);
  });
});

describe("parse_run_id", () => {
  it("throws on malformed input", () => {
    expect(() => parse_run_id("r1")).toThrow(/Invalid run-id/);
    expect(() => parse_run_id("2026-04-16T18-10-16.855Z")).toThrow(/Invalid run-id/);
  });
});

describe("compare_run_ids", () => {
  it("orders by timestamp when commit prefixes disagree with time", () => {
    const older = parse_run_id("fff0000-2026-03-26T21-04-31.070Z");
    const newer = parse_run_id("0001111-2026-05-02T09-15-00.000Z");
    expect(compare_run_ids(older, newer)).toBeLessThan(0);
    expect(compare_run_ids(newer, older)).toBeGreaterThan(0);
  });

  it("orders a nogit run against a hash-prefixed run by time alone", () => {
    const nogit = parse_run_id("nogit-2026-03-26T21-04-31.070Z");
    const hashed = parse_run_id("0001111-2026-05-02T09-15-00.000Z");
    expect(compare_run_ids(nogit, hashed)).toBeLessThan(0);
  });

  it("breaks a same-millisecond tie on the full id, and is zero for equal ids", () => {
    const a = parse_run_id("aaa1111-2026-05-02T09-15-00.000Z");
    const b = parse_run_id("bbb2222-2026-05-02T09-15-00.000Z");
    expect(compare_run_ids(a, b)).toBeLessThan(0);
    expect(compare_run_ids(a, a)).toBe(0);
  });

  it("sorts a run set oldest-first so the tail is the most recent", () => {
    const ids = [
      "0001111-2026-05-02T09-15-00.000Z",
      "fff0000-2026-03-26T21-04-31.070Z",
      "nogit-2026-04-16T18-10-16.855Z",
    ].map(parse_run_id);
    expect([...ids].sort(compare_run_ids)).toEqual([
      "fff0000-2026-03-26T21-04-31.070Z",
      "nogit-2026-04-16T18-10-16.855Z",
      "0001111-2026-05-02T09-15-00.000Z",
    ]);
  });
});
