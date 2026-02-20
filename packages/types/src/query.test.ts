/**
 * Tests for query utilities
 */

import { describe, it, expect } from "vitest";
import {
  is_ast_node,
  is_semantic_node,
  is_query_capture,
  is_query_result,
  is_resolution,
  is_query_error,
  resolve_high,
  resolve_medium,
  resolve_low,
  resolve_failed,
  create_query_error,
} from "./query";

describe("Type Guards", () => {
  describe("is_ast_node", () => {
    it("should return false for non-objects", () => {
      expect(is_ast_node(null)).toBe(false);
      expect(is_ast_node(undefined)).toBe(false);
      expect(is_ast_node("string")).toBe(false);
    });
  });

  describe("is_semantic_node", () => {
    it("should return false for non-objects", () => {
      expect(is_semantic_node(null)).toBe(false);
      expect(is_semantic_node(undefined)).toBe(false);
    });
  });

  describe("is_query_capture", () => {
    it("should return false for non-objects", () => {
      expect(is_query_capture(null)).toBe(false);
      expect(is_query_capture(undefined)).toBe(false);
    });
  });

  describe("is_query_result", () => {
    it("should return false for non-objects", () => {
      expect(is_query_result(null)).toBe(false);
      expect(is_query_result(undefined)).toBe(false);
    });
  });

  describe("is_resolution", () => {
    it("should return false for non-objects", () => {
      expect(is_resolution(null)).toBe(false);
      expect(is_resolution(undefined)).toBe(false);
    });
  });

  describe("is_query_error", () => {
    it("should return false for non-objects", () => {
      expect(is_query_error(null)).toBe(false);
      expect(is_query_error(undefined)).toBe(false);
    });
  });
});

describe("Resolution Factories", () => {
  describe("resolve_high", () => {
    it("should create a high confidence resolution", () => {
      const result = resolve_high("test");
      expect(result.resolved).toBe("test");
      expect(result.confidence).toBe("high");
    });
  });

  describe("resolve_medium", () => {
    it("should create a medium confidence resolution", () => {
      const result = resolve_medium("test", "inferred");
      expect(result.resolved).toBe("test");
      expect(result.confidence).toBe("medium");
    });
  });

  describe("resolve_low", () => {
    it("should create a low confidence resolution", () => {
      const result = resolve_low("test", "partial_match");
      expect(result.resolved).toBe("test");
      expect(result.confidence).toBe("low");
    });
  });

  describe("resolve_failed", () => {
    it("should create a failed resolution", () => {
      const result = resolve_failed<string>("not_found");
      expect(result.resolved).toBeUndefined();
      expect(result.confidence).toBe("low");
      expect(result.reason).toBe("not_found");
    });
  });
});

describe("create_query_error", () => {
  it("should create a query error", () => {
    const error = create_query_error("query_syntax", "test error");
    expect(error.message).toBe("test error");
    expect(error.kind).toBe("query_syntax");
  });
});
