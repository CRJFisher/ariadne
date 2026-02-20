import { describe, it, expect } from "vitest";
import { parse_cli_args } from "./server";

/**
 * Tests for server.ts CLI argument parsing logic
 *
 * Note: server.ts is a thin CLI wrapper that parses arguments and calls start_server.
 * The actual server logic is tested in start_server.test.ts.
 */

describe("server CLI argument parsing", () => {
  describe("parse_cli_args", () => {
    it("should parse --project-path flag with separate value", () => {
      const result = parse_cli_args(["--project-path", "/test/path"]);
      expect(result).toEqual({ project_path: "/test/path" });
    });

    it("should parse -p shorthand flag", () => {
      const result = parse_cli_args(["-p", "/short/path"]);
      expect(result).toEqual({ project_path: "/short/path" });
    });

    it("should parse --project-path=value format", () => {
      const result = parse_cli_args(["--project-path=/equals/path"]);
      expect(result).toEqual({ project_path: "/equals/path" });
    });

    it("should return empty object when no arguments provided", () => {
      const result = parse_cli_args([]);
      expect(result).toEqual({});
    });

    it("should return empty object for unrelated arguments", () => {
      const result = parse_cli_args(["--verbose", "--debug"]);
      expect(result).toEqual({});
    });

    it("should handle --project-path as last argument without value", () => {
      const result = parse_cli_args(["--project-path"]);
      expect(result).toEqual({ project_path: undefined });
    });

    it("should use last matching flag when multiple provided", () => {
      // When multiple flags are provided, the last one wins
      const result = parse_cli_args([
        "--project-path",
        "/first",
        "-p",
        "/second",
      ]);
      expect(result).toEqual({ project_path: "/second" });
    });

    it("should handle path with spaces in equals format", () => {
      const result = parse_cli_args(["--project-path=/path/with spaces/here"]);
      expect(result).toEqual({ project_path: "/path/with spaces/here" });
    });

    it("should parse --watch flag", () => {
      const result = parse_cli_args(["--watch"]);
      expect(result).toEqual({ watch: true });
    });

    it("should parse --no-watch flag", () => {
      const result = parse_cli_args(["--no-watch"]);
      expect(result).toEqual({ watch: false });
    });

    it("should combine --project-path and --watch flags", () => {
      const result = parse_cli_args(["--project-path", "/test/path", "--watch"]);
      expect(result).toEqual({ project_path: "/test/path", watch: true });
    });

    it("should combine --project-path and --no-watch flags", () => {
      const result = parse_cli_args(["-p", "/test/path", "--no-watch"]);
      expect(result).toEqual({ project_path: "/test/path", watch: false });
    });

    it("should return undefined watch when no watch flag provided", () => {
      const result = parse_cli_args(["--project-path", "/test/path"]);
      expect(result.watch).toBeUndefined();
    });

    it("should handle --no-watch overriding earlier --watch", () => {
      // Last flag wins is typical CLI behavior, but our impl processes all flags
      // so --no-watch after --watch should set watch to false
      const result = parse_cli_args(["--watch", "--no-watch"]);
      expect(result.watch).toBe(false);
    });
  });
});
