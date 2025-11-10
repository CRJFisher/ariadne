import { describe, it, expect, beforeAll } from "vitest";
import { build_semantic_index } from "./index_single_file/semantic_index";
import { ResolutionRegistry } from "./resolve_references/resolution_registry";
import type { FilePath, Language } from "@ariadnejs/types";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { ParsedFile } from "./index_single_file/file_utils";
import { readFileSync } from "fs";

// Helper to create ParsedFile
function createParsedFile(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split("\n");
  return {
    file_path: filePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}

describe("Nested function scopes", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  it("should create separate scopes for nested arrow functions", () => {
    const code = `
export function parent_function() {
  const nested_function = () => {
    console.log("nested");
    nested_function(); // recursive call
  };

  nested_function(); // call from parent
}
`;

    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = createParsedFile(code, file_path, tree, "typescript");
    const result = build_semantic_index(parsed_file, tree, "typescript");

    // Print scopes
    console.log("=== SCOPES ===");
    for (const scope of result.scopes.values()) {
      console.log({
        id: scope.id,
        type: scope.type,
        name: scope.name,
        parent_id: scope.parent_id,
        location: `${scope.location.start_line}:${scope.location.start_column}-${scope.location.end_line}:${scope.location.end_column}`
      });
    }

    // Print definitions
    console.log("\n=== DEFINITIONS ===");
    for (const def of result.functions.values()) {
      console.log({
        name: def.name,
        kind: "function",
        symbol_id: def.symbol_id,
        body_scope_id: def.body_scope_id
      });
    }

    // We expect:
    // 1. Module scope
    // 2. parent_function scope
    // 3. nested_function scope (arrow function)
    expect(result.scopes.size).toBe(3);
  });

  it("should track constructor calls within same file", () => {
    const code = `
class ReferenceBuilder {
  public readonly references: string[] = [];

  constructor(private readonly context: string) {}

  process(capture: string): ReferenceBuilder {
    console.log(\`Processing: \${capture}\`);
    return this;
  }
}

export function process_references(context: string): string[] {
  return ["a", "b", "c"]
    .reduce(
      (builder, capture) => builder.process(capture),
      new ReferenceBuilder(context)
    )
    .references;
}
`;

    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = createParsedFile(code, file_path, tree, "typescript");
    const result = build_semantic_index(parsed_file, tree, "typescript");

    console.log("\n=== DEFINITIONS ===");
    console.log("Classes:");
    for (const def of result.classes.values()) {
      console.log({
        kind: "class",
        name: def.name,
        symbol_id: def.symbol_id,
        methods: def.methods.map(m => m.name),
      });
    }
    console.log("Functions:");
    for (const def of result.functions.values()) {
      console.log({
        kind: "function",
        name: def.name,
        symbol_id: def.symbol_id,
      });
    }

    console.log("\n=== REFERENCES ===");
    for (const ref of result.references) {
      console.log({
        name: ref.name,
        type: ref.type,
        call_type: ref.call_type,
        location: `${ref.location.start_line}:${ref.location.start_column}`,
      });
    }

    // Find the constructor call reference
    const constructor_call = result.references.find(
      (ref) => ref.call_type === "constructor"
    );

    console.log("\n=== CONSTRUCTOR CALL CHECK ===");
    console.log("Constructor call found:", constructor_call);

    // Verify the constructor call was captured
    expect(constructor_call).toBeDefined();
    expect(constructor_call?.name).toBe("ReferenceBuilder");
    expect(constructor_call?.type).toBe("construct");

    // Verify the class definition exists
    const class_def = Array.from(result.classes.values()).find(
      (def) => def.name === "ReferenceBuilder"
    );
    expect(class_def).toBeDefined();
    console.log("Class definition found:", {
      name: class_def?.name,
      symbol_id: class_def?.symbol_id,
      methods: class_def?.methods.map(m => m.name),
    });
  });

  it("should track constructor in actual ReferenceBuilder.ts file", () => {
    const file_path = "/Users/chuck/workspace/ariadne/packages/core/src/index_single_file/references/reference_builder.ts" as FilePath;
    const code = readFileSync(file_path, "utf-8");

    const tree = parser.parse(code);
    const parsed_file = createParsedFile(code, file_path, tree, "typescript");
    const result = build_semantic_index(parsed_file, tree, "typescript");

    // Find ReferenceBuilder class
    const class_def = Array.from(result.classes.values()).find(
      (def) => def.name === "ReferenceBuilder"
    );

    console.log("\n=== ACTUAL REFERENCE_BUILDER.TS ===");
    console.log("ReferenceBuilder class:", {
      name: class_def?.name,
      symbol_id: class_def?.symbol_id,
      methods: class_def?.methods.map(m => ({ name: m.name, symbol_id: m.symbol_id })),
    });

    // Find constructor call (the one at line 588: new ReferenceBuilder(...))
    const constructor_calls = result.references.filter(
      (ref) => ref.call_type === "constructor" && ref.name === "ReferenceBuilder"
    );

    console.log("\nConstructor calls found:", constructor_calls.length);
    for (const call of constructor_calls) {
      console.log({
        name: call.name,
        type: call.type,
        call_type: call.call_type,
        location: `${call.location.start_line}:${call.location.start_column}`,
      });
    }

    // Check if constructor is in methods array
    const has_constructor_method = class_def?.methods.some(m => m.name === "constructor");
    console.log("\nHas constructor in methods array?", has_constructor_method);

    expect(class_def).toBeDefined();
    expect(constructor_calls.length).toBeGreaterThan(0);
  });

  it("should track this.method() calls within same class", () => {
    const code = `
export class TypeRegistry {
  walk_inheritance_chain(class_id: string): string[] {
    const chain: string[] = [class_id];
    return chain;
  }

  get_type_member(type_id: string, member_name: string): string | null {
    // This call should be detected
    const chain = this.walk_inheritance_chain(type_id);

    for (const class_id of chain) {
      // do something
    }

    return null;
  }
}
`;

    const file_path = "test.ts" as FilePath;
    const tree = parser.parse(code);
    const parsed_file = createParsedFile(code, file_path, tree, "typescript");
    const result = build_semantic_index(parsed_file, tree, "typescript");

    console.log("\n=== METHOD CALL DETECTION TEST ===");
    console.log("Definitions:");
    for (const def of result.classes.values()) {
      console.log({
        kind: "class",
        name: def.name,
        methods: def.methods.map(m => m.name),
      });
    }

    console.log("\nReferences:");
    for (const ref of result.references) {
      console.log({
        name: ref.name,
        type: ref.type,
        call_type: ref.call_type,
        location: `${ref.location.start_line}:${ref.location.start_column}`,
        context: ref.context,
      });
    }

    // Find the call to walk_inheritance_chain
    const method_call = result.references.find(
      (ref) => ref.name === "walk_inheritance_chain" && ref.type === "call"
    );

    console.log("\nMethod call to walk_inheritance_chain:", method_call);

    expect(method_call).toBeDefined();
    expect(method_call?.context?.property_chain).toEqual(["this", "walk_inheritance_chain"]);
  });

  it("should resolve this.method() calls in call graph", async () => {
    const { Project } = await import("./project/project");
    const project = new Project();
    await project.initialize(".", ["**/*.ts"]);

    const code = `
export class TypeRegistry {
  walk_inheritance_chain(class_id: string): string[] {
    const chain: string[] = [class_id];
    return chain;
  }

  get_type_member(type_id: string, member_name: string): string | null {
    // This call should be detected
    const chain = this.walk_inheritance_chain(type_id);

    for (const class_id of chain) {
      // do something
    }

    return null;
  }
}
`;

    await project.update_file("test.ts" as FilePath, code);

    // Get call graph
    const call_graph = project.get_call_graph();

    console.log("\n=== CALL GRAPH TEST ===");
    console.log("All nodes:");
    for (const [symbol_id, node] of call_graph.nodes) {
      console.log({
        symbol_id,
        name: node.name,
        enclosed_calls: node.enclosed_calls.map(c => ({ name: c.name, symbol_id: c.symbol_id })),
      });
    }

    console.log("\nEntry points:");
    for (const entry_point of call_graph.entry_points) {
      const node = call_graph.nodes.get(entry_point);
      console.log({
        symbol_id: entry_point,
        name: node?.name,
      });
    }

    // Find the methods
    const nodes = Array.from(call_graph.nodes.values());
    const walk_inheritance_chain_node = nodes.find(n => n.name === "walk_inheritance_chain");
    const get_type_member_node = nodes.find(n => n.name === "get_type_member");

    console.log("\nwalk_inheritance_chain node:", walk_inheritance_chain_node);
    console.log("get_type_member node:", get_type_member_node);

    // Check that walk_inheritance_chain is NOT an entry point (it's called by get_type_member)
    expect(walk_inheritance_chain_node).toBeDefined();
    expect(get_type_member_node).toBeDefined();

    // get_type_member should have enclosed_calls that includes walk_inheritance_chain
    const enclosed_call_symbol_ids = get_type_member_node!.enclosed_calls.map(c => c.symbol_id);
    console.log("\nget_type_member enclosed_calls symbol_ids:", enclosed_call_symbol_ids);
    console.log("walk_inheritance_chain symbol_id:", walk_inheritance_chain_node!.symbol_id);

    const calls_walk_inheritance_chain = enclosed_call_symbol_ids.includes(walk_inheritance_chain_node!.symbol_id);
    console.log("\nDoes get_type_member call walk_inheritance_chain?", calls_walk_inheritance_chain);

    if (!calls_walk_inheritance_chain) {
      console.log("\nDetailed call analysis:");
      for (const call of get_type_member_node!.enclosed_calls) {
        console.log({
          name: call.name,
          symbol_id: call.symbol_id,
          type: call.type,
        });
      }
    }

    // THIS IS THE KEY TEST: walk_inheritance_chain should NOT be an entry point
    const is_entry_point = call_graph.entry_points.includes(walk_inheritance_chain_node!.symbol_id);
    console.log("\nIs walk_inheritance_chain an entry point?", is_entry_point);

    expect(is_entry_point).toBe(false);
  });
});
