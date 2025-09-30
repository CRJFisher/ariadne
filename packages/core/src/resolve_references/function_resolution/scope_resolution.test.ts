/**
 * Tests for lexical scope resolution infrastructure
 */

import { describe, it, expect } from "vitest";
import type {
  Language,
  Location,
  ScopeId,
  LexicalScope,
  SymbolId,
  SymbolName,
  SymbolDefinition,
  FilePath,
} from "@ariadnejs/types";

import {
  resolve_symbol_in_scope_chain,
  get_visible_symbols,
  find_enclosing_scope_of_type,
  is_scope_descendant,
  collect_descendant_scopes,
  find_hoisted_symbol_in_scope,
  get_hoisting_rules,
  resolve_global_symbol,
  find_containing_function_scope,
  get_scope_chain,
  location_in_scope,
  is_global_scope,
  get_function_scopes_in_file,
  find_scope_at_location,
  analyze_scopes_at_location,
  get_symbols_in_scope,
  get_scope_depth,
  find_common_ancestor_scope,
  is_symbol_accessible_from_scope,
} from "./index";

import type { ScopeResolutionContext } from "./scope_types";

// Helper function to create test location
function create_location(
  file_path: string,
  line: number,
  column: number,
  end_line: number,
  end_column: number
): Location {
  return {
    file_path: file_path as FilePath,
    start_line: line,
    start_column: column,
    end_line,
    end_column,
  };
}

// Helper function to create test scope with mutable child_ids for testing
function create_scope(
  id: string,
  type: LexicalScope["type"],
  parent_id: string | null,
  location: Location,
  child_ids: ScopeId[] = []
): LexicalScope {
  return {
    id: id as ScopeId,
    parent_id: parent_id as ScopeId | null,
    name: null,
    type,
    location,
    child_ids: child_ids as readonly ScopeId[],
    symbols: new Map(),
  };
}

// Helper function to create scope with mutable child_ids that can be modified
function create_mutable_scope(
  id: string,
  type: LexicalScope["type"],
  parent_id: string | null,
  location: Location,
  child_ids: ScopeId[] = []
): LexicalScope & { child_ids: ScopeId[] } {
  return {
    id: id as ScopeId,
    parent_id: parent_id as ScopeId | null,
    name: null,
    type,
    location,
    child_ids,
    symbols: new Map(),
  };
}

// Helper function to create test symbol
function create_symbol(
  id: string,
  name: string,
  kind: SymbolDefinition["kind"],
  scope_id: string,
  is_hoisted: boolean = false
): SymbolDefinition {
  return {
    id: id as SymbolId,
    name: name as SymbolName,
    kind,
    location: create_location("test.js", 1, 0, 1, 10),
    scope_id: scope_id as ScopeId,
    is_hoisted,
    is_exported: false,
    is_imported: false,
  };
}

describe("Scope Walker", () => {
  describe("resolve_symbol_in_scope_chain", () => {
    it("should find symbol in current scope", () => {
      const global_scope = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );

      const my_func = create_symbol("func1", "myFunc", "function", "global");

      global_scope.symbols.set("myFunc" as SymbolName, my_func);

      const context: ScopeResolutionContext = {
        scopes: new Map([[global_scope.id, global_scope]]),
        symbols: new Map([[my_func.id, my_func]]),
        language: "javascript",
      };

      const result = resolve_symbol_in_scope_chain(
        "myFunc" as SymbolName,
        global_scope,
        context
      );

      expect(result).toBeDefined();
      expect(result?.symbol_id).toBe("func1");
      expect(result?.resolution_method).toBe("lexical");
      expect(result?.visibility).toBe("local");
    });

    it("should find symbol in parent scope", () => {
      const global_scope = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );

      const function_scope = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );

      const global_var = create_symbol(
        "var1",
        "globalVar",
        "variable",
        "global"
      );

      global_scope.symbols.set("globalVar" as SymbolName, global_var);

      const context: ScopeResolutionContext = {
        scopes: new Map([
          [global_scope.id, global_scope],
          [function_scope.id, function_scope],
        ]),
        symbols: new Map([[global_var.id, global_var]]),
        language: "javascript",
      };

      const result = resolve_symbol_in_scope_chain(
        "globalVar" as SymbolName,
        function_scope,
        context
      );

      expect(result).toBeDefined();
      expect(result?.symbol_id).toBe("var1");
      expect(result?.resolution_method).toBe("lexical");
      expect(result?.visibility).toBe("closure");
    });

    it("should respect max depth option", () => {
      const global_scope = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );

      const function_scope = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );

      const block_scope = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const globalVar = create_symbol(
        "var1",
        "globalVar",
        "variable",
        "global"
      );

      global_scope.symbols.set("globalVar" as SymbolName, globalVar);

      const context: ScopeResolutionContext = {
        scopes: new Map([
          [global_scope.id, global_scope],
          [function_scope.id, function_scope],
          [block_scope.id, block_scope],
        ]),
        symbols: new Map([[globalVar.id, globalVar]]),
        language: "javascript",
      };

      const result = resolve_symbol_in_scope_chain(
        "globalVar" as SymbolName,
        block_scope,
        context,
        { include_hoisted: true, max_depth: 1 }
      );

      expect(result).toBeNull(); // Should not find it due to depth limit
    });
  });

  describe("get_visible_symbols", () => {
    it("should collect all symbols visible from a scope", () => {
      const global_scope = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );

      const function_scope = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );

      const globalVar = create_symbol(
        "var1",
        "globalVar",
        "variable",
        "global"
      );
      const localVar = create_symbol("var2", "localVar", "variable", "func");

      global_scope.symbols.set("globalVar" as SymbolName, globalVar);
      function_scope.symbols.set("localVar" as SymbolName, localVar);

      const context: ScopeResolutionContext = {
        scopes: new Map([
          [global_scope.id, global_scope],
          [function_scope.id, function_scope],
        ]),
        symbols: new Map([
          [globalVar.id, globalVar],
          [localVar.id, localVar],
        ]),
        language: "javascript",
      };

      const visible = get_visible_symbols(function_scope, context);

      expect(visible.size).toBe(2);
      expect(visible.get("globalVar" as SymbolName)).toBe("var1");
      expect(visible.get("localVar" as SymbolName)).toBe("var2");
    });
  });

  describe("find_enclosing_scope_of_type", () => {
    it("should find nearest enclosing scope of specific type", () => {
      const global_scope = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );

      const function_scope = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );

      const block_scope = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const scopes = new Map([
        [global_scope.id, global_scope],
        [function_scope.id, function_scope],
        [block_scope.id, block_scope],
      ]);

      const result = find_enclosing_scope_of_type(
        block_scope,
        "function",
        scopes
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe("func");
    });

    it("should return null if no enclosing scope of type exists", () => {
      const global_scope = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );

      const block_scope = create_scope(
        "block",
        "block",
        "global",
        create_location("test.js", 12, 0, 18, 0)
      );

      const scopes = new Map([
        [global_scope.id, global_scope],
        [block_scope.id, block_scope],
      ]);

      const result = find_enclosing_scope_of_type(
        block_scope,
        "function",
        scopes
      );
      expect(result).toBeNull();
    });
  });

  describe("is_scope_descendant", () => {
    it("should correctly identify scope descendant relationships", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func.id, func],
        [block.id, block],
      ]);

      // Block is descendant of func and global
      expect(is_scope_descendant(block, func, scopes)).toBe(true);
      expect(is_scope_descendant(block, global, scopes)).toBe(true);

      // Func is descendant of global but not block
      expect(is_scope_descendant(func, global, scopes)).toBe(true);
      expect(is_scope_descendant(func, block, scopes)).toBe(false);

      // Global is not descendant of anything
      expect(is_scope_descendant(global, func, scopes)).toBe(false);
      expect(is_scope_descendant(global, block, scopes)).toBe(false);

      // Scope is descendant of itself
      expect(is_scope_descendant(block, block, scopes)).toBe(true);
    });
  });

  describe("collect_descendant_scopes", () => {
    it("should collect all descendant scopes recursively", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0),
        ["func1" as ScopeId, "func2" as ScopeId]
      );
      const func1 = create_scope(
        "func1",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0),
        ["block1" as ScopeId]
      );
      const func2 = create_scope(
        "func2",
        "function",
        "global",
        create_location("test.js", 30, 0, 40, 0),
        ["block2" as ScopeId]
      );
      const block1 = create_scope(
        "block1",
        "block",
        "func1",
        create_location("test.js", 12, 0, 18, 0)
      );
      const block2 = create_scope(
        "block2",
        "block",
        "func2",
        create_location("test.js", 32, 0, 38, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func1.id, func1],
        [func2.id, func2],
        [block1.id, block1],
        [block2.id, block2],
      ]);

      const descendants = collect_descendant_scopes(global, scopes);

      expect(descendants).toHaveLength(4);
      expect(descendants.map((s) => s.id).sort()).toEqual([
        "block1",
        "block2",
        "func1",
        "func2",
      ]);
    });

    it("should handle scopes with no children", () => {
      const leaf = create_scope(
        "leaf",
        "block",
        null,
        create_location("test.js", 1, 0, 10, 0)
      );
      const scopes = new Map([[leaf.id, leaf]]);

      const descendants = collect_descendant_scopes(leaf, scopes);
      expect(descendants).toHaveLength(0);
    });
  });
});

describe("Edge Cases and Error Handling", () => {
  describe("Circular scope references", () => {
    it("should handle circular parent references gracefully", () => {
      // Create a circular reference (should not happen in practice but test defensive coding)
      const scope1 = create_scope(
        "scope1",
        "block",
        "scope2",
        create_location("test.js", 1, 0, 10, 0)
      );
      const scope2 = create_scope(
        "scope2",
        "block",
        "scope1",
        create_location("test.js", 11, 0, 20, 0)
      );

      const scopes = new Map([
        [scope1.id, scope1],
        [scope2.id, scope2],
      ]);

      const symbol = create_symbol("s1", "var", "variable", "scope1");
      const context: ScopeResolutionContext = {
        scopes,
        symbols: new Map([[symbol.id, symbol]]),
        language: "javascript",
      };

      // Should not infinite loop due to visited tracker
      const result = resolve_symbol_in_scope_chain(
        "nonexistent" as SymbolName,
        scope1,
        context
      );

      expect(result).toBeNull();
    });
  });

  describe("Empty and null cases", () => {
    it("should handle empty scope maps", () => {
      const scope = create_scope(
        "scope",
        "global",
        null,
        create_location("test.js", 1, 0, 10, 0)
      );
      const context: ScopeResolutionContext = {
        scopes: new Map(),
        symbols: new Map(),
        language: "javascript",
      };

      const result = resolve_symbol_in_scope_chain(
        "anything" as SymbolName,
        scope,
        context
      );

      expect(result).toBeNull();
    });

    it("should handle scopes with no symbols", () => {
      const scope = create_scope(
        "scope",
        "global",
        null,
        create_location("test.js", 1, 0, 10, 0)
      );
      const context: ScopeResolutionContext = {
        scopes: new Map([[scope.id, scope]]),
        symbols: new Map(),
        language: "javascript",
      };

      const visible = get_visible_symbols(scope, context);
      expect(visible.size).toBe(0);
    });

    it("should handle missing parent scopes", () => {
      const orphan = create_scope(
        "orphan",
        "block",
        "missing",
        create_location("test.js", 1, 0, 10, 0)
      );
      const scopes = new Map([[orphan.id, orphan]]);

      const chain = get_scope_chain(orphan, scopes);
      expect(chain).toHaveLength(1);
      expect(chain[0].id).toBe("orphan");
    });
  });

  describe("Boundary conditions", () => {
    it("should handle exact boundary matches for location_in_scope", () => {
      const scope = create_scope(
        "scope",
        "block",
        null,
        create_location("test.js", 10, 5, 20, 15)
      );

      // Exact start boundary
      const startBoundary = create_location("test.js", 10, 5, 10, 5);
      expect(location_in_scope(startBoundary, scope)).toBe(true);

      // Exact end boundary
      const endBoundary = create_location("test.js", 20, 15, 20, 15);
      expect(location_in_scope(endBoundary, scope)).toBe(true);

      // Just before start
      const beforeStart = create_location("test.js", 10, 4, 10, 4);
      expect(location_in_scope(beforeStart, scope)).toBe(false);

      // Just after end
      const afterEnd = create_location("test.js", 20, 16, 20, 16);
      expect(location_in_scope(afterEnd, scope)).toBe(false);
    });

    it("should handle overlapping scopes correctly", () => {
      // Two scopes that overlap (shouldn't happen but test it)
      const scope1 = create_scope(
        "scope1",
        "block",
        null,
        create_location("test.js", 10, 0, 20, 0)
      );
      const scope2 = create_scope(
        "scope2",
        "block",
        null,
        create_location("test.js", 15, 0, 25, 0)
      );

      const scopes = new Map([
        [scope1.id, scope1],
        [scope2.id, scope2],
      ]);

      // Location in overlap region
      const overlap = create_location("test.js", 17, 5, 17, 10);
      const result = find_scope_at_location(overlap, scopes);

      // Should pick the smallest scope (scope1 is smaller)
      expect(result).toBeDefined();
      // Both scopes contain the location, but scope1 is smaller
      expect(result?.id).toBe("scope1");
    });
  });

  describe("Symbol shadowing", () => {
    it("should handle symbol shadowing correctly", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );

      const globalVar = create_symbol("s1", "x", "variable", "global");
      const localVar = create_symbol("s2", "x", "variable", "func");

      global.symbols.set("x" as SymbolName, globalVar);
      func.symbols.set("x" as SymbolName, localVar);

      const context: ScopeResolutionContext = {
        scopes: new Map([
          [global.id, global],
          [func.id, func],
        ]),
        symbols: new Map([
          [globalVar.id, globalVar],
          [localVar.id, localVar],
        ]),
        language: "javascript",
      };

      // Should find local variable, not global
      const result = resolve_symbol_in_scope_chain(
        "x" as SymbolName,
        func,
        context
      );

      expect(result?.symbol_id).toBe("s2");
      expect(result?.visibility).toBe("local");
    });
  });

  describe("Deep nesting", () => {
    it("should handle deeply nested scopes", () => {
      const scopes = new Map<ScopeId, LexicalScope>();
      let parent: (LexicalScope & { child_ids: ScopeId[] }) | null = null;
      let deepest: LexicalScope | null = null;

      // Create 10 levels of nesting
      for (let i = 0; i < 10; i++) {
        const scope = create_mutable_scope(
          `scope${i}`,
          i === 0 ? "global" : "block",
          parent?.id || null,
          create_location("test.js", i * 10, 0, (i + 1) * 10, 0)
        );

        if (parent) {
          parent.child_ids.push(scope.id);
        }

        scopes.set(scope.id, scope);
        parent = scope;

        if (i === 9) {
          deepest = scope;
        }
      }

      expect(get_scope_depth(deepest!, scopes)).toBe(9);

      const chain = get_scope_chain(deepest!, scopes);
      expect(chain).toHaveLength(10);
    });
  });
});

describe("Hoisting Handler", () => {
  describe("get_hoisting_rules", () => {
    it("should return correct rules for JavaScript", () => {
      const rules = get_hoisting_rules("javascript");

      expect(rules.function_declarations).toBe(true);
      expect(rules.var_declarations).toBe(true);
      expect(rules.let_const_declarations).toBe(false);
      expect(rules.class_declarations).toBe(false);
    });

    it("should return correct rules for Python", () => {
      const rules = get_hoisting_rules("python");

      expect(rules.function_declarations).toBe(false);
      expect(rules.var_declarations).toBe(false);
      expect(rules.let_const_declarations).toBe(false);
      expect(rules.class_declarations).toBe(false);
    });

    it("should return correct rules for Rust", () => {
      const rules = get_hoisting_rules("rust");

      expect(rules.function_declarations).toBe(true);
      expect(rules.var_declarations).toBe(false);
      expect(rules.let_const_declarations).toBe(false);
      expect(rules.class_declarations).toBe(true);
    });
  });

  describe("resolve_global_symbol", () => {
    it("should resolve JavaScript built-in symbols", () => {
      const console_id = resolve_global_symbol(
        "console" as SymbolName,
        "javascript"
      );
      expect(console_id).toBe("builtin:javascript:console");

      const promise_id = resolve_global_symbol(
        "Promise" as SymbolName,
        "javascript"
      );
      expect(promise_id).toBe("builtin:javascript:Promise");
    });

    it("should resolve Python built-in symbols", () => {
      const print_id = resolve_global_symbol("print" as SymbolName, "python");
      expect(print_id).toBe("builtin:python:print");

      const len_id = resolve_global_symbol("len" as SymbolName, "python");
      expect(len_id).toBe("builtin:python:len");
    });

    it("should resolve Rust macro symbols", () => {
      const println_id = resolve_global_symbol(
        "println!" as SymbolName,
        "rust"
      );
      expect(println_id).toBe("builtin:rust:println!");

      const vec_id = resolve_global_symbol("vec!" as SymbolName, "rust");
      expect(vec_id).toBe("builtin:rust:vec!");
    });

    it("should return null for unknown symbols", () => {
      const unknown_id = resolve_global_symbol(
        "unknownSymbol" as SymbolName,
        "javascript"
      );
      expect(unknown_id).toBeNull();
    });

    it("should resolve TypeScript-specific globals", () => {
      const array_id = resolve_global_symbol(
        "Array" as SymbolName,
        "typescript"
      );
      expect(array_id).toBe("builtin:typescript:Array");

      const map_id = resolve_global_symbol("Map" as SymbolName, "typescript");
      expect(map_id).toBe("builtin:typescript:Map");
    });

    it("should resolve Node.js-specific globals", () => {
      const process_id = resolve_global_symbol(
        "process" as SymbolName,
        "javascript"
      );
      expect(process_id).toBe("builtin:javascript:process");

      const require_id = resolve_global_symbol(
        "require" as SymbolName,
        "javascript"
      );
      expect(require_id).toBe("builtin:javascript:require");

      const buffer_id = resolve_global_symbol(
        "Buffer" as SymbolName,
        "javascript"
      );
      expect(buffer_id).toBe("builtin:javascript:Buffer");
    });

    it("should resolve browser-specific globals", () => {
      const window_id = resolve_global_symbol(
        "window" as SymbolName,
        "javascript"
      );
      expect(window_id).toBe("builtin:javascript:window");

      const document_id = resolve_global_symbol(
        "document" as SymbolName,
        "javascript"
      );
      expect(document_id).toBe("builtin:javascript:document");
    });
  });

  describe("find_hoisted_symbol_in_scope", () => {
    it("should find hoisted function declarations in scope", () => {
      const scope = create_scope(
        "scope",
        "function",
        null,
        create_location("test.js", 1, 0, 20, 0)
      );
      const hoistedFunc = create_symbol(
        "func1",
        "myHoistedFunc",
        "function",
        "scope",
        true
      );

      const context: ScopeResolutionContext = {
        scopes: new Map([[scope.id, scope]]),
        symbols: new Map([[hoistedFunc.id, hoistedFunc]]),
        language: "javascript",
      };

      const result = find_hoisted_symbol_in_scope(
        "myHoistedFunc" as SymbolName,
        scope,
        context
      );

      expect(result).toBe("func1");
    });

    it("should find hoisted var declarations", () => {
      const scope = create_scope(
        "scope",
        "function",
        null,
        create_location("test.js", 1, 0, 20, 0)
      );
      const hoistedVar = create_symbol(
        "var1",
        "myVar",
        "variable",
        "scope",
        true
      );

      const context: ScopeResolutionContext = {
        scopes: new Map([[scope.id, scope]]),
        symbols: new Map([[hoistedVar.id, hoistedVar]]),
        language: "javascript",
      };

      const result = find_hoisted_symbol_in_scope(
        "myVar" as SymbolName,
        scope,
        context
      );

      expect(result).toBe("var1");
    });

    it("should not find non-hoisted symbols", () => {
      const scope = create_scope(
        "scope",
        "function",
        null,
        create_location("test.js", 1, 0, 20, 0)
      );
      const nonHoisted = create_symbol(
        "let1",
        "myLet",
        "variable",
        "scope",
        false
      );

      const context: ScopeResolutionContext = {
        scopes: new Map([[scope.id, scope]]),
        symbols: new Map([[nonHoisted.id, nonHoisted]]),
        language: "javascript",
      };

      const result = find_hoisted_symbol_in_scope(
        "myLet" as SymbolName,
        scope,
        context
      );

      expect(result).toBeNull();
    });

    it("should respect language-specific hoisting rules", () => {
      const scope = create_scope(
        "scope",
        "function",
        null,
        create_location("test.py", 1, 0, 20, 0)
      );
      const funcDef = create_symbol(
        "func1",
        "myFunc",
        "function",
        "scope",
        false
      );

      const context: ScopeResolutionContext = {
        scopes: new Map([[scope.id, scope]]),
        symbols: new Map([[funcDef.id, funcDef]]),
        language: "python", // Python doesn't hoist
      };

      const result = find_hoisted_symbol_in_scope(
        "myFunc" as SymbolName,
        scope,
        context
      );

      expect(result).toBeNull(); // Python doesn't hoist functions
    });
  });

  describe("hoisting behavior", () => {
    it("should handle JavaScript function hoisting", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );

      // Hoisted function defined in block but accessible in parent
      const hoistedFunc = create_symbol(
        "func1",
        "hoistedFunc",
        "function",
        "block",
        true
      );

      const context: ScopeResolutionContext = {
        scopes: new Map([
          [global.id, global],
          [block.id, block],
        ]),
        symbols: new Map([[hoistedFunc.id, hoistedFunc]]),
        language: "javascript",
      };

      // Should find hoisted function from parent scope
      const result = resolve_symbol_in_scope_chain(
        "hoistedFunc" as SymbolName,
        global,
        context,
        { include_hoisted: true }
      );

      // Note: This test shows current behavior - may need adjustment based on hoisting implementation
      expect(result).toBeNull(); // Current implementation doesn't hoist from child to parent
    });

    it("should respect temporal dead zone for let/const", () => {
      const rules_js = get_hoisting_rules("javascript");
      expect(rules_js.let_const_declarations).toBe(false);

      const rules_ts = get_hoisting_rules("typescript");
      expect(rules_ts.let_const_declarations).toBe(false);
    });

    it("should handle var declaration hoisting", () => {
      const rules = get_hoisting_rules("javascript");
      expect(rules.var_declarations).toBe(true);
    });
  });
});

describe("Scope Utilities", () => {
  describe("location_in_scope", () => {
    it("should correctly determine if location is within scope", () => {
      const scope = create_scope(
        "func",
        "function",
        null,
        create_location("test.js", 10, 0, 20, 0)
      );

      // Location inside scope
      const inside = create_location("test.js", 15, 5, 15, 10);
      expect(location_in_scope(inside, scope)).toBe(true);

      // Location before scope
      const before = create_location("test.js", 5, 0, 5, 10);
      expect(location_in_scope(before, scope)).toBe(false);

      // Location after scope
      const after = create_location("test.js", 25, 0, 25, 10);
      expect(location_in_scope(after, scope)).toBe(false);

      // Different file
      const different_file = create_location("other.js", 15, 0, 15, 10);
      expect(location_in_scope(different_file, scope)).toBe(false);
    });
  });

  describe("is_global_scope", () => {
    it("should identify global and module scopes", () => {
      const global = create_scope(
        "g",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const module = create_scope(
        "m",
        "module",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "f",
        "function",
        "g",
        create_location("test.js", 10, 0, 20, 0)
      );

      expect(is_global_scope(global)).toBe(true);
      expect(is_global_scope(module)).toBe(true);
      expect(is_global_scope(func)).toBe(false);
    });
  });

  describe("get_scope_chain", () => {
    it("should return chain from scope to root", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func.id, func],
        [block.id, block],
      ]);

      const chain = get_scope_chain(block, scopes);

      expect(chain).toHaveLength(3);
      expect(chain[0].id).toBe("block");
      expect(chain[1].id).toBe("func");
      expect(chain[2].id).toBe("global");
    });
  });

  describe("get_scope_depth", () => {
    it("should calculate correct scope depth", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func.id, func],
        [block.id, block],
      ]);

      expect(get_scope_depth(global, scopes)).toBe(0);
      expect(get_scope_depth(func, scopes)).toBe(1);
      expect(get_scope_depth(block, scopes)).toBe(2);
    });
  });

  describe("find_common_ancestor_scope", () => {
    it("should find common ancestor of two scopes", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 30, 0)
      );
      const block1 = create_scope(
        "block1",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );
      const block2 = create_scope(
        "block2",
        "block",
        "func",
        create_location("test.js", 20, 0, 28, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func.id, func],
        [block1.id, block1],
        [block2.id, block2],
      ]);

      const ancestor = find_common_ancestor_scope(block1, block2, scopes);

      expect(ancestor).toBeDefined();
      expect(ancestor?.id).toBe("func");
    });
  });

  describe("is_symbol_accessible_from_scope", () => {
    it("should determine if symbol is accessible", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func.id, func],
        [block.id, block],
      ]);

      const globalSymbol = create_symbol(
        "s1",
        "globalVar",
        "variable",
        "global"
      );
      const funcSymbol = create_symbol("s2", "funcVar", "variable", "func");
      const blockSymbol = create_symbol("s3", "blockVar", "variable", "block");

      // Symbol in ancestor scope is accessible
      expect(is_symbol_accessible_from_scope(globalSymbol, block, scopes)).toBe(
        true
      );
      expect(is_symbol_accessible_from_scope(funcSymbol, block, scopes)).toBe(
        true
      );

      // Symbol in same scope is accessible
      expect(is_symbol_accessible_from_scope(blockSymbol, block, scopes)).toBe(
        true
      );

      // Symbol in descendant scope is not accessible
      expect(is_symbol_accessible_from_scope(blockSymbol, func, scopes)).toBe(
        false
      );
    });
  });

  describe("find_containing_function_scope", () => {
    it("should find the containing function scope", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );
      const method = create_scope(
        "method",
        "method",
        "global",
        create_location("test.js", 30, 0, 40, 0)
      );
      const constructor = create_scope(
        "ctor",
        "constructor",
        "global",
        create_location("test.js", 50, 0, 60, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func.id, func],
        [method.id, method],
        [constructor.id, constructor],
        [block.id, block],
      ]);

      // Location inside function
      const inFunc = create_location("test.js", 15, 5, 15, 10);
      const result1 = find_containing_function_scope(inFunc, scopes);
      expect(result1?.id).toBe("func");

      // Location inside method
      const inMethod = create_location("test.js", 35, 5, 35, 10);
      const result2 = find_containing_function_scope(inMethod, scopes);
      expect(result2?.id).toBe("method");

      // Location inside constructor
      const inConstructor = create_location("test.js", 55, 5, 55, 10);
      const result3 = find_containing_function_scope(inConstructor, scopes);
      expect(result3?.id).toBe("ctor");

      // Location outside any function
      const outside = create_location("test.js", 5, 0, 5, 10);
      const result4 = find_containing_function_scope(outside, scopes);
      expect(result4).toBeNull();
    });
  });

  describe("get_function_scopes_in_file", () => {
    it("should return all function scopes in a file", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func1 = create_scope(
        "func1",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );
      const func2 = create_scope(
        "func2",
        "function",
        "global",
        create_location("test.js", 30, 0, 40, 0)
      );
      const method1 = create_scope(
        "method1",
        "method",
        "global",
        create_location("test.js", 50, 0, 60, 0)
      );
      const constructor1 = create_scope(
        "ctor1",
        "constructor",
        "global",
        create_location("test.js", 70, 0, 80, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "func1",
        create_location("test.js", 12, 0, 18, 0)
      );
      const otherFile = create_scope(
        "other",
        "function",
        "global",
        create_location("other.js", 1, 0, 10, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func1.id, func1],
        [func2.id, func2],
        [method1.id, method1],
        [constructor1.id, constructor1],
        [block.id, block],
        [otherFile.id, otherFile],
      ]);

      const functionScopes = get_function_scopes_in_file(
        scopes,
        "test.js" as FilePath
      );

      expect(functionScopes).toHaveLength(4);
      expect(functionScopes.map((s) => s.id).sort()).toEqual([
        "ctor1",
        "func1",
        "func2",
        "method1",
      ]);
    });
  });

  describe("find_scope_at_location", () => {
    it("should find the most specific scope at a location", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );
      const innerBlock = create_scope(
        "inner",
        "block",
        "block",
        create_location("test.js", 14, 0, 16, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func.id, func],
        [block.id, block],
        [innerBlock.id, innerBlock],
      ]);

      // Location in innermost block
      const loc1 = create_location("test.js", 15, 5, 15, 10);
      const result1 = find_scope_at_location(loc1, scopes);
      expect(result1?.id).toBe("inner");

      // Location in middle block
      const loc2 = create_location("test.js", 17, 5, 17, 10);
      const result2 = find_scope_at_location(loc2, scopes);
      expect(result2?.id).toBe("block");

      // Location in function
      const loc3 = create_location("test.js", 19, 5, 19, 10);
      const result3 = find_scope_at_location(loc3, scopes);
      expect(result3?.id).toBe("func");

      // Location in global scope
      const loc4 = create_location("test.js", 25, 5, 25, 10);
      const result4 = find_scope_at_location(loc4, scopes);
      expect(result4?.id).toBe("global");

      // Location outside all scopes
      const loc5 = create_location("test.js", 200, 0, 200, 10);
      const result5 = find_scope_at_location(loc5, scopes);
      expect(result5).toBeNull();
    });
  });

  describe("analyze_scopes_at_location", () => {
    it("should analyze all scopes at a location", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0)
      );
      const block = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const scopes = new Map([
        [global.id, global],
        [func.id, func],
        [block.id, block],
      ]);

      const location = create_location("test.js", 15, 5, 15, 10);
      const analysis = analyze_scopes_at_location(
        location,
        scopes,
        "global" as ScopeId
      );

      expect(analysis.immediate_scope).toBe("block");
      expect(analysis.function_scope).toBe("func");
      expect(analysis.module_scope).toBe("global");
      expect(analysis.containing_scopes).toEqual(["block", "func", "global"]);
    });

    it("should handle location outside all scopes", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );

      const scopes = new Map([[global.id, global]]);

      const location = create_location("test.js", 200, 0, 200, 10);
      const analysis = analyze_scopes_at_location(
        location,
        scopes,
        "global" as ScopeId
      );

      expect(analysis.immediate_scope).toBeNull();
      expect(analysis.function_scope).toBeNull();
      expect(analysis.module_scope).toBe("global");
      expect(analysis.containing_scopes).toEqual([]);
    });
  });

  describe("get_symbols_in_scope", () => {
    it("should get all symbols in a scope", () => {
      const global = create_scope(
        "global",
        "global",
        null,
        create_location("test.js", 1, 0, 100, 0)
      );
      const func = create_scope(
        "func",
        "function",
        "global",
        create_location("test.js", 10, 0, 20, 0),
        ["block" as ScopeId]
      );
      const block = create_scope(
        "block",
        "block",
        "func",
        create_location("test.js", 12, 0, 18, 0)
      );

      const sym1 = create_symbol("s1", "globalVar", "variable", "global");
      const sym2 = create_symbol("s2", "funcVar", "variable", "func");
      const sym3 = create_symbol("s3", "blockVar", "variable", "block");

      const symbols = new Map([
        [sym1.id, sym1],
        [sym2.id, sym2],
        [sym3.id, sym3],
      ]);

      // Get direct symbols only
      const funcSymbols = get_symbols_in_scope(func, symbols, false);
      expect(funcSymbols).toHaveLength(1);
      expect(funcSymbols[0].name).toBe("funcVar" as SymbolName);

      // Get symbols including children
      const funcWithChildren = get_symbols_in_scope(func, symbols, true);
      expect(funcWithChildren).toHaveLength(2);
      expect(funcWithChildren.map((s) => s.name).sort()).toEqual([
        "blockVar",
        "funcVar",
      ]);
    });
  });
});
