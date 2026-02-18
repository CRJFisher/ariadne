import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  calls_per_tool,
  calls_in_range,
  recent_sessions,
  session_detail,
  ToolCallSummary,
  SessionSummary,
  ToolCallDetail,
} from "./query_stats";

const SCHEMA = `
CREATE TABLE sessions (
  session_id      TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL,
  project_path    TEXT NOT NULL,
  client_name     TEXT,
  client_version  TEXT
);

CREATE TABLE tool_calls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL,
  tool_name     TEXT NOT NULL,
  called_at     TEXT NOT NULL,
  duration_ms   INTEGER NOT NULL,
  success       INTEGER NOT NULL,
  error_message TEXT,
  arguments     TEXT NOT NULL,
  request_id    TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE INDEX idx_tool_calls_session ON tool_calls(session_id);
CREATE INDEX idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX idx_tool_calls_called_at ON tool_calls(called_at);
`;

function seed_db(db: Database.Database): void {
  db.exec(SCHEMA);

  // Insert sessions
  db.prepare(
    "INSERT INTO sessions VALUES (?, ?, ?, ?, ?)"
  ).run("s1", "2026-02-17T10:00:00.000Z", "/project-a", "claude-code", "1.0.22");

  db.prepare(
    "INSERT INTO sessions VALUES (?, ?, ?, ?, ?)"
  ).run("s2", "2026-02-16T14:00:00.000Z", "/project-b", "claude-code", "1.0.21");

  db.prepare(
    "INSERT INTO sessions VALUES (?, ?, ?, ?, ?)"
  ).run("s3", "2026-02-15T08:00:00.000Z", "/project-a", null, null);

  // Insert tool calls for s1
  const insert_call = db.prepare(
    "INSERT INTO tool_calls (session_id, tool_name, called_at, duration_ms, success, error_message, arguments, request_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  insert_call.run("s1", "list_entrypoints", "2026-02-17T10:01:00.000Z", 400, 1, null, "{\"files\":[\"a.ts\"]}", "r1");
  insert_call.run("s1", "list_entrypoints", "2026-02-17T10:02:00.000Z", 500, 1, null, "{}", "r2");
  insert_call.run("s1", "show_call_graph_neighborhood", "2026-02-17T10:03:00.000Z", 200, 1, null, "{\"symbol_ref\":\"a:1#f\"}", "r3");
  insert_call.run("s1", "list_entrypoints", "2026-02-17T10:04:00.000Z", 100, 0, "Timeout", "{}", "r4");

  // Insert tool calls for s2
  insert_call.run("s2", "show_call_graph_neighborhood", "2026-02-16T14:01:00.000Z", 300, 1, null, "{\"symbol_ref\":\"b:2#g\"}", "r5");

  // s3 has no tool calls
}

describe("query_stats", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    seed_db(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("calls_per_tool", () => {
    it("returns correct aggregates per tool", () => {
      const result = calls_per_tool(db);

      const expected: ToolCallSummary[] = [
        {
          tool_name: "list_entrypoints",
          total_calls: 3,
          success_count: 2,
          failure_count: 1,
          avg_duration_ms: 333,
        },
        {
          tool_name: "show_call_graph_neighborhood",
          total_calls: 2,
          success_count: 2,
          failure_count: 0,
          avg_duration_ms: 250,
        },
      ];

      expect(result).toEqual(expected);
    });

    it("returns empty array for empty DB", () => {
      const empty_db = new Database(":memory:");
      empty_db.exec(SCHEMA);

      expect(calls_per_tool(empty_db)).toEqual([]);
      empty_db.close();
    });
  });

  describe("calls_in_range", () => {
    it("filters by date range correctly", () => {
      const result = calls_in_range(
        db,
        "2026-02-17T00:00:00.000Z",
        "2026-02-17T23:59:59.999Z"
      );

      const expected: ToolCallSummary[] = [
        {
          tool_name: "list_entrypoints",
          total_calls: 3,
          success_count: 2,
          failure_count: 1,
          avg_duration_ms: 333,
        },
        {
          tool_name: "show_call_graph_neighborhood",
          total_calls: 1,
          success_count: 1,
          failure_count: 0,
          avg_duration_ms: 200,
        },
      ];

      expect(result).toEqual(expected);
    });

    it("returns empty array when no calls in range", () => {
      const result = calls_in_range(
        db,
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T23:59:59.999Z"
      );

      expect(result).toEqual([]);
    });
  });

  describe("recent_sessions", () => {
    it("returns sessions with call counts ordered by date desc", () => {
      const result = recent_sessions(db, 3);

      const expected: SessionSummary[] = [
        {
          session_id: "s1",
          started_at: "2026-02-17T10:00:00.000Z",
          project_path: "/project-a",
          client_name: "claude-code",
          client_version: "1.0.22",
          call_count: 4,
        },
        {
          session_id: "s2",
          started_at: "2026-02-16T14:00:00.000Z",
          project_path: "/project-b",
          client_name: "claude-code",
          client_version: "1.0.21",
          call_count: 1,
        },
        {
          session_id: "s3",
          started_at: "2026-02-15T08:00:00.000Z",
          project_path: "/project-a",
          client_name: null,
          client_version: null,
          call_count: 0,
        },
      ];

      expect(result).toEqual(expected);
    });

    it("respects limit parameter", () => {
      const result = recent_sessions(db, 1);
      expect(result.length).toEqual(1);
      expect(result[0].session_id).toEqual("s1");
    });

    it("includes client info in session summaries", () => {
      const result = recent_sessions(db, 1);
      expect(result[0].client_name).toEqual("claude-code");
      expect(result[0].client_version).toEqual("1.0.22");
    });
  });

  describe("session_detail", () => {
    it("returns all calls for a specific session", () => {
      const result = session_detail(db, "s1");

      const expected: ToolCallDetail[] = [
        {
          id: 1,
          tool_name: "list_entrypoints",
          called_at: "2026-02-17T10:01:00.000Z",
          duration_ms: 400,
          success: true,
          error_message: null,
          arguments: "{\"files\":[\"a.ts\"]}",
          request_id: "r1",
        },
        {
          id: 2,
          tool_name: "list_entrypoints",
          called_at: "2026-02-17T10:02:00.000Z",
          duration_ms: 500,
          success: true,
          error_message: null,
          arguments: "{}",
          request_id: "r2",
        },
        {
          id: 3,
          tool_name: "show_call_graph_neighborhood",
          called_at: "2026-02-17T10:03:00.000Z",
          duration_ms: 200,
          success: true,
          error_message: null,
          arguments: "{\"symbol_ref\":\"a:1#f\"}",
          request_id: "r3",
        },
        {
          id: 4,
          tool_name: "list_entrypoints",
          called_at: "2026-02-17T10:04:00.000Z",
          duration_ms: 100,
          success: false,
          error_message: "Timeout",
          arguments: "{}",
          request_id: "r4",
        },
      ];

      expect(result).toEqual(expected);
    });

    it("returns empty array for session with no calls", () => {
      expect(session_detail(db, "s3")).toEqual([]);
    });

    it("returns empty array for non-existent session", () => {
      expect(session_detail(db, "nonexistent")).toEqual([]);
    });
  });
});
