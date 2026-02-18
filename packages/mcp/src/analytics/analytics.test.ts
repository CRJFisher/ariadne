import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  init_analytics,
  record_session_client_info,
  record_tool_call,
  close_analytics,
  get_db,
  get_session_id,
} from "./analytics";

// Suppress logger output during tests
vi.mock("../logger", () => ({
  log_info: vi.fn(),
  log_warn: vi.fn(),
}));

describe("analytics", () => {
  afterEach(() => {
    close_analytics();
  });

  describe("init_analytics", () => {
    it("creates tables and session row", () => {
      init_analytics("/test/project", ":memory:");

      const db = get_db();
      expect(db).not.toBeNull();
      expect(get_session_id()).not.toBeNull();

      // Verify session row exists
      const session = db!
        .prepare("SELECT * FROM sessions WHERE session_id = ?")
        .get(get_session_id()!) as {
        session_id: string;
        started_at: string;
        project_path: string;
        client_name: string | null;
        client_version: string | null;
      };

      expect(session.project_path).toEqual("/test/project");
      expect(session.client_name).toBeNull();
      expect(session.client_version).toBeNull();
      expect(session.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("creates tool_calls table with correct schema", () => {
      init_analytics("/test/project", ":memory:");

      const db = get_db()!;
      const columns = db
        .prepare("PRAGMA table_info(tool_calls)")
        .all() as { name: string }[];
      const column_names = columns.map((c) => c.name);

      expect(column_names).toEqual([
        "id",
        "session_id",
        "tool_name",
        "called_at",
        "duration_ms",
        "success",
        "error_message",
        "arguments",
        "request_id",
      ]);
    });
  });

  describe("record_session_client_info", () => {
    beforeEach(() => {
      init_analytics("/test/project", ":memory:");
    });

    it("updates client info on session", () => {
      record_session_client_info("claude-code", "1.0.22");

      const session = get_db()!
        .prepare("SELECT * FROM sessions WHERE session_id = ?")
        .get(get_session_id()!) as {
        client_name: string;
        client_version: string;
      };

      expect(session.client_name).toEqual("claude-code");
      expect(session.client_version).toEqual("1.0.22");
    });
  });

  describe("record_tool_call", () => {
    beforeEach(() => {
      init_analytics("/test/project", ":memory:");
    });

    it("writes correct data including request_id", () => {
      record_tool_call({
        tool_name: "list_entrypoints",
        arguments: { files: ["src/main.ts"] },
        duration_ms: 450,
        success: true,
        request_id: "req-123",
      });

      const row = get_db()!
        .prepare("SELECT * FROM tool_calls WHERE session_id = ?")
        .get(get_session_id()!) as {
        session_id: string;
        tool_name: string;
        called_at: string;
        duration_ms: number;
        success: number;
        error_message: string | null;
        arguments: string;
        request_id: string;
      };

      expect(row.tool_name).toEqual("list_entrypoints");
      expect(row.duration_ms).toEqual(450);
      expect(row.success).toEqual(1);
      expect(row.error_message).toBeNull();
      expect(JSON.parse(row.arguments)).toEqual({ files: ["src/main.ts"] });
      expect(row.request_id).toEqual("req-123");
      expect(row.called_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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

      const row = get_db()!
        .prepare("SELECT * FROM tool_calls WHERE session_id = ?")
        .get(get_session_id()!) as {
        success: number;
        error_message: string;
      };

      expect(row.success).toEqual(0);
      expect(row.error_message).toEqual("Symbol not found");
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

    it("never throws even on DB failure", () => {
      // Force a broken state by closing the underlying DB
      const db = get_db()!;
      db.close();

      // record_tool_call should silently fail, not throw
      expect(() =>
        record_tool_call({
          tool_name: "list_entrypoints",
          arguments: {},
          duration_ms: 100,
          success: true,
        })
      ).not.toThrow();
    });
  });

  describe("close_analytics", () => {
    it("cleanly closes connection and resets state", () => {
      init_analytics("/test/project", ":memory:");
      expect(get_db()).not.toBeNull();
      expect(get_session_id()).not.toBeNull();

      close_analytics();

      expect(get_db()).toBeNull();
      expect(get_session_id()).toBeNull();
    });

    it("is safe to call when not initialized", () => {
      expect(() => close_analytics()).not.toThrow();
    });
  });
});
