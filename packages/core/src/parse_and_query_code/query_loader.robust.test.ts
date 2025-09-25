/**
 * Comprehensive tests for robust query loading across different environments
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Language } from "@ariadnejs/types";
import {
  load_query,
  has_query,
  clear_all_caches,
  get_current_queries_dir,
  test_path_resolution,
  SUPPORTED_LANGUAGES,
} from "./query_loader";

describe("Robust Query Loading", () => {
  beforeEach(() => {
    clear_all_caches();
  });

  afterEach(() => {
    clear_all_caches();
  });

  describe("Path Resolution", () => {
    it("should find the queries directory", () => {
      const result = test_path_resolution();

      expect(result.found_path).toBeTruthy();
      expect(result.found_path).toMatch(/queries$/);

      // Should find at least one valid path
      const valid_paths = result.tried_paths.filter((p) => p.exists);
      expect(valid_paths.length).toBeGreaterThan(0);
    });

    it("should provide detailed environment information", () => {
      const result = test_path_resolution();

      expect(result.environment_info).toHaveProperty("cwd");
      expect(result.environment_info).toHaveProperty("filename");
      expect(result.environment_info).toHaveProperty("dirname");
      expect(result.environment_info).toHaveProperty("platform");
      expect(result.environment_info).toHaveProperty("arch");
    });

    it("should cache the queries directory path", () => {
      // First call should compute the path
      const path1 = get_current_queries_dir();

      // Second call should return cached result
      const path2 = get_current_queries_dir();

      expect(path1).toBe(path2);
      expect(path1).toBeTruthy();
    });
  });

  describe("Query Loading in Different Contexts", () => {
    it("should load queries for all supported languages", () => {
      for (const language of SUPPORTED_LANGUAGES) {
        expect(() => load_query(language)).not.toThrow();

        const query = load_query(language);
        expect(query).toBeTruthy();
        expect(typeof query).toBe("string");
        expect(query.length).toBeGreaterThan(0);
      }
    });

    it("should detect available queries", () => {
      for (const language of SUPPORTED_LANGUAGES) {
        expect(has_query(language)).toBe(true);
      }
    });

    it("should handle non-existent languages gracefully", () => {
      expect(has_query("nonexistent" as unknown as Language)).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should provide detailed error information when queries directory is not found", () => {
      // This test would need to be run in an environment where queries don't exist
      // For now, we'll just verify the error structure by looking at the test_path_resolution
      const result = test_path_resolution();

      if (!result.found_path) {
        // If no path is found, the error should be informative
        expect(result.tried_paths.length).toBeGreaterThan(0);
        expect(result.environment_info).toBeTruthy();
      }
    });
  });

  describe("Performance", () => {
    it("should cache queries for performance", () => {
      const start = Date.now();
      load_query("javascript");
      const first_load_time = Date.now() - start;

      const start2 = Date.now();
      load_query("javascript");
      const second_load_time = Date.now() - start2;

      // Second load should be faster (cached)
      expect(second_load_time).toBeLessThanOrEqual(first_load_time);
    });
  });

  describe("Environment Simulation", () => {
    it("should work in development environment", () => {
      // This is essentially what we're testing in the current environment
      expect(() => get_current_queries_dir()).not.toThrow();
    });

    // Note: These tests would need to be run in actual CI/production environments
    // to fully verify behavior, but the path resolution strategy should handle them

    it("should provide debugging information for CI environments", () => {
      const result = test_path_resolution();

      // Verify that we have the information needed to debug CI issues
      expect(result.environment_info).toHaveProperty("node_env");
      expect(result.environment_info).toHaveProperty("cwd");
      expect(result.tried_paths).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining("packages/core"),
            exists: expect.any(Boolean),
          }),
        ])
      );
    });
  });
});
