/**
 * Unit tests for method_resolution module
 */

import { describe, it, expect } from "vitest";
import { resolve_method_call, find_method_in_class } from "./method_resolution";
import {
  MethodCall,
  MethodDefinition,
  ClassDefinition,
  SymbolName,
  FilePath,
  method_symbol,
  class_symbol,
  ScopeTree,
  ScopeNode,
  ScopeId,
  Location,
  Language,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";

/**
 * Create a properly initialized ScopeTree for testing
 */
export function create_test_scope_tree(
  root_node: ScopeNode,
  additional_nodes: Map<ScopeId, ScopeNode> = new Map()
): ScopeTree {
  const nodes = new Map<ScopeId, ScopeNode>();
  const scope_depths = new Map<ScopeId, number>();

  // Add root node
  nodes.set(root_node.id, root_node);
  scope_depths.set(root_node.id, 0);

  // Add additional nodes and calculate depths
  for (const [id, node] of additional_nodes) {
    nodes.set(id, node);

    // Calculate depth by following parent chain
    let depth = 0;
    let current: ScopeNode | undefined = node;

    while (current?.parent_id) {
      depth++;
      current = nodes.get(current.parent_id) || additional_nodes.get(current.parent_id);
    }

    scope_depths.set(id, depth);
  }

  return {
    root_id: root_node.id,
    nodes,
    file_path: root_node.location.file_path,
    scope_depths,
    get_symbols_in_scope: () => new Map(),
    get_parent_scope: () => undefined,
  } as unknown as ScopeTree;
}

/**
 * Create a test scope node with all required properties
 */
export function create_test_scope_node(
  id: ScopeId,
  type: ScopeNode["type"],
  location: Location,
  parent_id?: ScopeId
): ScopeNode {
  return {
    id,
    type,
    location,
    parent_id: parent_id || null,
    name: null,
    child_ids: [],
  } as ScopeNode;
}

/**
 * Create a minimal test context
 */
export function create_test_context(
  language: Language,
  scope_tree: ScopeTree,
  definitions_by_file?: Map<FilePath, any>,
  imports_by_file?: Map<FilePath, any>,
  exports_by_file?: Map<FilePath, any>
): FileResolutionContext {
  return {
    scope_tree,
    language,
    definitions_by_file: definitions_by_file || new Map(),
    imports_by_file: imports_by_file || new Map(),
    exports_by_file: exports_by_file || new Map(),
  };
}

describe("Method Resolution Test Utilities", () => {
  it("should create a valid scope tree", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 1,
    };

    const root_node = create_test_scope_node("global:test.ts" as ScopeId, "global", location);
    const scope_tree = create_test_scope_tree(root_node);

    expect(scope_tree.root_id).toBe(root_node.id);
    expect(scope_tree.nodes.get(root_node.id)).toBe(root_node);
    expect(scope_tree.scope_depths.get(root_node.id)).toBe(0);
  });
});

describe("find_method_in_class", () => {
  it("should find method by name in class definition", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 2,
    };
    const method_location = {
      file_path,
      line: 3,
      column: 3,
      end_line: 5,
      end_column: 4,
    };

    const method: MethodDefinition = {
      name: "getValue" as SymbolName,
      location: method_location,
      signature: {
        parameters: [],
        return_type: undefined,
        is_async: false,
        is_generator: false,
      },
      visibility: "public",
      is_static: false,
      symbol: method_symbol("getValue" as SymbolName, "MyClass" as SymbolName, method_location),
    };

    const class_def: ClassDefinition = {
      name: "MyClass" as SymbolName,
      location: class_location,
      methods: [method],
      extends: [],
      implements: [],
      symbol: class_symbol("MyClass" as SymbolName, class_location),
    };

    const context: FileResolutionContext = {
      scope_tree: {} as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "typescript",
      definitions_by_file: new Map(),
    };

    const result = find_method_in_class("getValue" as SymbolName, class_def, context);
    expect(result).toBe(method);
  });

  it("should return undefined for non-existent method", () => {
    const file_path: FilePath = "test.ts" as FilePath;
    const class_location = {
      file_path,
      line: 1,
      column: 1,
      end_line: 10,
      end_column: 2,
    };

    const class_def: ClassDefinition = {
      name: "MyClass" as SymbolName,
      location: class_location,
      methods: [],
      extends: [],
      implements: [],
      symbol: class_symbol("MyClass" as SymbolName, class_location),
    };

    const context: FileResolutionContext = {
      scope_tree: {} as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "typescript",
      definitions_by_file: new Map(),
    };

    const result = find_method_in_class("nonExistent" as SymbolName, class_def, context);
    expect(result).toBeUndefined();
  });
});