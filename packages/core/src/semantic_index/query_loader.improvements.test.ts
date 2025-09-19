/**
 * Tests for query loader improvements and bug fixes
 * Tests the actual functionality with real files and caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Language } from '@ariadnejs/types';
import {
  load_query,
  has_query,
  clear_query_cache,
  get_cache_size,
  SUPPORTED_LANGUAGES,
  LANGUAGE_TO_TREESITTER_LANG
} from "./query_loader";

describe("Query Loader Improvements", () => {
  beforeEach(() => {
    clear_query_cache(); // Start each test with empty cache
  });

  describe("SUPPORTED_LANGUAGES constant", () => {
    it("should export array of supported languages", () => {
      expect(SUPPORTED_LANGUAGES).toBeDefined();
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
      expect(SUPPORTED_LANGUAGES).toEqual(['javascript', 'typescript', 'python', 'rust']);
    });

    it("should match languages in LANGUAGE_TO_TREESITTER_LANG", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang)).toBe(true);
      }
    });
  });

  describe("Query Caching System", () => {
    it("should start with empty cache", () => {
      expect(get_cache_size()).toBe(0);
    });

    it("should cache loaded queries", () => {
      expect(get_cache_size()).toBe(0);

      // Load a query
      const query1 = load_query('javascript');
      expect(get_cache_size()).toBe(1);

      // Load the same query again - should use cache
      const query2 = load_query('javascript');
      expect(query1).toBe(query2); // Should be same reference
      expect(get_cache_size()).toBe(1);
    });

    it("should cache different languages separately", () => {
      const jsQuery = load_query('javascript');
      expect(get_cache_size()).toBe(1);

      const tsQuery = load_query('typescript');
      expect(get_cache_size()).toBe(2);

      const pyQuery = load_query('python');
      expect(get_cache_size()).toBe(3);

      // Verify they're different
      expect(jsQuery).not.toBe(tsQuery);
      expect(tsQuery).not.toBe(pyQuery);
    });

    it("should clear cache when requested", () => {
      load_query('javascript');
      load_query('typescript');
      expect(get_cache_size()).toBe(2);

      clear_query_cache();
      expect(get_cache_size()).toBe(0);
    });

    it("has_query should check cache first", () => {
      // Load query to cache it
      load_query('javascript');

      // has_query should return true immediately
      expect(has_query('javascript')).toBe(true);
    });
  });

  describe("Real File Loading", () => {
    it("should load actual JavaScript query file", () => {
      const query = load_query('javascript');

      expect(typeof query).toBe('string');
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain('function_declaration');
      expect(query).toContain('@def.function');
    });

    it("should load actual TypeScript query file", () => {
      const query = load_query('typescript');

      expect(typeof query).toBe('string');
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain('interface_declaration');
    });

    it("should load actual Python query file", () => {
      const query = load_query('python');

      expect(typeof query).toBe('string');
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain('function_definition');
    });

    it("should load actual Rust query file", () => {
      const query = load_query('rust');

      expect(typeof query).toBe('string');
      expect(query.length).toBeGreaterThan(0);
      expect(query).toContain('function_item');
    });
  });

  describe("Language Validation", () => {
    it("should validate supported languages", () => {
      expect(() => {
        load_query('unsupported' as Language);
      }).toThrow('Unsupported language: unsupported. Supported languages: javascript, typescript, python, rust');
    });

    it("has_query should return false for unsupported languages", () => {
      expect(has_query('unsupported' as Language)).toBe(false);
      expect(has_query('java' as Language)).toBe(false);
      expect(has_query('go' as Language)).toBe(false);
    });

    it("should work for all supported languages", () => {
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(has_query(lang)).toBe(true);
        expect(() => load_query(lang)).not.toThrow();
      }
    });
  });

  describe("Query Syntax Validation", () => {
    it("should validate query syntax when loading", () => {
      // All real query files should have valid syntax
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(() => {
          load_query(lang);
        }).not.toThrow();
      }
    });

    it("should cache validated queries", () => {
      // Load and validate once
      const query1 = load_query('javascript');
      expect(get_cache_size()).toBe(1);

      // Second load should use cache (no re-validation)
      const query2 = load_query('javascript');
      expect(query1).toBe(query2); // Same reference
      expect(get_cache_size()).toBe(1);
    });
  });

  describe("Enhanced Error Messages", () => {
    it("should provide informative error for unsupported languages", () => {
      expect(() => {
        load_query('java' as Language);
      }).toThrow(/Unsupported language: java/);
      expect(() => {
        load_query('java' as Language);
      }).toThrow(/Supported languages: javascript, typescript, python, rust/);
    });

    it("should handle parser availability check", () => {
      // Temporarily remove a parser to test error handling
      const originalParser = LANGUAGE_TO_TREESITTER_LANG.get('javascript');
      LANGUAGE_TO_TREESITTER_LANG.delete('javascript');

      try {
        expect(() => {
          load_query('javascript');
        }).toThrow('No tree-sitter parser available for language: javascript');
      } finally {
        // Restore the parser
        if (originalParser) {
          LANGUAGE_TO_TREESITTER_LANG.set('javascript', originalParser);
        }
      }
    });
  });

  describe("Performance Improvements", () => {
    it("has_query should be more efficient than load_query", () => {
      // has_query should not load the entire file
      expect(has_query('javascript')).toBe(true);
      expect(get_cache_size()).toBe(0); // Should not cache in has_query

      // But load_query should cache
      load_query('javascript');
      expect(get_cache_size()).toBe(1);
    });

    it("should handle concurrent access gracefully", () => {
      // Multiple loads of the same language should work
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(load_query('javascript'));
      }

      // All should be the same cached result
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBe(results[0]);
      }
      expect(get_cache_size()).toBe(1);
    });
  });

  describe("Integration Tests", () => {
    it("should work end-to-end for all languages", () => {
      const results = new Map<Language, string>();

      // Load all languages
      for (const lang of SUPPORTED_LANGUAGES) {
        expect(has_query(lang)).toBe(true);

        const query = load_query(lang);
        expect(typeof query).toBe('string');
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
      // Mix of has_query and load_query calls
      expect(has_query('javascript')).toBe(true);
      expect(has_query('typescript')).toBe(true);
      expect(get_cache_size()).toBe(0); // has_query doesn't cache

      const jsQuery = load_query('javascript');
      expect(get_cache_size()).toBe(1);

      expect(has_query('javascript')).toBe(true); // Should check cache now

      const tsQuery = load_query('typescript');
      expect(get_cache_size()).toBe(2);

      // Reload should use cache
      const jsQuery2 = load_query('javascript');
      expect(jsQuery).toBe(jsQuery2);
      expect(get_cache_size()).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined language gracefully", () => {
      expect(has_query(undefined as any)).toBe(false);
      expect(() => {
        load_query(undefined as any);
      }).toThrow();
    });

    it("should handle null language gracefully", () => {
      expect(has_query(null as any)).toBe(false);
      expect(() => {
        load_query(null as any);
      }).toThrow();
    });

    it("should handle empty string language", () => {
      expect(has_query('' as Language)).toBe(false);
      expect(() => {
        load_query('' as Language);
      }).toThrow(/Unsupported language/);
    });
  });
});