import { describe, it, expect } from "vitest";
import {
  calls_per_tool,
  calls_in_range,
  recent_sessions,
  session_detail,
  ToolCallSummary,
  SessionSummary,
  ToolCallDetail,
  SessionRow,
  ToolCallRow,
} from "./query_stats";

const SESSIONS: SessionRow[] = [
  {
    session_id: "s1",
    started_at: "2026-02-17T10:00:00.000Z",
    project_path: "/project-a",
    client_name: "claude-code",
    client_version: "1.0.22",
  },
  {
    session_id: "s2",
    started_at: "2026-02-16T14:00:00.000Z",
    project_path: "/project-b",
    client_name: "claude-code",
    client_version: "1.0.21",
  },
  {
    session_id: "s3",
    started_at: "2026-02-15T08:00:00.000Z",
    project_path: "/project-a",
    client_name: null,
    client_version: null,
  },
];

const TOOL_CALLS: ToolCallRow[] = [
  {
    session_id: "s1",
    tool_name: "list_entrypoints",
    called_at: "2026-02-17T10:01:00.000Z",
    duration_ms: 400,
    success: true,
    error_message: null,
    arguments: { files: ["a.ts"] },
    request_id: "r1",
    tool_use_id: "toolu_abc1",
  },
  {
    session_id: "s1",
    tool_name: "list_entrypoints",
    called_at: "2026-02-17T10:02:00.000Z",
    duration_ms: 500,
    success: true,
    error_message: null,
    arguments: {},
    request_id: "r2",
    tool_use_id: null,
  },
  {
    session_id: "s1",
    tool_name: "show_call_graph_neighborhood",
    called_at: "2026-02-17T10:03:00.000Z",
    duration_ms: 200,
    success: true,
    error_message: null,
    arguments: { symbol_ref: "a:1#f" },
    request_id: "r3",
    tool_use_id: "toolu_abc3",
  },
  {
    session_id: "s1",
    tool_name: "list_entrypoints",
    called_at: "2026-02-17T10:04:00.000Z",
    duration_ms: 100,
    success: false,
    error_message: "Timeout",
    arguments: {},
    request_id: "r4",
    tool_use_id: null,
  },
  {
    session_id: "s2",
    tool_name: "show_call_graph_neighborhood",
    called_at: "2026-02-16T14:01:00.000Z",
    duration_ms: 300,
    success: true,
    error_message: null,
    arguments: { symbol_ref: "b:2#g" },
    request_id: "r5",
    tool_use_id: "toolu_abc5",
  },
];

describe("query_stats", () => {
  describe("calls_per_tool", () => {
    it("returns correct aggregates per tool", () => {
      const result = calls_per_tool(TOOL_CALLS);

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

    it("returns empty array for empty input", () => {
      expect(calls_per_tool([])).toEqual([]);
    });
  });

  describe("calls_in_range", () => {
    it("filters by date range correctly", () => {
      const result = calls_in_range(
        TOOL_CALLS,
        "2026-02-17T00:00:00.000Z",
        "2026-02-17T23:59:59.999Z",
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
        TOOL_CALLS,
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T23:59:59.999Z",
      );

      expect(result).toEqual([]);
    });
  });

  describe("recent_sessions", () => {
    it("returns sessions with call counts ordered by date desc", () => {
      const result = recent_sessions(SESSIONS, TOOL_CALLS, 3);

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
      const result = recent_sessions(SESSIONS, TOOL_CALLS, 1);
      expect(result.length).toEqual(1);
      expect(result[0].session_id).toEqual("s1");
    });

    it("includes client info in session summaries", () => {
      const result = recent_sessions(SESSIONS, TOOL_CALLS, 1);
      expect(result[0].client_name).toEqual("claude-code");
      expect(result[0].client_version).toEqual("1.0.22");
    });
  });

  describe("session_detail", () => {
    it("returns all calls for a specific session", () => {
      const result = session_detail(TOOL_CALLS, "s1");

      const expected: ToolCallDetail[] = [
        {
          tool_name: "list_entrypoints",
          called_at: "2026-02-17T10:01:00.000Z",
          duration_ms: 400,
          success: true,
          error_message: null,
          arguments: "{\"files\":[\"a.ts\"]}",
          request_id: "r1",
          tool_use_id: "toolu_abc1",
        },
        {
          tool_name: "list_entrypoints",
          called_at: "2026-02-17T10:02:00.000Z",
          duration_ms: 500,
          success: true,
          error_message: null,
          arguments: "{}",
          request_id: "r2",
          tool_use_id: null,
        },
        {
          tool_name: "show_call_graph_neighborhood",
          called_at: "2026-02-17T10:03:00.000Z",
          duration_ms: 200,
          success: true,
          error_message: null,
          arguments: "{\"symbol_ref\":\"a:1#f\"}",
          request_id: "r3",
          tool_use_id: "toolu_abc3",
        },
        {
          tool_name: "list_entrypoints",
          called_at: "2026-02-17T10:04:00.000Z",
          duration_ms: 100,
          success: false,
          error_message: "Timeout",
          arguments: "{}",
          request_id: "r4",
          tool_use_id: null,
        },
      ];

      expect(result).toEqual(expected);
    });

    it("returns empty array for session with no calls", () => {
      expect(session_detail(TOOL_CALLS, "s3")).toEqual([]);
    });

    it("returns empty array for non-existent session", () => {
      expect(session_detail(TOOL_CALLS, "nonexistent")).toEqual([]);
    });
  });
});
