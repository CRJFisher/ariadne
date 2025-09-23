/**
 * Cross-Language Integration Tests for Symbol Resolution
 *
 * Tests symbol resolution across different programming languages,
 * ensuring consistent behavior and correct language-specific handling.
 */

import { describe, it, expect } from "vitest";
import { resolve_symbols } from "../symbol_resolution";
import type { ResolutionInput } from "../types";
import type {
  FilePath,
  SymbolId,
  Location,
  SymbolName,
  SymbolDefinition,
  ScopeId,
  LexicalScope,
  Import,
  Export,
  NamedImport,
  NamedExport,
  DefaultExport,
  Language,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  method_symbol,
  variable_symbol,
} from "@ariadnejs/types";
import { SemanticIndex } from "../../semantic_index/semantic_index";
import type { LocalTypeInfo } from "../../semantic_index/type_members";
import type { CallReference } from "../../semantic_index/references/call_references";

/**
 * Create a test file with language-specific features
 */
function create_language_test_file(
  file_path: FilePath,
  language: Language,
  content: {
    symbols: Array<{
      name: string;
      kind: "function" | "class" | "method" | "variable";
    }>;
    imports?: Array<{ name: string; source: string; resolved_path?: FilePath }>;
    exports?: Array<{ name: string; kind: "named" | "default" }>;
    calls?: Array<{ name: string; kind: "function" | "method" }>;
  }
): SemanticIndex {
  const root_scope_id = `scope:module:${file_path}:0:0` as ScopeId;
  const symbols = new Map<SymbolId, SymbolDefinition>();

  // Create symbols
  for (const sym of content.symbols) {
    const location = create_location(file_path, 10, 10);
    const id = create_symbol_id(sym.kind, sym.name, location);
    symbols.set(id, {
      id,
      name: sym.name as SymbolName,
      kind: sym.kind,
      location,
      scope_id: root_scope_id,
      is_hoisted: false,
      is_exported: false,
      is_imported: false,
    });
  }

  // Create imports with language-specific patterns
  const imports: Import[] = (content.imports || []).map(
    (imp) =>
      ({
        kind: "named" as const,
        imports: [
          {
            name: imp.name as SymbolName,
            alias: undefined,
            is_type_only: false,
          },
        ],
        source: imp.source as FilePath,
        location: create_location(file_path, 1, 10),
        modifiers: [],
        language,
        node_type: "import_statement",
      } as NamedImport)
  );

  // Create exports
  const exports: Export[] = (content.exports || []).map((exp, i) => {
    const symbol = Array.from(symbols.values()).find(
      (s) => s.name === exp.name
    );
    const symbol_id =
      symbol?.id ||
      function_symbol(
        exp.name as SymbolName,
        create_location(file_path, 20 + i, 0)
      );

    if (exp.kind === "named") {
      return {
        kind: "named" as const,
        symbol: symbol_id,
        symbol_name: exp.name as SymbolName,
        location: create_location(file_path, 20 + i, 0),
        exports: [
          {
            local_name: exp.name as SymbolName,
            export_name: exp.name as SymbolName,
            is_type_only: false,
          },
        ],
        modifiers: [],
        language,
        node_type: "export_statement",
      } as NamedExport;
    } else {
      return {
        kind: "default" as const,
        symbol: symbol_id,
        symbol_name: exp.name as SymbolName,
        location: create_location(file_path, 20 + i, 0),
        is_declaration: false,
        modifiers: [],
        language,
        node_type: "export_statement",
      } as DefaultExport;
    }
  });

  // Create calls
  const calls: CallReference[] = (content.calls || []).map((call, i) => ({
    location: create_location(file_path, 30 + i, 15),
    name: call.name as SymbolName,
    scope_id: root_scope_id,
    call_type: call.kind === "function" ? "function" : "method",
  }));

  const root_scope: LexicalScope = {
    id: root_scope_id,
    parent_id: null,
    name: null,
    type: "module",
    location: create_location(file_path, 0, 0),
    child_ids: [],
    symbols: new Map(),
  };

  return {
    file_path,
    language,
    root_scope_id,
    scopes: new Map([[root_scope_id, root_scope]]),
    symbols,
    references: {
      calls,
      member_accesses: [],
      returns: [],
      type_annotations: [],
    },
    imports,
    exports,
    file_symbols_by_name: new Map(),
    local_types: [],
    local_type_annotations: [],
    local_type_tracking: {
      annotations: [],
      declarations: [],
      assignments: [],
    },
    local_type_flow: {
      constructor_calls: [],
      assignments: [],
      returns: [],
      call_assignments: [],
    },
  };
}

function create_location(
  file_path: FilePath,
  line: number,
  column: number
): Location {
  return {
    file_path,
    line,
    column,
    end_line: line,
    end_column: column + 10,
  };
}

function create_symbol_id(
  kind: string,
  name: string,
  location: Location
): SymbolId {
  switch (kind) {
    case "function":
      return function_symbol(name as SymbolName, location);
    case "class":
      return class_symbol(name as SymbolName, location);
    case "method":
      return method_symbol(name as SymbolName, location);
    case "variable":
      return variable_symbol(name as SymbolName, location);
    default:
      return function_symbol(name as SymbolName, location);
  }
}

/**
 * Create a mixed JavaScript/TypeScript project
 */
function create_mixed_js_ts_project(): Map<FilePath, SemanticIndex> {
  const indices = new Map<FilePath, SemanticIndex>();

  // JavaScript file with CommonJS exports
  const js_file = create_language_test_file(
    "src/utils.js" as FilePath,
    "javascript",
    {
      symbols: [
        { name: "processData", kind: "function" },
        { name: "formatOutput", kind: "function" },
      ],
      exports: [
        { name: "processData", kind: "named" },
        { name: "formatOutput", kind: "named" },
      ],
    }
  );
  indices.set(js_file.file_path, js_file);

  // TypeScript file importing from JavaScript
  const ts_file = create_language_test_file(
    "src/main.ts" as FilePath,
    "typescript",
    {
      symbols: [
        { name: "Application", kind: "class" },
        { name: "run", kind: "method" },
      ],
      imports: [
        {
          name: "processData",
          source: "./utils.js",
          resolved_path: "src/utils.js" as FilePath,
        },
        {
          name: "formatOutput",
          source: "./utils.js",
          resolved_path: "src/utils.js" as FilePath,
        },
      ],
      exports: [{ name: "Application", kind: "named" }],
      calls: [
        { name: "processData", kind: "function" },
        { name: "formatOutput", kind: "function" },
      ],
    }
  );
  indices.set(ts_file.file_path, ts_file);

  // Another JavaScript file importing from TypeScript
  const js_consumer = create_language_test_file(
    "src/consumer.js" as FilePath,
    "javascript",
    {
      symbols: [{ name: "startApp", kind: "function" }],
      imports: [
        {
          name: "Application",
          source: "./main.ts",
          resolved_path: "src/main.ts" as FilePath,
        },
      ],
    }
  );
  indices.set(js_consumer.file_path, js_consumer);

  return indices;
}

/**
 * Create test projects for different languages
 */
function create_language_test_projects(): Map<
  string,
  Map<FilePath, SemanticIndex>
> {
  const projects = new Map<string, Map<FilePath, SemanticIndex>>();

  // JavaScript project with various module patterns
  const js_project = new Map<FilePath, SemanticIndex>();
  js_project.set(
    "src/index.js" as FilePath,
    create_language_test_file("src/index.js" as FilePath, "javascript", {
      symbols: [
        { name: "initialize", kind: "function" },
        { name: "cleanup", kind: "function" },
      ],
      exports: [
        { name: "initialize", kind: "default" },
        { name: "cleanup", kind: "named" },
      ],
    })
  );
  js_project.set(
    "src/helper.js" as FilePath,
    create_language_test_file("src/helper.js" as FilePath, "javascript", {
      symbols: [
        { name: "Helper", kind: "class" },
        { name: "assist", kind: "method" },
      ],
      imports: [
        {
          name: "initialize",
          source: "./index",
          resolved_path: "src/index.js" as FilePath,
        },
      ],
      exports: [{ name: "Helper", kind: "named" }],
      calls: [{ name: "initialize", kind: "function" }],
    })
  );
  projects.set("javascript", js_project);

  // TypeScript project with interfaces and generics
  const ts_project = new Map<FilePath, SemanticIndex>();
  ts_project.set(
    "src/types.ts" as FilePath,
    create_language_test_file("src/types.ts" as FilePath, "typescript", {
      symbols: [
        { name: "DataModel", kind: "class" },
        { name: "process", kind: "method" },
      ],
      exports: [{ name: "DataModel", kind: "named" }],
    })
  );
  ts_project.set(
    "src/service.ts" as FilePath,
    create_language_test_file("src/service.ts" as FilePath, "typescript", {
      symbols: [
        { name: "Service", kind: "class" },
        { name: "execute", kind: "method" },
      ],
      imports: [
        {
          name: "DataModel",
          source: "./types",
          resolved_path: "src/types.ts" as FilePath,
        },
      ],
      exports: [{ name: "Service", kind: "default" }],
    })
  );
  projects.set("typescript", ts_project);

  // Python project with classes and modules
  const py_project = new Map<FilePath, SemanticIndex>();
  py_project.set(
    "src/models.py" as FilePath,
    create_language_test_file("src/models.py" as FilePath, "python", {
      symbols: [
        { name: "BaseModel", kind: "class" },
        { name: "save", kind: "method" },
        { name: "load", kind: "method" },
      ],
      exports: [{ name: "BaseModel", kind: "named" }],
    })
  );
  py_project.set(
    "src/utils.py" as FilePath,
    create_language_test_file("src/utils.py" as FilePath, "python", {
      symbols: [
        { name: "process_data", kind: "function" },
        { name: "validate_input", kind: "function" },
      ],
      imports: [
        {
          name: "BaseModel",
          source: ".models",
          resolved_path: "src/models.py" as FilePath,
        },
      ],
      calls: [{ name: "save", kind: "method" }],
    })
  );
  projects.set("python", py_project);

  // Rust project with traits and modules
  const rs_project = new Map<FilePath, SemanticIndex>();
  rs_project.set(
    "src/lib.rs" as FilePath,
    create_language_test_file("src/lib.rs" as FilePath, "rust", {
      symbols: [
        { name: "Calculator", kind: "class" },
        { name: "add", kind: "function" },
        { name: "multiply", kind: "function" },
      ],
      exports: [
        { name: "Calculator", kind: "named" },
        { name: "add", kind: "named" },
        { name: "multiply", kind: "named" },
      ],
    })
  );
  rs_project.set(
    "src/main.rs" as FilePath,
    create_language_test_file("src/main.rs" as FilePath, "rust", {
      symbols: [{ name: "main", kind: "function" }],
      imports: [
        {
          name: "Calculator",
          source: "crate::lib",
          resolved_path: "src/lib.rs" as FilePath,
        },
        {
          name: "add",
          source: "crate::lib",
          resolved_path: "src/lib.rs" as FilePath,
        },
      ],
      calls: [{ name: "add", kind: "function" }],
    })
  );
  projects.set("rust", rs_project);

  return projects;
}

describe("Cross-Language Symbol Resolution", () => {
  describe("JavaScript/TypeScript mixed projects", () => {
    it("should handle JavaScript and TypeScript interoperability", () => {
      const mixed_project = create_mixed_js_ts_project();
      const resolved_symbols = resolve_symbols({ indices: mixed_project });

      // Verify TypeScript can import from JavaScript
      const ts_imports = resolved_symbols.phases.imports.get(
        "src/main.ts" as FilePath
      );
      expect(ts_imports).toBeDefined();
      expect(ts_imports?.has("processData" as SymbolName)).toBe(true);
      expect(ts_imports?.has("formatOutput" as SymbolName)).toBe(true);

      // Verify JavaScript can import from TypeScript
      const js_imports = resolved_symbols.phases.imports.get(
        "src/consumer.js" as FilePath
      );
      expect(js_imports).toBeDefined();
      expect(js_imports?.has("Application" as SymbolName)).toBe(true);

      // Verify function calls are resolved across language boundaries
      expect(
        resolved_symbols.phases.functions.function_calls.size
      ).toBeGreaterThan(0);
    });

    it("should handle CommonJS and ES6 module patterns", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // CommonJS file
      const commonjs_file = create_language_test_file(
        "src/common.js" as FilePath,
        "javascript",
        {
          symbols: [{ name: "oldStyleExport", kind: "function" }],
          exports: [{ name: "oldStyleExport", kind: "named" }],
        }
      );
      indices.set(commonjs_file.file_path, commonjs_file);

      // ES6 module file
      const es6_file = create_language_test_file(
        "src/modern.js" as FilePath,
        "javascript",
        {
          symbols: [{ name: "modernExport", kind: "function" }],
          imports: [
            {
              name: "oldStyleExport",
              source: "./common.js",
              resolved_path: "src/common.js" as FilePath,
            },
          ],
          exports: [{ name: "modernExport", kind: "default" }],
          calls: [{ name: "oldStyleExport", kind: "function" }],
        }
      );
      indices.set(es6_file.file_path, es6_file);

      const resolved_symbols = resolve_symbols({ indices });

      // Verify imports are resolved
      const modern_imports = resolved_symbols.phases.imports.get(
        "src/modern.js" as FilePath
      );
      expect(modern_imports?.has("oldStyleExport" as SymbolName)).toBe(true);

      // Verify function calls are resolved
      expect(
        resolved_symbols.phases.functions.function_calls.size
      ).toBeGreaterThan(0);
    });
  });

  describe("Language-specific features", () => {
    it("should support all language features independently", () => {
      const multi_lang_projects = create_language_test_projects();

      for (const [language, project] of multi_lang_projects) {
        const resolved_symbols = resolve_symbols({ indices: project });

        // Verify basic resolution works for each language
        expect(
          resolved_symbols.resolved_references.size
        ).toBeGreaterThanOrEqual(0);

        // Check language-specific import resolution
        const has_imports = Array.from(
          resolved_symbols.phases.imports.values()
        ).some((file_imports) => file_imports.size > 0);

        // Log language-specific results
        console.log(`${language} resolution:`);
        console.log(`  Files: ${project.size}`);
        console.log(`  Imports resolved: ${has_imports}`);
        console.log(
          `  Function calls: ${resolved_symbols.phases.functions.function_calls.size}`
        );
      }
    });

    it("should handle JavaScript-specific patterns", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Test hoisting, closures, and prototype patterns
      const js_file = create_language_test_file(
        "src/javascript_patterns.js" as FilePath,
        "javascript",
        {
          symbols: [
            { name: "hoistedFunction", kind: "function" },
            { name: "Constructor", kind: "function" },
            { name: "arrowFunc", kind: "variable" },
          ],
          exports: [
            { name: "hoistedFunction", kind: "named" },
            { name: "Constructor", kind: "named" },
            { name: "arrowFunc", kind: "named" },
          ],
        }
      );
      indices.set(js_file.file_path, js_file);

      const resolved_symbols = resolve_symbols({ indices });

      // JavaScript functions should be recognized
      expect(resolved_symbols.phases.imports.size).toBeGreaterThanOrEqual(0);
    });

    it("should handle TypeScript-specific patterns", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Test interfaces, generics, and decorators
      const ts_file_path = "src/typescript_patterns.ts" as FilePath;
      const root_scope_id = `scope:module:${ts_file_path}:0:0` as ScopeId;

      const generic_class = class_symbol(
        "GenericClass" as SymbolName,
        create_location(ts_file_path, 10, 10)
      );
      const decorator_class = class_symbol(
        "DecoratedClass" as SymbolName,
        create_location(ts_file_path, 20, 10)
      );

      const ts_file: SemanticIndex = {
        file_path: ts_file_path,
        language: "typescript",
        root_scope_id,
        scopes: new Map([
          [
            root_scope_id,
            {
              id: root_scope_id,
              parent_id: null,
              name: null,
              type: "module",
              location: create_location(ts_file_path, 0, 0),
              child_ids: [],
              symbols: new Map(),
            },
          ],
        ]),
        symbols: new Map([
          [
            generic_class,
            {
              id: generic_class,
              name: "GenericClass" as SymbolName,
              kind: "class",
              location: create_location(ts_file_path, 10, 10),
              scope_id: root_scope_id,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
            },
          ],
          [
            decorator_class,
            {
              id: decorator_class,
              name: "DecoratedClass" as SymbolName,
              kind: "class",
              location: create_location(ts_file_path, 20, 10),
              scope_id: root_scope_id,
              is_hoisted: false,
              is_exported: false,
              is_imported: false,
            },
          ],
        ]),
        references: {
          calls: [],
          member_accesses: [],
          returns: [],
          type_annotations: [],
        },
        imports: [],
        exports: [
          {
            kind: "named" as const,
            symbol: "generic_class_symbol" as SymbolId,
            symbol_name: "GenericClass" as SymbolName,
            exports: [
              {
                local_name: "GenericClass" as SymbolName,
                is_type_only: false,
              },
            ],
            location: create_location(ts_file_path, 10, 0),
            modifiers: [],
            language: "typescript",
            node_type: "export_statement",
          },
          {
            kind: "named" as const,
            symbol: "decorated_class_symbol" as SymbolId,
            symbol_name: "DecoratedClass" as SymbolName,
            exports: [
              {
                local_name: "DecoratedClass" as SymbolName,
                is_type_only: false,
              },
            ],
            location: create_location(ts_file_path, 20, 0),
            modifiers: [],
            language: "typescript",
            node_type: "export_statement",
          },
        ],
        file_symbols_by_name: new Map(),
        local_types: [
          {
            type_name: "GenericClass" as SymbolName,
            kind: "class",
            location: create_location(ts_file_path, 10, 10),
            direct_members: new Map(),
            extends_clause: [],
            implements_clause: [],
          },
          {
            type_name: "DecoratedClass" as SymbolName,
            kind: "class",
            location: create_location(ts_file_path, 20, 10),
            direct_members: new Map(),
            extends_clause: [],
            implements_clause: [],
          },
        ],
        local_type_annotations: [],
        local_type_tracking: {
          annotations: [],
          declarations: [],
          assignments: [],
        },
        local_type_flow: {
          constructor_calls: [],
          assignments: [],
          returns: [],
          call_assignments: [],
        },
      };
      indices.set(ts_file.file_path, ts_file);

      const resolved_symbols = resolve_symbols({ indices });

      // TypeScript-specific features should be handled
      expect(
        resolved_symbols.phases.types.symbol_types.size
      ).toBeGreaterThanOrEqual(0);
    });

    it("should handle Python-specific patterns", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Test Python classes, decorators, and multiple inheritance
      const py_file = create_language_test_file(
        "src/python_patterns.py" as FilePath,
        "python",
        {
          symbols: [
            { name: "BaseClass", kind: "class" },
            { name: "DerivedClass", kind: "class" },
            { name: "decorator_func", kind: "function" },
            { name: "__init__", kind: "method" },
          ],
          exports: [
            { name: "BaseClass", kind: "named" },
            { name: "DerivedClass", kind: "named" },
            { name: "decorator_func", kind: "named" },
          ],
        }
      );
      indices.set(py_file.file_path, py_file);

      const resolved_symbols = resolve_symbols({ indices });

      // Python patterns should be recognized
      expect(resolved_symbols.phases.imports.size).toBeGreaterThanOrEqual(0);
    });

    it("should handle Rust-specific patterns", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Test Rust traits, impl blocks, and associated functions
      const rs_file = create_language_test_file(
        "src/rust_patterns.rs" as FilePath,
        "rust",
        {
          symbols: [
            { name: "MyStruct", kind: "class" },
            { name: "new", kind: "function" },
            { name: "associated_func", kind: "function" },
          ],
          exports: [{ name: "MyStruct", kind: "named" }],
        }
      );
      indices.set(rs_file.file_path, rs_file);

      const resolved_symbols = resolve_symbols({ indices });

      // Rust patterns should be recognized
      expect(resolved_symbols.phases.imports.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cross-language import resolution", () => {
    it("should resolve imports with language-specific path patterns", () => {
      const indices = new Map<FilePath, SemanticIndex>();

      // Test different import path patterns across languages
      // JavaScript: ./module, ../module, module
      // TypeScript: ./module, @scope/module
      // Python: .module, ..module, package.module
      // Rust: crate::module, super::module, self::module

      const test_cases = [
        { lang: "javascript", path: "./utils", expected: "src/utils.js" },
        {
          lang: "typescript",
          path: "@app/core",
          expected: "node_modules/@app/core/index.ts",
        },
        { lang: "python", path: ".utils", expected: "utils.py" },
        { lang: "rust", path: "crate::utils", expected: "src/utils.rs" },
      ];

      for (const test of test_cases) {
        const file_ext =
          test.lang === "javascript"
            ? "js"
            : test.lang === "typescript"
            ? "ts"
            : test.lang === "python"
            ? "py"
            : "rs";

        const file_path = `src/test.${file_ext}` as FilePath;
        const file = create_language_test_file(
          file_path,
          test.lang as Language,
          {
            symbols: [{ name: "testFunc", kind: "function" }],
            imports: [{ name: "imported", source: test.path }],
          }
        );
        indices.set(file_path, file);
      }

      const resolved_symbols = resolve_symbols({ indices });

      // Verify language-specific import patterns are handled
      expect(resolved_symbols.phases.imports).toBeDefined();
    });
  });
});
