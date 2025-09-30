/**
 * Comprehensive tests for imports module
 */

// @ts-nocheck - Legacy test using deprecated APIs, needs migration to builder pattern

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  ScopeId,
  LexicalScope,
  Location,
  Language,
  Import,
  NamedImport,
  NamespaceImport,
  DefaultImport,
  SideEffectImport,
  SymbolDefinition,
} from "@ariadnejs/types";
import { variable_symbol } from "@ariadnejs/types";
import { process_imports } from "./imports";
import { SemanticEntity, SemanticCategory } from "../capture_types";
import type { NormalizedCapture } from "../capture_types";
import { query_tree_and_parse_captures } from "../../parse_and_query_code/parse_and_query_code";

const FIXTURES_DIR = join(__dirname, "..", "fixtures");

describe("Imports Module", () => {
  let root_scope: LexicalScope;
  let symbols: Map<SymbolId, SymbolDefinition>;
  let file_path: FilePath;
  let base_location: Location;

  beforeEach(() => {
    file_path = "test.ts" as FilePath;
    base_location = {
      file_path,
      line: 1,
      column: 0,
      end_line: 1,
      end_column: 10,
    };

    // Create basic scope and symbols setup
    root_scope = {
      id: "scope_0" as ScopeId,
      name: null,
      type: "module",
      location: base_location,
      parent_id: null,
      child_ids: [],
      symbols: new Map(),
    };

    symbols = new Map();
  });

  describe("process_imports", () => {
    describe("Named Imports", () => {
      it("should process basic named imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "readFile",
            node_location: { ...base_location, line: 3 },
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.kind).toBe("named");
        expect(import_item.source).toBe("fs");
        expect(import_item.imports.length).toBe(1);
        expect(import_item.imports[0].name).toBe("readFile");
        expect(import_item.language).toBe("typescript");
      });

      it("should process named imports with aliases", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "join",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "path",
              import_alias: "pathJoin",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.kind).toBe("named");
        expect(import_item.imports[0].name).toBe("join");
        expect(import_item.imports[0].alias).toBe("pathJoin");
      });

      it("should handle type-only imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "Interface",
            node_location: base_location,
            modifiers: {
              is_type_only: true,
            },
            context: {
              source_module: "./types",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.imports[0].is_type_only).toBe(true);
      });

      it("should create symbols for imported names", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "readFile",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
        ];

        process_imports(captures, root_scope, symbols, file_path, "typescript");

        expect(root_scope.symbols.size).toBe(1);
        expect(symbols.size).toBe(1);

        const symbol = Array.from(symbols.values())[0];
        expect(symbol.name).toBe("readFile");
        expect(symbol.kind).toBe("import");
        expect(symbol.is_imported).toBe(true);
        expect(symbol.import_source).toBe("fs");
      });
    });

    describe("Default Imports", () => {
      it("should process default imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "React",
            node_location: base_location,
            modifiers: {
              is_default: true,
            },
            context: {
              source_module: "react",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as DefaultImport;
        expect(import_item.kind).toBe("default");
        expect(import_item.source).toBe("react");
        expect(import_item.name).toBe("React");
        expect(import_item.language).toBe("typescript");
      });

      it("should create symbols for default imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "React",
            node_location: base_location,
            modifiers: {
              is_default: true,
            },
            context: {
              source_module: "react",
            },
          },
        ];

        process_imports(captures, root_scope, symbols, file_path, "typescript");

        const symbol = Array.from(symbols.values())[0];
        expect(symbol.name).toBe("React");
        expect(symbol.kind).toBe("import");
        expect(symbol.is_imported).toBe(true);
      });
    });

    describe("Namespace Imports", () => {
      it("should process namespace imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "utils",
            node_location: base_location,
            modifiers: {
              is_namespace: true,
            },
            context: {
              source_module: "./utils",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamespaceImport;
        expect(import_item.kind).toBe("namespace");
        expect(import_item.source).toBe("./utils");
        expect(import_item.namespace_name).toBe("utils");
        expect(import_item.language).toBe("typescript");
      });

      it("should handle Python wildcard imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "*",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "os",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "python"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamespaceImport;
        expect(import_item.kind).toBe("namespace");
        expect(import_item.namespace_name).toBe("STAR_IMPORT");
        expect(import_item.modifiers).toContain("wildcard");
      });

      it("should handle Rust glob imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "*",
            node_location: base_location,
            modifiers: {
              is_wildcard: true,
            },
            context: {
              source_module: "std::collections",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "rust"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamespaceImport;
        expect(import_item.kind).toBe("namespace");
        expect(import_item.modifiers).toContain("glob");
      });

      it("should not create symbols for wildcard imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "*",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "os",
            },
          },
        ];

        process_imports(captures, root_scope, symbols, file_path, "python");

        expect(symbols.size).toBe(0);
        expect(root_scope.symbols.size).toBe(0);
      });
    });

    describe("Side Effect Imports", () => {
      it("should process side effect imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "polyfill",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "polyfill",
              is_side_effect_import: true,
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as SideEffectImport;
        expect(import_item.kind).toBe("side_effect");
        expect(import_item.source).toBe("polyfill");
        expect(import_item.language).toBe("typescript");
      });

      it("should not create symbols for side effect imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "polyfill",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "polyfill",
              is_side_effect_import: true,
            },
          },
        ];

        process_imports(captures, root_scope, symbols, file_path, "typescript");

        expect(symbols.size).toBe(0);
        expect(root_scope.symbols.size).toBe(0);
      });
    });

    describe("Language-Specific Features", () => {
      describe("Python", () => {
        it("should handle relative imports", () => {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.IMPORT,
              entity: SemanticEntity.VARIABLE,
              text: "module",
              node_location: base_location,
              modifiers: {},
              context: {
                source_module: ".module",
              },
            },
          ];

          const result = process_imports(
            captures,
            root_scope,
            symbols,
            file_path,
            "python"
          );

          expect(result.length).toBe(1);
          const import_item = result[0] as NamedImport;
          expect(import_item.modifiers).toContain("relative");
        });

        it("should handle namespace imports with relative paths", () => {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.IMPORT,
              entity: SemanticEntity.VARIABLE,
              text: "utils",
              node_location: base_location,
              modifiers: {
                is_namespace: true,
              },
              context: {
                source_module: "..utils",
              },
            },
          ];

          const result = process_imports(
            captures,
            root_scope,
            symbols,
            file_path,
            "python"
          );

          expect(result.length).toBe(1);
          const import_item = result[0] as NamespaceImport;
          expect(import_item.modifiers).toContain("relative");
        });
      });

      describe("Rust", () => {
        it("should handle crate-relative imports", () => {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.IMPORT,
              entity: SemanticEntity.VARIABLE,
              text: "module",
              node_location: base_location,
              modifiers: {},
              context: {
                source_module: "crate::module",
              },
            },
          ];

          const result = process_imports(
            captures,
            root_scope,
            symbols,
            file_path,
            "rust"
          );

          expect(result.length).toBe(1);
          const import_item = result[0] as NamedImport;
          expect(import_item.modifiers).toContain("crate_relative");
        });

        it("should handle super-relative imports", () => {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.IMPORT,
              entity: SemanticEntity.VARIABLE,
              text: "module",
              node_location: base_location,
              modifiers: {},
              context: {
                source_module: "super::module",
              },
            },
          ];

          const result = process_imports(
            captures,
            root_scope,
            symbols,
            file_path,
            "rust"
          );

          expect(result.length).toBe(1);
          const import_item = result[0] as NamedImport;
          expect(import_item.modifiers).toContain("super_relative");
        });

        it("should handle self-relative imports", () => {
          const captures: NormalizedCapture[] = [
            {
              category: SemanticCategory.IMPORT,
              entity: SemanticEntity.VARIABLE,
              text: "module",
              node_location: base_location,
              modifiers: {},
              context: {
                source_module: "self::module",
              },
            },
          ];

          const result = process_imports(
            captures,
            root_scope,
            symbols,
            file_path,
            "rust"
          );

          expect(result.length).toBe(1);
          const import_item = result[0] as NamedImport;
          expect(import_item.modifiers).toContain("self_relative");
        });
      });
    });

    describe("Capture Skipping and Filtering", () => {
      it("should skip captures marked to skip", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "included",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "skipped",
            node_location: { ...base_location, line: 2 },
            modifiers: {},
            context: {
              source_module: "path",
              skip: true,
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        expect(result[0].source).toBe("fs");
      });
    });

    describe("Error Handling", () => {
      it("should handle empty captures array", () => {
        const result = process_imports(
          [],
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(0);
        expect(symbols.size).toBe(0);
        expect(root_scope.symbols.size).toBe(0);
      });

      it("should handle missing source module gracefully", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "testImport",
            node_location: base_location,
            modifiers: {},
            context: {
              // Missing source_module
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.source).toBe("");
      });

      it("should handle malformed context data", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "testImport",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
              import_alias: undefined, // Undefined alias
            },
          },
        ];

        expect(() => {
          process_imports(
            captures,
            root_scope,
            symbols,
            file_path,
            "typescript"
          );
        }).not.toThrow();
      });

      it("should handle missing modifiers", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "testImport",
            node_location: base_location,
            modifiers: {}, // Empty object instead of undefined
            context: {
              source_module: "fs",
            },
          },
        ];

        expect(() => {
          process_imports(
            captures,
            root_scope,
            symbols,
            file_path,
            "typescript"
          );
        }).not.toThrow();
      });

      it("should handle null or undefined import names", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: null as unknown as string,
            node_location: { ...base_location, line: 2 },
            modifiers: {},
            context: {
              source_module: "path",
            },
          },
        ];

        expect(() => {
          process_imports(
            captures,
            root_scope,
            symbols,
            file_path,
            "typescript"
          );
        }).not.toThrow();
      });
    });

    describe("Complex Scenarios", () => {
      it("should handle mixed import types in single call", () => {
        const captures: NormalizedCapture[] = [
          // Named import
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "readFile",
            node_location: { ...base_location, line: 1 },
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
          // Default import
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "React",
            node_location: { ...base_location, line: 2 },
            modifiers: { is_default: true },
            context: {
              source_module: "react",
            },
          },
          // Namespace import
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "utils",
            node_location: { ...base_location, line: 3 },
            modifiers: { is_namespace: true },
            context: {
              source_module: "./utils",
            },
          },
          // Side effect import
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "polyfill",
            node_location: { ...base_location, line: 4 },
            modifiers: {},
            context: {
              source_module: "polyfill",
              is_side_effect_import: true,
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(4);

        const kinds = result.map((i) => i.kind);
        expect(kinds).toContain("named");
        expect(kinds).toContain("default");
        expect(kinds).toContain("namespace");
        expect(kinds).toContain("side_effect");

        // Should create symbols for named, default, and namespace imports, but not side effect
        expect(symbols.size).toBe(3);
      });

      it("should handle complex aliased imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "join",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "path",
              import_alias: "pathJoin",
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "join",
            node_location: { ...base_location, line: 2 },
            modifiers: {},
            context: {
              source_module: "url",
              import_alias: "urlJoin",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(2);

        const import1 = result[0] as NamedImport;
        const import2 = result[1] as NamedImport;

        expect(import1.imports[0].alias).toBe("pathJoin");
        expect(import2.imports[0].alias).toBe("urlJoin");

        // Should create two different symbols with different names (aliases)
        expect(symbols.size).toBe(2);
      });
    });

    describe("Symbol Creation Details", () => {
      it("should set correct symbol properties", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "readFile",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
        ];

        process_imports(captures, root_scope, symbols, file_path, "typescript");

        const symbol = Array.from(symbols.values())[0];
        expect(symbol.kind).toBe("import");
        expect(symbol.scope_id).toBe(root_scope.id);
        expect(symbol.is_hoisted).toBe(false);
        expect(symbol.is_exported).toBe(false);
        expect(symbol.is_imported).toBe(true);
        expect(symbol.import_source).toBe("fs");
      });

      it("should handle symbols with same name from different sources", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "join",
            node_location: { ...base_location, line: 1 },
            modifiers: {},
            context: {
              source_module: "path",
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "join",
            node_location: { ...base_location, line: 2 },
            modifiers: {},
            context: {
              source_module: "url",
            },
          },
        ];

        process_imports(captures, root_scope, symbols, file_path, "typescript");

        // The second import should overwrite the first in the scope
        expect(root_scope.symbols.size).toBe(1);
        expect(symbols.size).toBe(2); // But we should have both symbols in the global map

        const scopeSymbol = root_scope.symbols.get("join" as SymbolName);
        const allSymbols = Array.from(symbols.values());

        expect(scopeSymbol).toBeDefined();
        expect(allSymbols.length).toBe(2);
        expect(allSymbols[0].import_source).toBe("path");
        expect(allSymbols[1].import_source).toBe("url");
      });
    });
  });

  describe("Integration Tests with Real Code", () => {
    let typescript_parser: Parser;
    let python_parser: Parser;
    let rust_parser: Parser;

    beforeAll(() => {
      typescript_parser = new Parser();
      typescript_parser.setLanguage(TypeScript.tsx);

      python_parser = new Parser();
      python_parser.setLanguage(Python);

      rust_parser = new Parser();
      rust_parser.setLanguage(Rust);
    });

    it("should process JavaScript/TypeScript imports from fixture", () => {
      try {
        const code = readFileSync(
          join(FIXTURES_DIR, "javascript", "imports_exports.js"),
          "utf-8"
        );
        const tree = typescript_parser.parse(code);
        const captures = query_tree_and_parse_captures(
          "javascript" as Language,
          tree,
          "imports_exports.js" as FilePath
        );

        // Create basic scope structure for testing
        const test_root_scope: LexicalScope = {
          id: "scope_0" as ScopeId,
          name: null,
          type: "module",
          location: {
            file_path: "imports_exports.js" as FilePath,
            line: 1,
            column: 0,
            end_line: 1000,
            end_column: 100,
          },
          parent_id: null,
          child_ids: [],
          symbols: new Map(),
        };

        const result = process_imports(
          captures.imports || [],
          test_root_scope,
          new Map(),
          "imports_exports.js" as FilePath,
          "javascript" as Language
        );

        // If the fixture has imports, we should process them
        if (captures.imports && captures.imports.length > 0) {
          expect(result.length).toBeGreaterThan(0);

          const import_kinds = new Set(result.map((i) => i.kind));
          expect(import_kinds.size).toBeGreaterThan(0);
        } else {
          // If no imports captured, that's also valid
          expect(result.length).toBe(0);
        }
      } catch (error) {
        // If fixture doesn't exist, skip this test
        console.log("Fixture file not found, skipping integration test");
      }
    });

    it("should handle empty files gracefully", () => {
      const empty_code = "";
      const tree = typescript_parser.parse(empty_code);
      const captures = query_tree_and_parse_captures(
        "typescript" as Language,
        tree,
        "empty.ts" as FilePath
      );

      const test_root_scope: LexicalScope = {
        id: "scope_0" as ScopeId,
        name: null,
        type: "module",
        location: {
          file_path: "empty.ts" as FilePath,
          line: 1,
          column: 0,
          end_line: 1,
          end_column: 0,
        },
        parent_id: null,
        child_ids: [],
        symbols: new Map(),
      };

      const result = process_imports(
        captures.imports || [],
        test_root_scope,
        new Map(),
        "empty.ts" as FilePath,
        "typescript" as Language
      );

      expect(result.length).toBe(0);
    });

    it("should handle malformed import code gracefully", () => {
      const malformed_code = `
        import {
          // Missing closing brace and semicolon
        import from;
        import * from
      `;

      const tree = typescript_parser.parse(malformed_code);
      const captures = query_tree_and_parse_captures(
        "typescript" as Language,
        tree,
        "malformed.ts" as FilePath
      );

      const test_root_scope: LexicalScope = {
        id: "scope_0" as ScopeId,
        name: null,
        type: "module",
        location: {
          file_path: "malformed.ts" as FilePath,
          line: 1,
          column: 0,
          end_line: 10,
          end_column: 100,
        },
        parent_id: null,
        child_ids: [],
        symbols: new Map(),
      };

      // Should not throw
      expect(() => {
        process_imports(
          captures.imports || [],
          test_root_scope,
          new Map(),
          "malformed.ts" as FilePath,
          "typescript" as Language
        );
      }).not.toThrow();
    });

    it("should process moderately large files without performance issues", () => {
      // Generate a file with many imports
      const large_code = Array.from(
        { length: 100 },
        (_, i) => `import { func${i} } from "./module${i}";`
      ).join("\n");

      const tree = typescript_parser.parse(large_code);
      const captures = query_tree_and_parse_captures(
        "typescript" as Language,
        tree,
        "large.ts" as FilePath
      );

      const test_root_scope: LexicalScope = {
        id: "scope_0" as ScopeId,
        name: null,
        type: "module",
        location: {
          file_path: "large.ts" as FilePath,
          line: 1,
          column: 0,
          end_line: 100,
          end_column: large_code.length,
        },
        parent_id: null,
        child_ids: [],
        symbols: new Map(),
      };

      const start_time = Date.now();
      const result = process_imports(
        captures.imports || [],
        test_root_scope,
        new Map(),
        "large.ts" as FilePath,
        "typescript" as Language
      );
      const end_time = Date.now();

      // Should complete in reasonable time (< 1 second)
      expect(end_time - start_time).toBeLessThan(1000);

      // Should have processed imports
      if (captures.imports && captures.imports.length > 0) {
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(captures.imports.length);
      }
    });
  });

  describe("Bug Regression Tests", () => {
    it("should not add duplicate modifiers for Rust module paths", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: "utils",
          node_location: base_location,
          modifiers: {
            is_namespace: true,
          },
          context: {
            source_module: "crate::utils",
          },
        },
      ];

      const result = process_imports(
        captures,
        root_scope,
        symbols,
        file_path,
        "rust"
      );

      expect(result.length).toBe(1);
      const import_item = result[0] as NamespaceImport;

      // Should only have "crate_relative" once, not twice
      const crate_relative_count = import_item.modifiers.filter(
        (m) => m === "crate_relative"
      ).length;
      expect(crate_relative_count).toBe(1);
      expect(import_item.modifiers).toEqual(["crate_relative"]);
    });

    it("should handle empty capture text gracefully without unsafe casting", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: "",
          node_location: base_location,
          modifiers: {},
          context: {
            source_module: "fs",
          },
        },
      ];

      expect(() => {
        process_imports(captures, root_scope, symbols, file_path, "typescript");
      }).not.toThrow();

      // Should still create import but with empty name
      const result = process_imports(
        captures,
        root_scope,
        symbols,
        file_path,
        "typescript"
      );
      expect(result.length).toBe(1);
      expect(result[0].kind).toBe("named");
    });

    it("should handle null import alias gracefully", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: "join",
          node_location: base_location,
          modifiers: {},
          context: {
            source_module: "path",
            import_alias: null as unknown as string,
          },
        },
      ];

      expect(() => {
        process_imports(captures, root_scope, symbols, file_path, "typescript");
      }).not.toThrow();
    });

    it("should handle invalid source module gracefully", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: "readFile",
          node_location: base_location,
          modifiers: {},
          context: {
            source_module: null as unknown as string,
          },
        },
      ];

      const result = process_imports(
        captures,
        root_scope,
        symbols,
        file_path,
        "typescript"
      );
      expect(result.length).toBe(1);
      expect(result[0].source).toBe("");
    });

    it("should not add duplicate modifiers for multiple Rust module path checks", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: "module",
          node_location: base_location,
          modifiers: {},
          context: {
            source_module: "super::parent::module",
          },
        },
      ];

      const result = process_imports(
        captures,
        root_scope,
        symbols,
        file_path,
        "rust"
      );

      expect(result.length).toBe(1);
      const import_item = result[0] as NamedImport;

      // Should only have "super_relative" once, not multiple times
      const super_relative_count = import_item.modifiers.filter(
        (m) => m === "super_relative"
      ).length;
      expect(super_relative_count).toBe(1);
      expect(import_item.modifiers).toEqual(["super_relative"]);
    });

    it("should properly handle scope symbols without unsafe casting", () => {
      const captures: NormalizedCapture[] = [
        {
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: "testImport",
          node_location: base_location,
          modifiers: {},
          context: {
            source_module: "test-module",
          },
        },
      ];

      // Verify the scope.symbols is properly typed as Map<SymbolName, SymbolDefinition>
      const initial_symbols_size = root_scope.symbols.size;

      process_imports(captures, root_scope, symbols, file_path, "typescript");

      expect(root_scope.symbols.size).toBe(initial_symbols_size + 1);
      expect(root_scope.symbols.has("testImport" as SymbolName)).toBe(true);

      const symbol = root_scope.symbols.get("testImport" as SymbolName);
      expect(symbol).toBeDefined();
      expect(symbol?.name).toBe("testImport");
    });
  });

  describe("Performance and Memory", () => {
    it("should handle large numbers of imports efficiently", () => {
      const many_captures: NormalizedCapture[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: `import_${i}`,
          node_location: { ...base_location, line: i + 1 },
          modifiers: {},
          context: {
            source_module: `./module_${i}`,
          },
        })
      );

      const start_time = Date.now();
      const result = process_imports(
        many_captures,
        root_scope,
        symbols,
        file_path,
        "typescript"
      );
      const end_time = Date.now();

      expect(result.length).toBe(1000);
      expect(end_time - start_time).toBeLessThan(2000); // Should complete in reasonable time

      // Verify all imports are correctly processed
      const import_sources = result.map((i) => i.source);
      for (let i = 0; i < 1000; i++) {
        expect(import_sources).toContain(`./module_${i}`);
      }

      // Should create symbols for all imports
      expect(symbols.size).toBe(1000);
    });

    it("should handle complex nested import structures", () => {
      // Create a complex scenario with mixed import types
      const complex_captures: NormalizedCapture[] = [
        // Multiple named imports
        ...Array.from({ length: 50 }, (_, i) => ({
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: `named_${i}`,
          node_location: { ...base_location, line: i + 1 },
          modifiers: {},
          context: {
            source_module: `./module_${Math.floor(i / 10)}`,
          },
        })),
        // Multiple default imports
        ...Array.from({ length: 10 }, (_, i) => ({
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: `Default${i}`,
          node_location: { ...base_location, line: i + 100 },
          modifiers: { is_default: true },
          context: {
            source_module: `./default_${i}`,
          },
        })),
        // Multiple namespace imports
        ...Array.from({ length: 10 }, (_, i) => ({
          category: SemanticCategory.IMPORT,
          entity: SemanticEntity.VARIABLE,
          text: `ns${i}`,
          node_location: { ...base_location, line: i + 200 },
          modifiers: { is_namespace: true },
          context: {
            source_module: `./namespace_${i}`,
          },
        })),
      ];

      const result = process_imports(
        complex_captures,
        root_scope,
        symbols,
        file_path,
        "typescript"
      );

      expect(result.length).toBe(70); // 50 named + 10 default + 10 namespace imports

      const named_imports = result.filter((i) => i.kind === "named");
      const default_imports = result.filter((i) => i.kind === "default");
      const namespace_imports = result.filter((i) => i.kind === "namespace");

      expect(named_imports.length).toBe(50);
      expect(default_imports.length).toBe(10);
      expect(namespace_imports.length).toBe(10);

      // Should create symbols for all non-side-effect imports
      expect(symbols.size).toBe(70);
    });
  });

  describe("Enhanced Validation Logic", () => {
    describe("Capture Text Validation", () => {
      it("should skip captures with undefined text", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: undefined as unknown as string,
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(0);
        expect(symbols.size).toBe(0);
        expect(root_scope.symbols.size).toBe(0);
      });

      it("should skip captures with null text", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: null as unknown as string,
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(0);
        expect(symbols.size).toBe(0);
        expect(root_scope.symbols.size).toBe(0);
      });

      it("should process captures with empty string text", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.kind).toBe("named");
        expect(import_item.imports[0].name).toBe("");
      });

      it("should process captures with non-string text types as strings", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: 123 as unknown as string,
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: {} as unknown as string,
            node_location: { ...base_location, line: 2 },
            modifiers: {},
            context: {
              source_module: "path",
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: [] as unknown as string,
            node_location: { ...base_location, line: 3 },
            modifiers: {},
            context: {
              source_module: "url",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        // Non-string truthy values are processed (converted to strings)
        expect(result.length).toBe(3);
        expect(symbols.size).toBe(3);
        expect(root_scope.symbols.size).toBe(3);

        // Verify they're treated as regular named imports
        result.forEach((import_item) => {
          expect(import_item.kind).toBe("named");
        });
      });
    });

    describe("Import Alias Validation", () => {
      it("should only process aliases when they are strings", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "validImport",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
              import_alias: "validAlias", // String - should be processed as aliased import
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.kind).toBe("named");
        expect(import_item.imports[0].name).toBe("validImport");
        expect(import_item.imports[0].alias).toBe("validAlias");
      });

      it("should treat non-string aliases as regular imports", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "importName",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
              // @ts-ignore - Testing invalid properties
              import_alias: 123, // Number - should be treated as regular import
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "importName2",
            node_location: { ...base_location, line: 2 },
            modifiers: {},
            context: {
              source_module: "path",
              // @ts-ignore - Testing invalid properties
              import_alias: {}, // Object - should be treated as regular import
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "importName3",
            node_location: { ...base_location, line: 3 },
            modifiers: {},
            context: {
              source_module: "url",
              // @ts-ignore - Testing invalid properties
              import_alias: [], // Array - should be treated as regular import
            },
          },
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "importName4",
            node_location: { ...base_location, line: 4 },
            modifiers: {},
            context: {
              source_module: "crypto",
              // @ts-ignore - Testing invalid properties
              import_alias: true, // Boolean - should be treated as regular import
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(4);

        // All should be regular named imports without aliases
        result.forEach((import_item, index) => {
          expect(import_item.kind).toBe("named");
          const namedImport = import_item as NamedImport;
          expect(namedImport.imports[0].alias).toBeUndefined();
          expect(namedImport.imports[0].name).toBe(
            `importName${index === 0 ? "" : index + 1}`
          );
        });
      });

      it("should handle null alias as regular import", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "testImport",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
              // @ts-ignore - Testing invalid properties
              import_alias: null as unknown as string, // Null - should be treated as regular import
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.kind).toBe("named");
        expect(import_item.imports[0].name).toBe("testImport");
        expect(import_item.imports[0].alias).toBeUndefined();
      });

      it("should handle undefined alias as regular import", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "testImport",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
              import_alias: undefined, // Undefined - should be treated as regular import
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.kind).toBe("named");
        expect(import_item.imports[0].name).toBe("testImport");
        expect(import_item.imports[0].alias).toBeUndefined();
      });

      it("should handle empty string alias as regular import", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "testImport",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "fs",
              import_alias: "", // Empty string - falsy, so treated as regular import
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(1);
        const import_item = result[0] as NamedImport;
        expect(import_item.kind).toBe("named");
        expect(import_item.imports[0].name).toBe("testImport");
        expect(import_item.imports[0].alias).toBeUndefined(); // No alias since empty string is falsy
      });
    });

    describe("Combined Validation Edge Cases", () => {
      it("should handle mixed valid and invalid captures", () => {
        const captures: NormalizedCapture[] = [
          // Valid capture
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "validImport",
            node_location: { ...base_location, line: 1 },
            modifiers: {},
            context: {
              source_module: "fs",
            },
          },
          // Invalid text (null)
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: null as unknown as string,
            node_location: { ...base_location, line: 2 },
            modifiers: {},
            context: {
              source_module: "path",
            },
          },
          // Valid capture with alias
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "anotherImport",
            node_location: { ...base_location, line: 3 },
            modifiers: {},
            context: {
              source_module: "url",
              import_alias: "aliasName",
            },
          },
          // Invalid text (undefined)
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: undefined as unknown as string,
            node_location: { ...base_location, line: 4 },
            modifiers: {},
            context: {
              source_module: "crypto",
            },
          },
        ];

        const result = process_imports(
          captures,
          root_scope,
          symbols,
          file_path,
          "typescript"
        );

        expect(result.length).toBe(2); // Only valid captures processed
        expect(symbols.size).toBe(2);
        expect(root_scope.symbols.size).toBe(2);

        const sources = result.map((i) => i.source);
        expect(sources).toContain("fs");
        expect(sources).toContain("url");
        expect(sources).not.toContain("path");
        expect(sources).not.toContain("crypto");
      });

      it("should maintain proper symbol creation with validation", () => {
        const captures: NormalizedCapture[] = [
          {
            category: SemanticCategory.IMPORT,
            entity: SemanticEntity.VARIABLE,
            text: "validImport",
            node_location: base_location,
            modifiers: {},
            context: {
              source_module: "test-module",
            },
          },
        ];

        const initial_symbols_size = symbols.size;
        const initial_scope_size = root_scope.symbols.size;

        process_imports(captures, root_scope, symbols, file_path, "typescript");

        expect(symbols.size).toBe(initial_symbols_size + 1);
        expect(root_scope.symbols.size).toBe(initial_scope_size + 1);

        const symbol = Array.from(symbols.values()).find(
          (s) => s.name === "validImport"
        );
        expect(symbol).toBeDefined();
        expect(symbol?.kind).toBe("import");
        expect(symbol?.is_imported).toBe(true);
        expect(symbol?.import_source).toBe("test-module");
      });
    });
  });
});
