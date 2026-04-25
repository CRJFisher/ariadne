import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import {
  init_analytics,
  is_analytics_enabled,
  record_session_client_info,
  record_tool_call,
  close_analytics,
} from "./analytics";

// Suppress logger output during tests
vi.mock("@ariadnejs/core", async (import_original) => {
  const actual = await import_original<typeof import("@ariadnejs/core")>();
  return {
    ...actual,
    log_info: vi.fn(),
    log_warn: vi.fn(),
  };
});

function read_jsonl<T>(file_path: string): T[] {
  const content = fs.readFileSync(file_path, "utf-8");
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

describe("analytics", () => {
  let analytics_dir: string;
  let sid: string;
  let tmp_dir: string;

  beforeEach(() => {
    tmp_dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ariadne-analytics-test-"),
    );
    analytics_dir = path.join(tmp_dir, "analytics");
  });

  afterEach(() => {
    close_analytics();
    fs.rmSync(tmp_dir, { recursive: true, force: true });
  });

  describe("init_analytics", () => {
    it("creates analytics directory and returns session id", () => {
      sid = init_analytics("/test/project", analytics_dir);

      expect(sid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(fs.existsSync(analytics_dir)).toEqual(true);
    });

    it("writes session to sessions.jsonl on close", () => {
      sid = init_analytics("/test/project", analytics_dir);
      close_analytics();

      const sessions = read_jsonl<{
        session_id: string;
        started_at: string;
        project_path: string;
        client_name: string | null;
        client_version: string | null;
      }>(path.join(analytics_dir, "sessions.jsonl"));

      expect(sessions.length).toEqual(1);
      expect(sessions[0].session_id).toEqual(sid);
      expect(sessions[0].project_path).toEqual("/test/project");
      expect(sessions[0].client_name).toBeNull();
      expect(sessions[0].client_version).toBeNull();
      expect(sessions[0].started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("record_session_client_info", () => {
    beforeEach(() => {
      sid = init_analytics("/test/project", analytics_dir);
    });

    it("includes client info in session record on close", () => {
      record_session_client_info("claude-code", "1.0.22");
      close_analytics();

      const sessions = read_jsonl<{
        client_name: string;
        client_version: string;
      }>(path.join(analytics_dir, "sessions.jsonl"));

      expect(sessions[0].client_name).toEqual("claude-code");
      expect(sessions[0].client_version).toEqual("1.0.22");
    });
  });

  describe("record_tool_call", () => {
    beforeEach(() => {
      sid = init_analytics("/test/project", analytics_dir);
    });

    it("writes correct data including request_id and tool_use_id", () => {
      record_tool_call({
        tool_name: "list_entrypoints",
        arguments: { files: ["src/main.ts"] },
        duration_ms: 450,
        success: true,
        request_id: "req-123",
        tool_use_id: "toolu_01abc123",
      });

      const rows = read_jsonl<{
        session_id: string;
        tool_name: string;
        called_at: string;
        duration_ms: number;
        success: boolean;
        error_message: string | null;
        arguments: Record<string, unknown>;
        request_id: string;
        tool_use_id: string;
      }>(path.join(analytics_dir, "tool_calls.jsonl"));

      expect(rows.length).toEqual(1);
      expect(rows[0].session_id).toEqual(sid);
      expect(rows[0].tool_name).toEqual("list_entrypoints");
      expect(rows[0].duration_ms).toEqual(450);
      expect(rows[0].success).toEqual(true);
      expect(rows[0].error_message).toBeNull();
      expect(rows[0].arguments).toEqual({ files: ["src/main.ts"] });
      expect(rows[0].request_id).toEqual("req-123");
      expect(rows[0].tool_use_id).toEqual("toolu_01abc123");
      expect(rows[0].called_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("stores null when tool_use_id is omitted", () => {
      record_tool_call({
        tool_name: "list_entrypoints",
        arguments: {},
        duration_ms: 50,
        success: true,
        request_id: "req-789",
      });

      const rows = read_jsonl<{ tool_use_id: string | null }>(
        path.join(analytics_dir, "tool_calls.jsonl"),
      );

      expect(rows[0].tool_use_id).toBeNull();
    });

    it("records error details on failure", () => {
      record_tool_call({
        tool_name: "show_call_graph_neighborhood",
        arguments: { symbol_ref: "bad:ref" },
        duration_ms: 10,
        success: false,
        error_message: "Symbol not found",
        request_id: "req-456",
      });

      const rows = read_jsonl<{
        success: boolean;
        error_message: string;
      }>(path.join(analytics_dir, "tool_calls.jsonl"));

      expect(rows[0].success).toEqual(false);
      expect(rows[0].error_message).toEqual("Symbol not found");
    });

    it("no-ops when not initialized", () => {
      close_analytics();

      // Should not throw
      record_tool_call({
        tool_name: "list_entrypoints",
        arguments: {},
        duration_ms: 100,
        success: true,
      });
    });

    it("never throws even on write failure", () => {
      close_analytics();

      expect(() =>
        record_tool_call({
          tool_name: "list_entrypoints",
          arguments: {},
          duration_ms: 100,
          success: true,
        }),
      ).not.toThrow();
    });
  });

  describe("close_analytics", () => {
    it("makes record_tool_call no-op after close", () => {
      sid = init_analytics("/test/project", analytics_dir);
      close_analytics();

      // Should silently no-op
      record_tool_call({
        tool_name: "list_entrypoints",
        arguments: {},
        duration_ms: 100,
        success: true,
      });

      const tool_calls_path = path.join(analytics_dir, "tool_calls.jsonl");
      expect(fs.existsSync(tool_calls_path)).toEqual(false);
    });

    it("is safe to call when not initialized", () => {
      expect(() => close_analytics()).not.toThrow();
    });
  });

  describe("is_analytics_enabled", () => {
    const original_env = process.env;

    beforeEach(() => {
      process.env = { ...original_env };
      delete process.env.ARIADNE_ANALYTICS;
    });

    afterEach(() => {
      process.env = original_env;
    });

    it("returns true when ARIADNE_ANALYTICS=1 env var is set", () => {
      process.env.ARIADNE_ANALYTICS = "1";
      expect(is_analytics_enabled()).toEqual(true);
    });

    it("returns true when config file has analytics: true", () => {
      const config_dir = path.join(tmp_dir, ".ariadne");
      fs.mkdirSync(config_dir, { recursive: true });
      fs.writeFileSync(
        path.join(config_dir, "config.json"),
        JSON.stringify({ analytics: true }),
      );
      process.env.HOME = tmp_dir;

      expect(is_analytics_enabled()).toEqual(true);
    });

    it("returns false when neither env var nor config is set", () => {
      process.env.HOME = tmp_dir;
      expect(is_analytics_enabled()).toEqual(false);
    });

    it("returns false when config file does not exist", () => {
      process.env.HOME = tmp_dir;
      expect(is_analytics_enabled()).toEqual(false);
    });

    it("returns false when config file is malformed JSON", () => {
      const config_dir = path.join(tmp_dir, ".ariadne");
      fs.mkdirSync(config_dir, { recursive: true });
      fs.writeFileSync(
        path.join(config_dir, "config.json"),
        "not valid json{{",
      );
      process.env.HOME = tmp_dir;

      expect(is_analytics_enabled()).toEqual(false);
    });
  });
});
