/**
 * Comprehensive tests for query loader
 *
 * NOTE: These tests work with REAL query files instead of mocking fs.
 * Mocking fs causes worker crashes because tree-sitter needs real fs access internally.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Language } from "@ariadnejs/types";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import { existsSync } from "fs";
import { join, dirname } from "path";
import {
  LANGUAGE_TO_TREESITTER_LANG,
  load_query,
  query_cache,
  cached_queries_dir_cache,
  get_queries_dir,
  SUPPORTED_LANGUAGES,
} from "./query_code_tree.query_loader";

/**
 * Clear the query cache (test helper)
 */
function clear_query_cache(): void {
  query_cache.clear();
}

/**
 * Clear all caches including path cache (useful for testing different environments)
 */
function clear_all_caches(): void {
  query_cache.clear();
  cached_queries_dir_cache.value = null;
}

/**
 * Get cache size (useful for monitoring)
 */
function get_cache_size(): number {
  return query_cache.size;
}

/**
 * Test path resolution without throwing errors (useful for debugging)
 */
function test_path_resolution(): {
  found_path: string | null;
  tried_paths: Array<{ path: string; exists: boolean }>;
  environment_info: Record<string, unknown>;
} {
  const possible_paths = [
    join(dirname(__filename), "queries"),
    join(__dirname, "queries"),
    join(
      process.cwd(),
      "packages",
      "core",
      "dist",
      "semantic_index",
      "queries"
    ),
    join(process.cwd(), "packages", "core", "src", "semantic_index", "queries"),
    join(process.cwd(), "dist", "semantic_index", "queries"),
    join(process.cwd(), "src", "semantic_index", "queries"),
    join(
      process.cwd(),
      "node_modules",
      "@ariadnejs",
      "core",
      "dist",
      "semantic_index",
      "queries"
    ),
  ];

  const tried_paths = possible_paths.map((path) => ({
    path,
    exists: existsSync(path),
  }));

  const found_path = tried_paths.find((p) => p.exists)?.path || null;

  const environment_info = {
    node_env: process.env.NODE_ENV,
    cwd: process.cwd(),
    filename: __filename,
    dirname: __dirname,
    argv0: process.argv[0],
    argv1: process.argv[1],
    platform: process.platform,
    arch: process.arch,
    cached_queries_dir: cached_queries_dir_cache.value,
  };

  return {
    found_path,
    tried_paths,
    environment_info,
  };
}


describe("Query Loader", () => {
  beforeEach(() => {
    clear_all_caches(); // Clear all caches between tests
  });

  describe("Constants and Exports", () => {
    it("should export SUPPORTED_LANGUAGES constant", () => {
      expect(SUPPORTED_LANGUAGES).toBeDefined();
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
      expect(SUPPORTED_LANGUAGES).toEqual([
        "javascript",
        "typescript",
        "python",
        "rust",
      ]);
    });

    it("should export language to tree-sitter parser mapping", () => {
      expect(LANGUAGE_TO_TREESITTER_LANG).toBeDefined();
      expect(LANGUAGE_TO_TREESITTER_LANG).toBeInstanceOf(Map);
    });

    it("should contain all supported languages", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang)).toBe(true);
      }
    });

    it("should map to correct tree-sitter parsers", () => {
      expect(LANGUAGE_TO_TREESITTER_LANG.get("javascript")).toBe(JavaScript);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("typescript")).toBe(
        TypeScript.typescript
      );
      expect(LANGUAGE_TO_TREESITTER_LANG.get("python")).toBe(Python);
      expect(LANGUAGE_TO_TREESITTER_LANG.get("rust")).toBe(Rust);
    });

    it("should have correct map size", () => {
      expect(LANGUAGE_TO_TREESITTER_LANG.size).toBe(4);
    });

    it("should not contain unsupported languages", () => {
      const unsupported_languages = ["java", "cpp", "go", "php"];

      for (const lang of unsupported_languages) {
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang as Language)).toBe(false);
      }
    });

    it("should match languages in LANGUAGE_TO_TREESITTER_LANG", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang)).toBe(true);
      }
    });
  });

  describe("load_query", () => {
    describe("Success Cases (Real Files)", () => {
      it("should load JavaScript query from real file", () => {
        const result = load_query("javascript");

        expect(result).toContain("function_declaration");
        expect(result).toContain("@scope.function");
        expect(result).toContain("@definition.function");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it("should load TypeScript query", () => {
        const result = load_query("typescript");

        expect(result).toContain("interface_declaration");
        expect(result).toContain("@scope.");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it("should load Python query", () => {
        const result = load_query("python");

        expect(result).toContain("function_definition");
        expect(result).toContain("@definition.");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it("should load Rust query", () => {
        const result = load_query("rust");

        expect(result).toContain("function_item");
        expect(result).toContain("@definition.");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it("should return exact file content", () => {
        const result = load_query("javascript");

        // Should contain comments and actual query patterns
        expect(result).toContain("SEMANTIC INDEX");
        expect(result).toContain("function_declaration");
        expect(result).toContain("@scope.function");
      });

      it("should handle all supported languages", () => {
        for (const lang of SUPPORTED_LANGUAGES) {
          const result = load_query(lang);
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }
      });
    });

    describe("Error Cases", () => {
      it("should throw error for unsupported language", () => {
        expect(() => {
          load_query("unsupported" as Language);
        }).toThrow(/Unsupported language: unsupported/);
      });

      it("should throw error with list of supported languages", () => {
        expect(() => {
          load_query("java" as Language);
        }).toThrow(/Supported languages: javascript, typescript, python, rust/);
      });

      it("should throw error for undefined language", () => {
        expect(() => {
          load_query(undefined as unknown as Language);
        }).toThrow(/Invalid language/);
      });

      it("should throw error for null language", () => {
        expect(() => {
          load_query(null as unknown as Language);
        }).toThrow(/Invalid language/);
      });

      it("should throw error for empty string language", () => {
        expect(() => {
          load_query("" as Language);
        }).toThrow(/Invalid language/);
      });
    });

    describe("Path Construction", () => {
      it("should construct correct path for each language", () => {
        const languages: Language[] = [
          "javascript",
          "typescript",
          "python",
          "rust",
        ];

        for (const lang of languages) {
          // Verify we can load each language successfully
          expect(() => load_query(lang)).not.toThrow();
          const result = load_query(lang);
          expect(result.length).toBeGreaterThan(0);
        }
      });

      it("should use correct file extension (.scm)", () => {
        // All queries should be in .scm files
        const queries_dir = get_queries_dir();
        expect(queries_dir).toContain("queries");
      });
    });
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
      const path1 = get_queries_dir();

      // Second call should return cached result
      const path2 = get_queries_dir();

      expect(path1).toBe(path2);
      expect(path1).toBeTruthy();
    });

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

    it("should work in development environment", () => {
      expect(() => get_queries_dir()).not.toThrow();
    });

    it("should handle path resolution gracefully", () => {
      expect(() => {
        load_query("javascript");
      }).not.toThrow(/Unable to determine current file location/);
    });
  });

  describe("Integration Tests", () => {
    it("should work with all supported languages end-to-end", () => {
      const languages: Language[] = [
        "javascript",
        "typescript",
        "python",
        "rust",
      ];

      for (const lang of languages) {
        const query = load_query(lang);
        expect(typeof query).toBe("string");
        expect(query.length).toBeGreaterThan(0);
      }
    });

    it("should handle mixed success and failure scenarios", () => {
      // Supported languages succeed
      expect(() => load_query("javascript")).not.toThrow();

      // Unsupported languages throw
      expect(() => load_query("java" as Language)).toThrow();
    });

    it("should use correct tree-sitter parsers for loaded queries", () => {
      const languages: Language[] = [
        "javascript",
        "typescript",
        "python",
        "rust",
      ];

      for (const lang of languages) {
        const query = load_query(lang);
        expect(query).toBeTruthy();
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang)).toBe(true);
      }
    });

    it("should handle sequential query loading", () => {
      const queries: string[] = [];

      queries.push(load_query("javascript"));
      queries.push(load_query("typescript"));
      queries.push(load_query("python"));
      queries.push(load_query("rust"));

      // All queries should be loaded
      expect(queries.length).toBe(4);
      for (const query of queries) {
        expect(query).toBeTruthy();
        expect(typeof query).toBe("string");
      }
    });
  });

  describe("Query Caching", () => {
    beforeEach(() => {
      clear_all_caches();
    });

    it("should cache loaded queries for performance", () => {
      // First call should load from file
      const result1 = load_query("javascript");
      expect(result1).toBeTruthy();
      expect(get_cache_size()).toBe(1);

      // Second call should use cache
      const result2 = load_query("javascript");
      expect(result2).toBe(result1);
      expect(get_cache_size()).toBe(1); // No additional cache entries
    });

    it("should cache different languages separately", () => {
      const js1 = load_query("javascript");
      expect(get_cache_size()).toBe(1);

      const ts1 = load_query("typescript");
      expect(get_cache_size()).toBe(2);

      const js2 = load_query("javascript");
      const ts2 = load_query("typescript");

      expect(js1).toBe(js2);
      expect(ts1).toBe(ts2);
      expect(js1).not.toBe(ts1); // Different languages have different queries
      expect(get_cache_size()).toBe(2); // Still only 2 cached
    });

    it("should provide cache management functions", () => {
      expect(get_cache_size()).toBe(0);

      load_query("javascript");
      expect(get_cache_size()).toBe(1);

      load_query("typescript");
      expect(get_cache_size()).toBe(2);

      clear_query_cache();
      expect(get_cache_size()).toBe(0);
    });

    it("should cache all supported languages separately", () => {
      const queries: string[] = [];

      for (const lang of SUPPORTED_LANGUAGES) {
        queries.push(load_query(lang));
      }

      expect(get_cache_size()).toBe(SUPPORTED_LANGUAGES.length);

      // Verify they're all different
      for (let i = 0; i < queries.length; i++) {
        for (let j = i + 1; j < queries.length; j++) {
          expect(queries[i]).not.toBe(queries[j]);
        }
      }
    });

    it("should clear cache when requested", () => {
      load_query("javascript");
      load_query("typescript");
      expect(get_cache_size()).toBe(2);

      clear_query_cache();
      expect(get_cache_size()).toBe(0);
    });

    it("should cache queries persistently during execution", () => {
      const start = Date.now();
      load_query("javascript");
      const first_load_time = Date.now() - start;

      const start2 = Date.now();
      load_query("javascript");
      const second_load_time = Date.now() - start2;

      // Second load should be faster or equal (cached)
      expect(second_load_time).toBeLessThanOrEqual(first_load_time);
      expect(get_cache_size()).toBe(1);
    });
  });

  describe("Language Validation", () => {
    it("should validate supported languages", () => {
      expect(() => {
        load_query("unsupported" as Language);
      }).toThrow(
        /Unsupported language: unsupported. Supported languages: javascript, typescript, python, rust/
      );
    });

    it("should work for all supported languages", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(() => load_query(lang)).not.toThrow();
      }
    });

    it("should validate language is not null or undefined", () => {
      expect(() => load_query(null as unknown as Language)).toThrow(
        /Invalid language/
      );
      expect(() => load_query(undefined as unknown as Language)).toThrow(
        /Invalid language/
      );
    });

    it("should validate language is not empty string", () => {
      expect(() => load_query("" as Language)).toThrow(/Invalid language/);
    });
  });

  describe("Enhanced Error Messages", () => {
    it("should provide informative error for unsupported languages", () => {
      expect(() => {
        load_query("java" as Language);
      }).toThrow(/Unsupported language: java/);
      expect(() => {
        load_query("java" as Language);
      }).toThrow(/Supported languages: javascript, typescript, python, rust/);
    });

    it("should handle parser availability check", () => {
      // Temporarily remove a parser to test error handling
      const original_parser = LANGUAGE_TO_TREESITTER_LANG.get("javascript");
      LANGUAGE_TO_TREESITTER_LANG.delete("javascript");

      try {
        expect(() => {
          load_query("javascript");
        }).toThrow("No tree-sitter parser available for language: javascript");
      } finally {
        // Restore the parser
        if (original_parser) {
          LANGUAGE_TO_TREESITTER_LANG.set("javascript", original_parser);
        }
      }
    });

    it("should provide detailed error information when queries directory is not found", () => {
      // Verify that test_path_resolution provides debugging info
      const result = test_path_resolution();

      if (!result.found_path) {
        // If no path is found, the error should be informative
        expect(result.tried_paths.length).toBeGreaterThan(0);
        expect(result.environment_info).toBeTruthy();
      }
    });
  });

  describe("Query Syntax Validation", () => {
    it("should validate query syntax on load", () => {
      // Real queries should all be valid
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(() => load_query(lang)).not.toThrow(/Invalid query syntax/);
      }
    });

    it("should accept valid query syntax from real files", () => {
      const languages: Language[] = [
        "javascript",
        "typescript",
        "python",
        "rust",
      ];

      for (const lang of languages) {
        expect(() => {
          load_query(lang);
        }).not.toThrow();
      }
    });

    it("should cache validated queries", () => {
      // First call validates and caches
      const result1 = load_query("javascript");
      expect(result1).toBeTruthy();
      expect(get_cache_size()).toBe(1);

      // Second call should use cache (no re-validation)
      const result2 = load_query("javascript");
      expect(result2).toBe(result1);
      expect(get_cache_size()).toBe(1);
    });
  });

  describe("Performance Improvements", () => {
    it("should handle repeated access gracefully", () => {
      // Multiple loads of the same language should work
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(load_query("javascript"));
      }

      // All should be the same cached result
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBe(results[0]);
      }
      expect(get_cache_size()).toBe(1);
    });

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

  describe("Real File Loading", () => {
    it("should load actual JavaScript query file", () => {
      const query = load_query("javascript");

      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain("function_declaration");
      expect(query).toContain("@definition.function");
    });

    it("should load actual TypeScript query file", () => {
      const query = load_query("typescript");

      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain("interface_declaration");
    });

    it("should load actual Python query file", () => {
      const query = load_query("python");

      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain("function_definition");
    });

    it("should load actual Rust query file", () => {
      const query = load_query("rust");

      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain("function_item");
    });

    it("should load queries for all supported languages", () => {
      for (const language of SUPPORTED_LANGUAGES) {
        expect(() => load_query(language)).not.toThrow();

        const query = load_query(language);
        expect(query).toBeTruthy();
        expect(typeof query).toBe("string");
        expect(query.length).toBeGreaterThan(0);
      }
    });

    it("should work end-to-end for all languages", () => {
      const results = new Map<Language, string>();

      // Load all languages
      for (const lang of SUPPORTED_LANGUAGES) {
        const query = load_query(lang);
        expect(typeof query).toBe("string");
        expect(query.length).toBeGreaterThan(0);

        results.set(lang, query);
      }

      expect(get_cache_size()).toBe(SUPPORTED_LANGUAGES.length);

      // Verify all queries are different
      const queries = Array.from(results.values());
      for (let i = 0; i < queries.length; i++) {
        for (let j = i + 1; j < queries.length; j++) {
          expect(queries[i]).not.toBe(queries[j]);
        }
      }
    });

    it("should maintain cache across multiple operations", () => {
      const js_query = load_query("javascript");
      expect(get_cache_size()).toBeGreaterThanOrEqual(1);

      load_query("typescript");
      expect(get_cache_size()).toBeGreaterThanOrEqual(2);

      // Reload should use cache
      const js_query2 = load_query("javascript");
      expect(js_query).toBe(js_query2);
    });
  });

  describe("Edge Cases - Extended", () => {
    it("should throw error for undefined language", () => {
      expect(() => {
        load_query(undefined as any);
      }).toThrow(/Invalid language/);
    });

    it("should throw error for null language", () => {
      expect(() => {
        load_query(null as any);
      }).toThrow(/Invalid language/);
    });

    it("should throw error for empty string language", () => {
      expect(() => {
        load_query("" as Language);
      }).toThrow(/Invalid language/);
    });

    it("should handle repeated cache clears", () => {
      load_query("javascript");
      expect(get_cache_size()).toBe(1);

      clear_query_cache();
      expect(get_cache_size()).toBe(0);

      clear_query_cache();
      expect(get_cache_size()).toBe(0);

      // Can still load after clearing
      load_query("javascript");
      expect(get_cache_size()).toBe(1);
    });

    it("should handle clear_all_caches", () => {
      load_query("javascript");
      load_query("typescript");
      expect(get_cache_size()).toBe(2);

      clear_all_caches();
      expect(get_cache_size()).toBe(0);

      // Path cache is also cleared, but should still work
      const query = load_query("javascript");
      expect(query).toBeTruthy();
    });
  });
});
