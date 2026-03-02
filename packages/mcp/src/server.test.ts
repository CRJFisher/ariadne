import { describe, it, expect, afterEach } from "vitest";
import { parse_cli_args, resolve_toolsets } from "./server";

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

    it("should parse --toolsets=value format", () => {
      const result = parse_cli_args(["--toolsets=core,topology"]);
      expect(result.toolsets).toEqual(["core", "topology"]);
    });

    it("should parse --toolsets with separate value", () => {
      const result = parse_cli_args(["--toolsets", "core"]);
      expect(result.toolsets).toEqual(["core"]);
    });

    it("should parse single toolset", () => {
      const result = parse_cli_args(["--toolsets=core"]);
      expect(result.toolsets).toEqual(["core"]);
    });

    it("should combine --toolsets with other flags", () => {
      const result = parse_cli_args(["-p", "/path", "--toolsets=core", "--no-watch"]);
      expect(result).toEqual({
        project_path: "/path",
        toolsets: ["core"],
        watch: false,
      });
    });

    it("should return undefined toolsets when not specified", () => {
      const result = parse_cli_args([]);
      expect(result.toolsets).toBeUndefined();
    });
  });

  describe("resolve_toolsets", () => {
    const original_env = process.env.ARIADNE_TOOLSETS;

    afterEach(() => {
      if (original_env === undefined) {
        delete process.env.ARIADNE_TOOLSETS;
      } else {
        process.env.ARIADNE_TOOLSETS = original_env;
      }
    });

    it("should return CLI toolsets when provided", () => {
      process.env.ARIADNE_TOOLSETS = "env_group";
      expect(resolve_toolsets(["cli_group"])).toEqual(["cli_group"]);
    });

    it("should fall back to ARIADNE_TOOLSETS env var when CLI is empty", () => {
      process.env.ARIADNE_TOOLSETS = "core,topology";
      expect(resolve_toolsets([])).toEqual(["core", "topology"]);
    });

    it("should fall back to ARIADNE_TOOLSETS env var when CLI is undefined", () => {
      process.env.ARIADNE_TOOLSETS = "core";
      expect(resolve_toolsets(undefined)).toEqual(["core"]);
    });

    it("should return empty array when neither CLI nor env var is set", () => {
      delete process.env.ARIADNE_TOOLSETS;
      expect(resolve_toolsets(undefined)).toEqual([]);
    });

    it("should filter empty strings from env var", () => {
      process.env.ARIADNE_TOOLSETS = "core,,topology,";
      expect(resolve_toolsets(undefined)).toEqual(["core", "topology"]);
    });
  });
});
