import { describe, it, expect } from "vitest";
import { parse_rust, find_node_by_type } from "./test_utils";
import { extract_collection_source } from "./initializer_sources.rust";

// ============================================================================

describe("extract_collection_source", () => {
  it("extracts derived variable from method call", () => {
    const code = "let handler = config.get(\"key\");";
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;
    const pattern = let_decl.childForFieldName("pattern")!;

    const derived = extract_collection_source(pattern);
    expect(derived).toBe("config");
  });

  it("extracts derived variable from index expression", () => {
    const code = "let handler = config[\"key\"];";
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;
    const pattern = let_decl.childForFieldName("pattern")!;

    const derived = extract_collection_source(pattern);
    expect(derived).toBe("config");
  });

  it("returns undefined for plain assignment", () => {
    const code = "let handler = some_func;";
    const root = parse_rust(code);
    const let_decl = find_node_by_type(root, "let_declaration")!;
    const pattern = let_decl.childForFieldName("pattern")!;

    const derived = extract_collection_source(pattern);
    expect(derived).toBeUndefined();
  });
});
