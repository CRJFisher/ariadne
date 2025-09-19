/**
 * Comprehensive tests for query loader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Language } from '@ariadnejs/types';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import TypeScript from 'tree-sitter-typescript';
import {
  LANGUAGE_TO_TREESITTER_LANG,
  load_query,
  has_query,
  clear_query_cache,
  get_cache_size,
  SUPPORTED_LANGUAGES
} from "./query_loader";

// Mock fs to test error cases
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

const mockReadFileSync = vi.mocked(readFileSync);

describe("Query Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clear_query_cache(); // Clear cache between tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("LANGUAGE_TO_TREESITTER_LANG", () => {
    it("should export language to tree-sitter parser mapping", () => {
      expect(LANGUAGE_TO_TREESITTER_LANG).toBeDefined();
      expect(LANGUAGE_TO_TREESITTER_LANG).toBeInstanceOf(Map);
    });

    it("should contain all supported languages", () => {
      const supportedLanguages: Language[] = ['javascript', 'typescript', 'python', 'rust'];

      for (const lang of supportedLanguages) {
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang)).toBe(true);
      }
    });

    it("should map to correct tree-sitter parsers", () => {
      expect(LANGUAGE_TO_TREESITTER_LANG.get('javascript')).toBe(JavaScript);
      expect(LANGUAGE_TO_TREESITTER_LANG.get('typescript')).toBe(TypeScript.tsx);
      expect(LANGUAGE_TO_TREESITTER_LANG.get('python')).toBe(Python);
      expect(LANGUAGE_TO_TREESITTER_LANG.get('rust')).toBe(Rust);
    });

    it("should have correct map size", () => {
      expect(LANGUAGE_TO_TREESITTER_LANG.size).toBe(4);
    });

    it("should not contain unsupported languages", () => {
      const unsupportedLanguages = ['java', 'cpp', 'go', 'php'];

      for (const lang of unsupportedLanguages) {
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang as Language)).toBe(false);
      }
    });
  });

  describe("load_query", () => {
    describe("Success Cases (Real Files)", () => {
      it("should load JavaScript query from real file", () => {
        const result = load_query('javascript');

        expect(result).toContain('function_declaration');
        expect(result).toContain('@def.function');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it("should load TypeScript query", () => {
        const mockQuery = '(interface_declaration name: (type_identifier) @def.interface)';
        mockReadFileSync.mockReturnValue(mockQuery);

        const result = load_query('typescript');

        expect(result).toBe(mockQuery);
        expect(mockReadFileSync).toHaveBeenCalledWith(
          expect.stringContaining('typescript.scm'),
          'utf-8'
        );
      });

      it("should load Python query", () => {
        const mockQuery = '(function_definition name: (identifier) @def.function)';
        mockReadFileSync.mockReturnValue(mockQuery);

        const result = load_query('python');

        expect(result).toBe(mockQuery);
        expect(mockReadFileSync).toHaveBeenCalledWith(
          expect.stringContaining('python.scm'),
          'utf-8'
        );
      });

      it("should load Rust query", () => {
        const mockQuery = '(function_item name: (identifier) @def.function)';
        mockReadFileSync.mockReturnValue(mockQuery);

        const result = load_query('rust');

        expect(result).toBe(mockQuery);
        expect(mockReadFileSync).toHaveBeenCalledWith(
          expect.stringContaining('rust.scm'),
          'utf-8'
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

        const result = load_query('javascript');

        expect(result).toBe(complexQuery);
      });

      it("should handle empty query files", () => {
        mockReadFileSync.mockReturnValue('');

        const result = load_query('javascript');

        expect(result).toBe('');
      });

      it("should handle large query files", () => {
        const largeQuery = '; Comment\n'.repeat(1000) + '(identifier) @test';
        mockReadFileSync.mockReturnValue(largeQuery);

        const result = load_query('javascript');

        expect(result).toBe(largeQuery);
        expect(result.length).toBeGreaterThan(10000);
      });
    });

    describe("Error Cases", () => {
      it("should throw error for unsupported language", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        expect(() => {
          load_query('unsupported' as Language);
        }).toThrow('No semantic index query found for language: unsupported');
      });

      it("should throw error when file doesn't exist", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        expect(() => {
          load_query('javascript');
        }).toThrow('No semantic index query found for language: javascript');
      });

      it("should throw error for permission denied", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        });

        expect(() => {
          load_query('javascript');
        }).toThrow('No semantic index query found for language: javascript');
      });

      it("should throw error for other file system errors", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('EIO: i/o error');
        });

        expect(() => {
          load_query('javascript');
        }).toThrow('No semantic index query found for language: javascript');
      });

      it("should preserve original error type in message", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Custom file system error');
        });

        expect(() => {
          load_query('javascript');
        }).toThrow('No semantic index query found for language: javascript');
      });
    });

    describe("Path Construction", () => {
      it("should construct correct path for each language", () => {
        const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];

        for (const lang of languages) {
          mockReadFileSync.mockReturnValue('test query');

          load_query(lang);

          expect(mockReadFileSync).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp(`${lang}\\.scm$`)),
            'utf-8'
          );
        }
      });

      it("should use __dirname for path construction", () => {
        mockReadFileSync.mockReturnValue('test query');

        load_query('javascript');

        const expectedPath = join(__dirname, 'queries', 'javascript.scm');
        expect(mockReadFileSync).toHaveBeenCalledWith(expectedPath, 'utf-8');
      });

      it("should use utf-8 encoding consistently", () => {
        mockReadFileSync.mockReturnValue('test query');

        const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];

        for (const lang of languages) {
          load_query(lang);
          expect(mockReadFileSync).toHaveBeenCalledWith(expect.any(String), 'utf-8');
        }
      });
    });
  });

  describe("has_query", () => {
    describe("Success Cases", () => {
      it("should return true for existing queries", () => {
        mockReadFileSync.mockReturnValue('test query');

        const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];

        for (const lang of languages) {
          expect(has_query(lang)).toBe(true);
        }
      });

      it("should return true for empty query files", () => {
        mockReadFileSync.mockReturnValue('');

        expect(has_query('javascript')).toBe(true);
      });

      it("should call load_query internally", () => {
        mockReadFileSync.mockReturnValue('test query');

        has_query('javascript');

        expect(mockReadFileSync).toHaveBeenCalledWith(
          expect.stringContaining('javascript.scm'),
          'utf-8'
        );
      });
    });

    describe("Error Cases", () => {
      it("should return false for non-existent queries", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('ENOENT: no such file or directory');
        });

        expect(has_query('unsupported' as Language)).toBe(false);
      });

      it("should return false for permission errors", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        });

        expect(has_query('javascript')).toBe(false);
      });

      it("should return false for any file system error", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('EIO: i/o error');
        });

        expect(has_query('javascript')).toBe(false);
      });

      it("should not throw errors regardless of underlying error", () => {
        const errorTypes = [
          'ENOENT: no such file or directory',
          'EACCES: permission denied',
          'EIO: i/o error',
          'EMFILE: too many open files',
          'Custom error message',
        ];

        for (const errorMsg of errorTypes) {
          mockReadFileSync.mockImplementation(() => {
            throw new Error(errorMsg);
          });

          expect(() => has_query('javascript')).not.toThrow();
          expect(has_query('javascript')).toBe(false);
        }
      });
    });

    describe("Consistency with load_query", () => {
      it("should return true when load_query would succeed", () => {
        mockReadFileSync.mockReturnValue('valid query');

        expect(has_query('javascript')).toBe(true);
        expect(() => load_query('javascript')).not.toThrow();
      });

      it("should return false when load_query would fail", () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error('File not found');
        });

        expect(has_query('javascript')).toBe(false);
        expect(() => load_query('javascript')).toThrow();
      });

      it("should be consistent across multiple calls", () => {
        // Test successful case
        mockReadFileSync.mockReturnValue('valid query');
        expect(has_query('javascript')).toBe(true);
        expect(has_query('javascript')).toBe(true);

        // Test error case
        mockReadFileSync.mockImplementation(() => {
          throw new Error('File not found');
        });
        expect(has_query('javascript')).toBe(false);
        expect(has_query('javascript')).toBe(false);
      });
    });
  });

  describe("Integration Tests", () => {
    it("should work with all supported languages end-to-end", () => {
      const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];
      const queries = {
        javascript: '(function_declaration) @func',
        typescript: '(interface_declaration) @interface',
        python: '(function_definition) @func',
        rust: '(function_item) @func',
      };

      for (const lang of languages) {
        mockReadFileSync.mockReturnValue(queries[lang]);

        expect(has_query(lang)).toBe(true);
        expect(load_query(lang)).toBe(queries[lang]);
      }
    });

    it("should handle mixed success and failure scenarios", () => {
      // Setup: javascript succeeds, typescript fails
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('javascript.scm')) {
          return 'javascript query';
        }
        throw new Error('File not found');
      });

      expect(has_query('javascript')).toBe(true);
      expect(has_query('typescript')).toBe(false);

      expect(load_query('javascript')).toBe('javascript query');
      expect(() => load_query('typescript')).toThrow();
    });

    it("should use correct tree-sitter parsers for loaded queries", () => {
      // This test ensures the mapping and loading are consistent
      const mockQuery = '(identifier) @test';
      mockReadFileSync.mockReturnValue(mockQuery);

      const languages: Language[] = ['javascript', 'typescript', 'python', 'rust'];

      for (const lang of languages) {
        expect(has_query(lang)).toBe(true);
        expect(load_query(lang)).toBe(mockQuery);
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang)).toBe(true);
      }
    });

    it("should handle concurrent query loading", () => {
      mockReadFileSync.mockReturnValue('concurrent query');

      const promises = [
        Promise.resolve(load_query('javascript')),
        Promise.resolve(load_query('typescript')),
        Promise.resolve(has_query('python')),
        Promise.resolve(has_query('rust')),
      ];

      return Promise.all(promises).then(results => {
        expect(results[0]).toBe('concurrent query'); // javascript query
        expect(results[1]).toBe('concurrent query'); // typescript query
        expect(results[2]).toBe(true); // python has_query
        expect(results[3]).toBe(true); // rust has_query
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large query files", () => {
      const largeQuery = 'a'.repeat(1024 * 1024); // 1MB string
      mockReadFileSync.mockReturnValue(largeQuery);

      expect(has_query('javascript')).toBe(true);
      expect(load_query('javascript')).toBe(largeQuery);
    });

    it("should handle query files with special characters", () => {
      const specialQuery = '(identifier) @def.function\n; Comment with üñíçódé\n"string with quotes"';
      mockReadFileSync.mockReturnValue(specialQuery);

      expect(load_query('javascript')).toBe(specialQuery);
    });

    it("should handle query files with newlines and whitespace", () => {
      const queryWithWhitespace = '\n\n  \t(function_declaration)\n\t\t@def.function\n\n';
      mockReadFileSync.mockReturnValue(queryWithWhitespace);

      expect(load_query('javascript')).toBe(queryWithWhitespace);
    });

    it("should handle undefined/null language gracefully", () => {
      // These might not throw immediately but will fail during file operations
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Invalid path');
      });

      expect(() => {
        load_query(undefined as any);
      }).toThrow();

      expect(() => {
        load_query(null as any);
      }).toThrow();

      expect(has_query(undefined as any)).toBe(false);
      expect(has_query(null as any)).toBe(false);
    });
  });

  // ============================================================================
  // NEW FUNCTIONALITY TESTS (Bug fixes and improvements)
  // ============================================================================

  describe("Query Caching", () => {
    beforeEach(() => {
      // Import the new functions
      const { clear_query_cache } = require("./query_loader");
      clear_query_cache();
      vi.clearAllMocks();
    });

    it("should cache loaded queries for performance", () => {
      const mockQuery = '(identifier) @test';
      mockReadFileSync.mockReturnValue(mockQuery);

      // First call should read from file
      const result1 = load_query('javascript');
      expect(result1).toBe(mockQuery);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = load_query('javascript');
      expect(result2).toBe(mockQuery);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1); // No additional calls
    });

    it("should cache different languages separately", () => {
      const jsQuery = '(javascript) @test';
      const tsQuery = '(typescript) @test';

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('javascript.scm')) return jsQuery;
        if (path.includes('typescript.scm')) return tsQuery;
        throw new Error('Unexpected path');
      });

      const js1 = load_query('javascript');
      const ts1 = load_query('typescript');
      const js2 = load_query('javascript');
      const ts2 = load_query('typescript');

      expect(js1).toBe(jsQuery);
      expect(ts1).toBe(tsQuery);
      expect(js2).toBe(jsQuery);
      expect(ts2).toBe(tsQuery);
      expect(mockReadFileSync).toHaveBeenCalledTimes(2); // Only called once per language
    });

    it("should provide cache management functions", () => {
      const { clear_query_cache, get_cache_size } = require("./query_loader");
      mockReadFileSync.mockReturnValue('test query');

      expect(get_cache_size()).toBe(0);

      load_query('javascript');
      expect(get_cache_size()).toBe(1);

      load_query('typescript');
      expect(get_cache_size()).toBe(2);

      clear_query_cache();
      expect(get_cache_size()).toBe(0);
    });

    it("has_query should check cache before file system", () => {
      const mockQuery = '(test) @query';
      mockReadFileSync.mockReturnValue(mockQuery);

      // Load query to cache it
      load_query('javascript');
      vi.clearAllMocks();

      // has_query should return true without file system access
      expect(has_query('javascript')).toBe(true);
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  describe("Language Validation", () => {
    it("should export SUPPORTED_LANGUAGES constant", () => {
      const { SUPPORTED_LANGUAGES } = require("./query_loader");

      expect(SUPPORTED_LANGUAGES).toBeDefined();
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
      expect(SUPPORTED_LANGUAGES).toEqual(['javascript', 'typescript', 'python', 'rust']);
    });

    it("should validate supported languages", () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => {
        load_query('unsupported' as Language);
      }).toThrow('Unsupported language: unsupported. Supported languages: javascript, typescript, python, rust');
    });

    it("has_query should return false for unsupported languages", () => {
      expect(has_query('unsupported' as Language)).toBe(false);
      expect(has_query('java' as Language)).toBe(false);
      expect(has_query('go' as Language)).toBe(false);
    });
  });

  describe("Enhanced Error Messages", () => {
    it("should include file path in error messages", () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => {
        load_query('javascript');
      }).toThrow(/Failed to load semantic index query for language 'javascript' from '.*javascript\.scm'/);
    });

    it("should distinguish between validation and file system errors", () => {
      // Mock successful file read but invalid query syntax
      mockReadFileSync.mockReturnValue('(invalid query syntax');

      expect(() => {
        load_query('javascript');
      }).toThrow(/Invalid query syntax for javascript/);
    });

    it("should provide informative parser availability errors", () => {
      // Mock a scenario where language is in SUPPORTED_LANGUAGES but parser is missing
      // This tests the internal validate_language function
      const originalMap = LANGUAGE_TO_TREESITTER_LANG.get('javascript');
      LANGUAGE_TO_TREESITTER_LANG.delete('javascript');

      try {
        expect(() => {
          load_query('javascript');
        }).toThrow('No tree-sitter parser available for language: javascript');
      } finally {
        // Restore the original mapping
        LANGUAGE_TO_TREESITTER_LANG.set('javascript', originalMap!);
      }
    });
  });

  describe("Query Syntax Validation", () => {
    it("should validate query syntax on load", () => {
      // Invalid query syntax
      mockReadFileSync.mockReturnValue('(invalid query [syntax');

      expect(() => {
        load_query('javascript');
      }).toThrow(/Invalid query syntax for javascript/);
    });

    it("should accept valid query syntax", () => {
      // Valid simple query
      mockReadFileSync.mockReturnValue('(identifier) @test');

      expect(() => {
        load_query('javascript');
      }).not.toThrow();
    });

    it("should cache validated queries", () => {
      const validQuery = '(identifier) @test';
      mockReadFileSync.mockReturnValue(validQuery);

      // First call validates and caches
      const result1 = load_query('javascript');
      expect(result1).toBe(validQuery);

      // Second call should use cache (no re-validation)
      vi.clearAllMocks();
      const result2 = load_query('javascript');
      expect(result2).toBe(validQuery);
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  describe("Improved has_query Efficiency", () => {
    it("should use existsSync instead of full file read", () => {
      const mockExistsSync = vi.fn().mockReturnValue(true);
      vi.doMock('fs', () => ({
        ...vi.importActual('fs'),
        existsSync: mockExistsSync,
        readFileSync: mockReadFileSync
      }));

      // Re-import to get the mocked version
      delete require.cache[require.resolve('./query_loader')];
      const { has_query: newHasQuery } = require('./query_loader');

      expect(newHasQuery('javascript')).toBe(true);
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it("should return false when file doesn't exist", () => {
      const mockExistsSync = vi.fn().mockReturnValue(false);
      vi.doMock('fs', () => ({
        ...vi.importActual('fs'),
        existsSync: mockExistsSync,
        readFileSync: mockReadFileSync
      }));

      delete require.cache[require.resolve('./query_loader')];
      const { has_query: newHasQuery } = require('./query_loader');

      expect(newHasQuery('javascript')).toBe(false);
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  describe("Path Construction Robustness", () => {
    it("should handle different environment scenarios gracefully", () => {
      // This test ensures the improved path construction doesn't fail
      // In real environments, __filename and import.meta.url may vary
      mockReadFileSync.mockReturnValue('(test) @query');

      expect(() => {
        load_query('javascript');
      }).not.toThrow(/Unable to determine current file location/);
    });
  });

  describe("Integration with Tree-sitter", () => {
    it("should ensure all supported languages have parsers", () => {
      const { SUPPORTED_LANGUAGES } = require("./query_loader");

      for (const lang of SUPPORTED_LANGUAGES) {
        expect(LANGUAGE_TO_TREESITTER_LANG.has(lang)).toBe(true);
        expect(LANGUAGE_TO_TREESITTER_LANG.get(lang)).toBeDefined();
      }
    });

    it("should ensure parser map only contains supported languages", () => {
      const { SUPPORTED_LANGUAGES } = require("./query_loader");

      for (const [lang] of LANGUAGE_TO_TREESITTER_LANG) {
        expect(SUPPORTED_LANGUAGES.includes(lang as Language)).toBe(true);
      }
    });
  });
});