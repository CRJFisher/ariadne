import { describe, it, expect } from "vitest";
import { parse_args, pad_right, resolve_db_path, CliArgs } from "./ariadne_analytics";

describe("ariadne_analytics", () => {
  describe("parse_args", () => {
    it("parses --since flag", () => {
      const result = parse_args(["--since", "2026-02-17"]);
      const expected: CliArgs = { since: "2026-02-17" };
      expect(result).toEqual(expected);
    });

    it("parses --session flag", () => {
      const result = parse_args(["--session", "abc-123"]);
      const expected: CliArgs = { session: "abc-123" };
      expect(result).toEqual(expected);
    });

    it("parses both flags together", () => {
      const result = parse_args(["--since", "2026-02-17", "--session", "abc-123"]);
      const expected: CliArgs = { since: "2026-02-17", session: "abc-123" };
      expect(result).toEqual(expected);
    });

    it("returns empty object for no args", () => {
      const result = parse_args([]);
      const expected: CliArgs = {};
      expect(result).toEqual(expected);
    });

    it("ignores unknown flags", () => {
      const result = parse_args(["--verbose", "--since", "2026-02-17"]);
      const expected: CliArgs = { since: "2026-02-17" };
      expect(result).toEqual(expected);
    });

    it("ignores flag without value", () => {
      const result = parse_args(["--since"]);
      const expected: CliArgs = {};
      expect(result).toEqual(expected);
    });
  });

  describe("pad_right", () => {
    it("pads shorter strings", () => {
      expect(pad_right("abc", 6)).toEqual("abc   ");
    });

    it("returns string unchanged when at target length", () => {
      expect(pad_right("abc", 3)).toEqual("abc");
    });

    it("returns string unchanged when longer than target", () => {
      expect(pad_right("abcdef", 3)).toEqual("abcdef");
    });
  });

  describe("resolve_db_path", () => {
    it("uses ARIADNE_ANALYTICS_DB env var when set", () => {
      const original = process.env.ARIADNE_ANALYTICS_DB;
      process.env.ARIADNE_ANALYTICS_DB = "/custom/path.db";
      expect(resolve_db_path()).toEqual("/custom/path.db");
      if (original === undefined) {
        delete process.env.ARIADNE_ANALYTICS_DB;
      } else {
        process.env.ARIADNE_ANALYTICS_DB = original;
      }
    });

    it("defaults to ~/.ariadne/analytics.db", () => {
      const original = process.env.ARIADNE_ANALYTICS_DB;
      delete process.env.ARIADNE_ANALYTICS_DB;
      const result = resolve_db_path();
      expect(result).toMatch(/\.ariadne\/analytics\.db$/);
      if (original !== undefined) {
        process.env.ARIADNE_ANALYTICS_DB = original;
      }
    });
  });
});
