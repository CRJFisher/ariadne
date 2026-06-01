import { describe, it, expect } from "vitest";

import { RUN_ID_REGEX, build_run_id, is_run_id, parse_run_id } from "./run_id.js";

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
