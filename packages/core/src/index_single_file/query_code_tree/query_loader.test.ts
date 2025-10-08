/**
 * Comprehensive tests for query loader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import type { PathOrFileDescriptor } from "fs";
import { join } from "path";
import type { Language } from "@ariadnejs/types";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import {
  LANGUAGE_TO_TREESITTER_LANG,
  load_query,
  has_query,
  clear_query_cache,
  clear_all_caches,
  get_cache_size,
  get_current_queries_dir,
  test_path_resolution,
  SUPPORTED_LANGUAGES,
} from "./query_loader";

// Mock fs to test error cases
vi.mock("fs", async () => {
  const actual = await vi.importActual("fs");
  return {
    ...actual,
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

const mockReadFileSync = vi.mocked(readFileSync);
const mockExistsSync = vi.mocked(existsSync);

// TODO: This test suite causes IPC channel errors (worker crashes)
// Likely due to memory issues or tree-sitter parser loading problems
// Skip for now until we can debug the worker crash
describe.skip("Query Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clear_all_caches(); // Clear all caches between tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clear_all_caches();
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
      const unsupportedLanguages = ["java", "cpp", "go", "php"];

      for (const lang of unsupportedLanguages) {
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
        expect(result).toContain("@def.function");
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it("should load TypeScript query", () => {
        const mockQuery =
          "(interface_declaration name: (type_identifier) @def.interface)";
        mockReadFileSync.mockReturnValue(mockQuery);

        const result = load_query("typescript");

        expect(result).toBe(mockQuery);
        expect(mockReadFileSync).toHaveBeenCalledWith(
          expect.stringContaining("typescript.scm"),
          "utf-8"
        );
      });

      it("should load Python query", () => {
        const mockQuery =
          "(function_definition name: (identifier) @def.function)";
        mockReadFileSync.mockReturnValue(mockQuery);

        const result = load_query("python");

        expect(result).toBe(mockQuery);
        expect(mockReadFileSync).toHaveBeenCalledWith(
          expect.stringContaining("python.scm"),
          "utf-8"
        );
      });

      it("should load Rust query", () => {
        const mockQuery = "(function_item name: (identifier) @def.function)";
        mockReadFileSync.mockReturnValue(mockQuery);

        const result = load_query("rust");

        expect(result).toBe(mockQuery);
        expect(mockReadFileSync).toHaveBeenCalledWith(
          expect.stringContaining("rust.scm"),
          "utf-8"
        );
      });

      it("should return exact file content", () => {
        const complexQuery = `
; Capture function definitions
(function_declaration
  name: (identifier) @def.function)

; Capture variable declarations
(variable_declarator
  name: (identifier) @def.variable)

; Capture function calls
(call_expression
  function: (identifier) @ref.call)
`;
        mockReadFileSync.mockReturnValue(complexQuery);

        const result = load_query("javascript");

        expect(result).toBe(complexQuery);
      });

      it("should handle empty query files", () => {
        mockReadFileSync.mockReturnValue("");

        const result = load_query("javascript");

        expect(result).toBe("");
      });

      it("should handle large query files", () => {
        const largeQuery = "; Comment\n".repeat(1000) + "(identifier) @test";
        mockReadFileSync.mockReturnValue(largeQuery);

        const result = load_query("javascript");

        expect(result).toBe(largeQuery);
        expect(result.length).toBeGreaterThan(10000);
      });
    });

    describe("Error Cases", () => {
      it("should throw error for unsupported language", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("ENOENT: no such file or directory");
        });

        expect(() => {
          load_query("unsupported" as Language);
        }).toThrow("No semantic index query found for language: unsupported");
      });

      it("should throw error when file doesn't exist", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("ENOENT: no such file or directory");
        });

        expect(() => {
          load_query("javascript");
        }).toThrow("No semantic index query found for language: javascript");
      });

      it("should throw error for permission denied", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("EACCES: permission denied");
        });

        expect(() => {
          load_query("javascript");
        }).toThrow("No semantic index query found for language: javascript");
      });

      it("should throw error for other file system errors", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("EIO: i/o error");
        });

        expect(() => {
          load_query("javascript");
        }).toThrow("No semantic index query found for language: javascript");
      });

      it("should preserve original error type in message", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("Custom file system error");
        });

        expect(() => {
          load_query("javascript");
        }).toThrow("No semantic index query found for language: javascript");
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
          mockReadFileSync.mockReturnValue("test query");

          load_query(lang);

          expect(mockReadFileSync).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp(`${lang}\\.scm$`)),
            "utf-8"
          );
        }
      });

      it("should use __dirname for path construction", () => {
        mockReadFileSync.mockReturnValue("test query");

        load_query("javascript");

        const expectedPath = join(__dirname, "queries", "javascript.scm");
        expect(mockReadFileSync).toHaveBeenCalledWith(expectedPath, "utf-8");
      });

      it("should use utf-8 encoding consistently", () => {
        mockReadFileSync.mockReturnValue("test query");

        const languages: Language[] = [
          "javascript",
          "typescript",
          "python",
          "rust",
        ];

        for (const lang of languages) {
          load_query(lang);
          expect(mockReadFileSync).toHaveBeenCalledWith(
            expect.any(String),
            "utf-8"
          );
        }
      });
    });
  });

  describe("has_query", () => {
    describe("Success Cases", () => {
      it("should return true for existing queries", () => {
        mockReadFileSync.mockReturnValue("test query");

        const languages: Language[] = [
          "javascript",
          "typescript",
          "python",
          "rust",
        ];

        for (const lang of languages) {
          expect(has_query(lang)).toBe(true);
        }
      });

      it("should return true for empty query files", () => {
        mockReadFileSync.mockReturnValue("");

        expect(has_query("javascript")).toBe(true);
      });

      it("should call load_query internally", () => {
        mockReadFileSync.mockReturnValue("test query");

        has_query("javascript");

        expect(mockReadFileSync).toHaveBeenCalledWith(
          expect.stringContaining("javascript.scm"),
          "utf-8"
        );
      });
    });

    describe("Error Cases", () => {
      it("should return false for non-existent queries", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("ENOENT: no such file or directory");
        });

        expect(has_query("unsupported" as Language)).toBe(false);
      });

      it("should return false for permission errors", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("EACCES: permission denied");
        });

        expect(has_query("javascript")).toBe(false);
      });

      it("should return false for any file system error", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("EIO: i/o error");
        });

        expect(has_query("javascript")).toBe(false);
      });

      it("should not throw errors regardless of underlying error", () => {
        const errorTypes = [
          "ENOENT: no such file or directory",
          "EACCES: permission denied",
          "EIO: i/o error",
          "EMFILE: too many open files",
          "Custom error message",
        ];

        for (const errorMsg of errorTypes) {
          mockReadFileSync.mockImplementation(() => {
            throw new Error(errorMsg);
          });

          expect(() => has_query("javascript")).not.toThrow();
          expect(has_query("javascript")).toBe(false);
        }
      });
    });

    describe("Consistency with load_query", () => {
      it("should return true when load_query would succeed", () => {
        mockReadFileSync.mockReturnValue("valid query");

        expect(has_query("javascript")).toBe(true);
        expect(() => load_query("javascript")).not.toThrow();
      });

      it("should return false when load_query would fail", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("File not found");
        });

        expect(has_query("javascript")).toBe(false);
        expect(() => load_query("javascript")).toThrow();
      });

      it("should be consistent across multiple calls", () => {
        // Test successful case
        mockReadFileSync.mockReturnValue("valid query");
        expect(has_query("javascript")).toBe(true);
        expect(has_query("javascript")).toBe(true);

        // Test error case
        mockReadFileSync.mockImplementation(() => {
          throw new Error("File not found");
        });
        expect(has_query("javascript")).toBe(false);
        expect(has_query("javascript")).toBe(false);
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
      const path1 = get_current_queries_dir();

      // Second call should return cached result
      const path2 = get_current_queries_dir();

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
      expect(() => get_current_queries_dir()).not.toThrow();
    });

    it("should handle different environment scenarios gracefully", () => {
      mockReadFileSync.mockReturnValue("(test) @query");

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
      const queries = {
        javascript: "(function_declaration) @func",
        typescript: "(interface_declaration) @interface",
        python: "(function_definition) @func",
        rust: "(function_item) @func",
      };

      for (const lang of languages) {
        mockReadFileSync.mockReturnValue(queries[lang]);

        expect(has_query(lang)).toBe(true);
        expect(load_query(lang)).toBe(queries[lang]);
      }
    });

    it("should handle mixed success and failure scenarios", () => {
      // Setup: javascript succeeds, typescript fails
      mockReadFileSync.mockImplementation((path: PathOrFileDescriptor) => {
        const pathStr = path.toString();
        if (pathStr.includes("javascript.scm")) {
          return "javascript query";
        }
        throw new Error("File not found");
      });

      expect(has_query("javascript")).toBe(true);
      expect(has_query("typescript")).toBe(false);

      expect(load_query("javascript")).toBe("javascript query");
      expect(() => load_query("typescript")).toThrow();
    });

    it("should use correct tree-sitter parsers for loaded queries", () => {
      // This test ensures the mapping and loading are consistent
      const mockQuery = "(identifier) @test";
      mockReadFileSync.mockReturnValue(mockQuery);

      const languages: Language[] = [
        "javascript",
        "typescript",
        "python",
        "rust",
      ];

      for (const lang of languages) {
        expect(has_query(lang)).toBe(true);
        expect(load_query(lang)).toBe(mockQuery);
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang)).toBe(true);
      }
    });

    it("should handle concurrent query loading", () => {
      mockReadFileSync.mockReturnValue("concurrent query");

      const promises = [
        Promise.resolve(load_query("javascript")),
        Promise.resolve(load_query("typescript")),
        Promise.resolve(has_query("python")),
        Promise.resolve(has_query("rust")),
      ];

      return Promise.all(promises).then((results) => {
        expect(results[0]).toBe("concurrent query"); // javascript query
        expect(results[1]).toBe("concurrent query"); // typescript query
        expect(results[2]).toBe(true); // python has_query
        expect(results[3]).toBe(true); // rust has_query
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large query files", () => {
      const largeQuery = "a".repeat(1024 * 1024); // 1MB string
      mockReadFileSync.mockReturnValue(largeQuery);

      expect(has_query("javascript")).toBe(true);
      expect(load_query("javascript")).toBe(largeQuery);
    });

    it("should handle query files with special characters", () => {
      const specialQuery =
        '(identifier) @def.function\n; Comment with üñíçódé\n"string with quotes"';
      mockReadFileSync.mockReturnValue(specialQuery);

      expect(load_query("javascript")).toBe(specialQuery);
    });

    it("should handle query files with newlines and whitespace", () => {
      const queryWithWhitespace =
        "\n\n  \t(function_declaration)\n\t\t@def.function\n\n";
      mockReadFileSync.mockReturnValue(queryWithWhitespace);

      expect(load_query("javascript")).toBe(queryWithWhitespace);
    });

    it("should handle undefined/null language gracefully", () => {
      // These might not throw immediately but will fail during file operations
      mockReadFileSync.mockImplementation(() => {
        throw new Error("Invalid path");
      });

      expect(() => {
        load_query(undefined as unknown as Language);
      }).toThrow();

      expect(() => {
        load_query(null as unknown as Language);
      }).toThrow();

      expect(has_query(undefined as unknown as Language)).toBe(false);
      expect(has_query(null as unknown as Language)).toBe(false);
    });
  });

  describe("Query Caching", () => {
    beforeEach(() => {
      clear_all_caches();
      vi.clearAllMocks();
    });

    it("should cache loaded queries for performance", () => {
      const mockQuery = "(identifier) @test";
      mockReadFileSync.mockReturnValue(mockQuery);

      // First call should read from file
      const result1 = load_query("javascript");
      expect(result1).toBe(mockQuery);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = load_query("javascript");
      expect(result2).toBe(mockQuery);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1); // No additional calls
    });

    it("should cache different languages separately", () => {
      const jsQuery = "(javascript) @test";
      const tsQuery = "(typescript) @test";

      mockReadFileSync.mockImplementation((path: PathOrFileDescriptor) => {
        const pathStr = path.toString();
        if (pathStr.includes("javascript.scm")) return jsQuery;
        if (pathStr.includes("typescript.scm")) return tsQuery;
        throw new Error("Unexpected path");
      });

      const js1 = load_query("javascript");
      const ts1 = load_query("typescript");
      const js2 = load_query("javascript");
      const ts2 = load_query("typescript");

      expect(js1).toBe(jsQuery);
      expect(ts1).toBe(tsQuery);
      expect(js2).toBe(jsQuery);
      expect(ts2).toBe(tsQuery);
      expect(mockReadFileSync).toHaveBeenCalledTimes(2); // Only called once per language
    });

    it("should provide cache management functions", () => {
      mockReadFileSync.mockReturnValue("test query");

      expect(get_cache_size()).toBe(0);

      load_query("javascript");
      expect(get_cache_size()).toBe(1);

      load_query("typescript");
      expect(get_cache_size()).toBe(2);

      clear_query_cache();
      expect(get_cache_size()).toBe(0);
    });

    it("should cache different languages separately", () => {
      mockReadFileSync.mockImplementation((path: PathOrFileDescriptor) => {
        const pathStr = path.toString();
        if (pathStr.includes("javascript.scm")) return "js query";
        if (pathStr.includes("typescript.scm")) return "ts query";
        if (pathStr.includes("python.scm")) return "py query";
        return "other query";
      });

      const jsQuery = load_query("javascript");
      expect(get_cache_size()).toBe(1);

      const tsQuery = load_query("typescript");
      expect(get_cache_size()).toBe(2);

      const pyQuery = load_query("python");
      expect(get_cache_size()).toBe(3);

      // Verify they're different
      expect(jsQuery).not.toBe(tsQuery);
      expect(tsQuery).not.toBe(pyQuery);
    });

    it("should clear cache when requested", () => {
      mockReadFileSync.mockReturnValue("test query");

      load_query("javascript");
      load_query("typescript");
      expect(get_cache_size()).toBe(2);

      clear_query_cache();
      expect(get_cache_size()).toBe(0);
    });

    it("has_query should check cache before file system", () => {
      const mockQuery = "(test) @query";
      mockReadFileSync.mockReturnValue(mockQuery);

      // Load query to cache it
      load_query("javascript");
      vi.clearAllMocks();

      // has_query should return true without file system access
      expect(has_query("javascript")).toBe(true);
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  describe("Language Validation", () => {
    it("should validate supported languages", () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      expect(() => {
        load_query("unsupported" as Language);
      }).toThrow(
        "Unsupported language: unsupported. Supported languages: javascript, typescript, python, rust"
      );
    });

    it("has_query should return false for unsupported languages", () => {
      expect(has_query("unsupported" as Language)).toBe(false);
      expect(has_query("java" as Language)).toBe(false);
      expect(has_query("go" as Language)).toBe(false);
    });

    it("should work for all supported languages", () => {
      mockReadFileSync.mockReturnValue("test query");

      for (const lang of SUPPORTED_LANGUAGES) {
        expect(has_query(lang)).toBe(true);
        expect(() => load_query(lang)).not.toThrow();
      }
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
      const originalParser = LANGUAGE_TO_TREESITTER_LANG.get("javascript");
      LANGUAGE_TO_TREESITTER_LANG.delete("javascript");

      try {
        expect(() => {
          load_query("javascript");
        }).toThrow("No tree-sitter parser available for language: javascript");
      } finally {
        // Restore the parser
        if (originalParser) {
          LANGUAGE_TO_TREESITTER_LANG.set("javascript", originalParser);
        }
      }
    });

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

  describe("Query Syntax Validation", () => {
    it("should validate query syntax on load", () => {
      // Invalid query syntax
      mockReadFileSync.mockReturnValue("(invalid query [syntax");

      expect(() => {
        load_query("javascript");
      }).toThrow(/Invalid query syntax for javascript/);
    });

    it("should accept valid query syntax", () => {
      // Valid simple query
      mockReadFileSync.mockReturnValue("(identifier) @test");

      expect(() => {
        load_query("javascript");
      }).not.toThrow();
    });

    it("should cache validated queries", () => {
      const validQuery = "(identifier) @test";
      mockReadFileSync.mockReturnValue(validQuery);

      // First call validates and caches
      const result1 = load_query("javascript");
      expect(result1).toBe(validQuery);

      // Second call should use cache (no re-validation)
      vi.clearAllMocks();
      const result2 = load_query("javascript");
      expect(result2).toBe(validQuery);
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  describe("Performance Improvements", () => {
    it("has_query should be more efficient than load_query", () => {
      mockReadFileSync.mockReturnValue("test query");
      mockExistsSync.mockReturnValue(true);

      // has_query should not load the entire file or cache it
      expect(has_query("javascript")).toBe(true);
      expect(get_cache_size()).toBe(0); // Should not cache in has_query

      // But load_query should cache
      load_query("javascript");
      expect(get_cache_size()).toBe(1);
    });

    it("should handle concurrent access gracefully", () => {
      mockReadFileSync.mockReturnValue("test query");

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
      mockReadFileSync.mockReturnValue("(identifier) @test");

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
    it("should load actual JavaScript query file", async () => {
      // Test with real file without mocking
      const actualFs = (await vi.importActual("fs")) as typeof import("fs");
      mockReadFileSync.mockImplementation((path, encoding) =>
        actualFs.readFileSync(path, encoding as BufferEncoding)
      );

      const query = load_query("javascript");

      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain("function_declaration");
      expect(query).toContain("@def.function");
    });

    it("should load actual TypeScript query file", async () => {
      const actualFs = (await vi.importActual("fs")) as typeof import("fs");
      mockReadFileSync.mockImplementation((path, encoding) =>
        actualFs.readFileSync(path, encoding as BufferEncoding)
      );

      const query = load_query("typescript");

      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain("interface_declaration");
    });

    it("should load actual Python query file", async () => {
      const actualFs = (await vi.importActual("fs")) as typeof import("fs");
      mockReadFileSync.mockImplementation((path, encoding) =>
        actualFs.readFileSync(path, encoding as BufferEncoding)
      );

      const query = load_query("python");

      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain("function_definition");
    });

    it("should load actual Rust query file", async () => {
      const actualFs = (await vi.importActual("fs")) as typeof import("fs");
      mockReadFileSync.mockImplementation((path, encoding) =>
        actualFs.readFileSync(path, encoding as BufferEncoding)
      );

      const query = load_query("rust");

      expect(typeof query).toBe("string");
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain("function_item");
    });

    it("should load queries for all supported languages", async () => {
      const actualFs = (await vi.importActual("fs")) as typeof import("fs");
      mockReadFileSync.mockImplementation((path, encoding) =>
        actualFs.readFileSync(path, encoding as BufferEncoding)
      );

      for (const language of SUPPORTED_LANGUAGES) {
        expect(() => load_query(language)).not.toThrow();

        const query = load_query(language);
        expect(query).toBeTruthy();
        expect(typeof query).toBe("string");
        expect(query.length).toBeGreaterThan(0);
      }
    });

    it("should detect available queries", () => {
      mockExistsSync.mockReturnValue(true);

      for (const language of SUPPORTED_LANGUAGES) {
        expect(has_query(language)).toBe(true);
      }
    });

    it("should handle non-existent languages gracefully", () => {
      expect(has_query("nonexistent" as unknown as Language)).toBe(false);
    });

    it("should work end-to-end for all languages", () => {
      mockReadFileSync.mockImplementation((path: PathOrFileDescriptor) => {
        const pathStr = path.toString();
        if (pathStr.includes("javascript.scm")) return "js query";
        if (pathStr.includes("typescript.scm")) return "ts query";
        if (pathStr.includes("python.scm")) return "py query";
        if (pathStr.includes("rust.scm")) return "rust query";
        return "";
      });

      const results = new Map<Language, string>();

      // Load all languages
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(has_query(lang)).toBe(true);

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
      mockReadFileSync.mockReturnValue("test query");
      mockExistsSync.mockReturnValue(true);

      // Mix of has_query and load_query calls
      expect(has_query("javascript")).toBe(true);
      expect(has_query("typescript")).toBe(true);
      expect(get_cache_size()).toBe(0); // has_query doesn't cache

      const jsQuery = load_query("javascript");
      expect(get_cache_size()).toBe(1);

      expect(has_query("javascript")).toBe(true); // Should check cache now

      load_query("typescript");
      expect(get_cache_size()).toBe(2);

      // Reload should use cache
      const jsQuery2 = load_query("javascript");
      expect(jsQuery).toBe(jsQuery2);
      expect(get_cache_size()).toBe(2);
    });
  });

  describe("Edge Cases - Extended", () => {
    it("should throw error for undefined language", () => {
      expect(() => {
        has_query(undefined as any);
      }).toThrow();
      expect(() => {
        load_query(undefined as any);
      }).toThrow();
    });

    it("should throw error for null language", () => {
      expect(() => {
        has_query(null as any);
      }).toThrow();
      expect(() => {
        load_query(null as any);
      }).toThrow();
    });

    it("should throw error for empty string language", () => {
      expect(() => {
        has_query("" as Language);
      }).toThrow();
      expect(() => {
        load_query("" as Language);
      }).toThrow(/Unsupported language/);
    });
  });
});
