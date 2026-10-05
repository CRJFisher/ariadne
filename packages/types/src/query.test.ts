/**
 * Tests for query utilities
 */

import { describe, it, expect } from "vitest";
import {
  is_ast_node,
  is_semantic_node,
  is_query_capture,
  is_query_result,
  is_query_error,
  create_query_error,
} from "./query";

describe("Type Guards", () => {
  describe("is_ast_node", () => {
    it("returns false for non-objects", () => {
      expect(is_ast_node(null)).toBe(false);
      expect(is_ast_node(undefined)).toBe(false);
      expect(is_ast_node("string")).toBe(false);
    });
  });

  describe("is_semantic_node", () => {
    it("returns false for non-objects", () => {
      expect(is_semantic_node(null)).toBe(false);
      expect(is_semantic_node(undefined)).toBe(false);
    });
  });

  describe("is_query_capture", () => {
    it("returns false for non-objects", () => {
      expect(is_query_capture(null)).toBe(false);
      expect(is_query_capture(undefined)).toBe(false);
    });
  });

  describe("is_query_result", () => {
    it("returns false for non-objects", () => {
      expect(is_query_result(null)).toBe(false);
      expect(is_query_result(undefined)).toBe(false);
    });
  });

  describe("is_query_error", () => {
    it("returns false for non-objects", () => {
      expect(is_query_error(null)).toBe(false);
      expect(is_query_error(undefined)).toBe(false);
    });
  });
});

describe("create_query_error", () => {
  it("creates a query error", () => {
    const error = create_query_error("query_syntax", "test error");
    expect(error.message).toBe("test error");
    expect(error.kind).toBe("query_syntax");
  });
});
