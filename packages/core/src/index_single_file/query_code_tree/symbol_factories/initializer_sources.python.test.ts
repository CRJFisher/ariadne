import { describe, it, expect } from "vitest";
import { parse_python, find_node_by_type } from "./test_utils";
import { extract_collection_source } from "./initializer_sources.python";

// ============================================================================

describe("extract_collection_source", () => {
  it("should extract derived variable from method call", () => {
    const code = "handler = config.get('key')";
    const root = parse_python(code);
    const identifier = find_node_by_type(root, "identifier")!;

    const derived = extract_collection_source(identifier);
    expect(derived).toBe("config");
  });

  it("should extract derived variable from subscript", () => {
    const code = "handler = config['key']";
    const root = parse_python(code);
    const identifier = find_node_by_type(root, "identifier")!;

    const derived = extract_collection_source(identifier);
    expect(derived).toBe("config");
  });

  it("should return undefined for plain assignment", () => {
    const code = "handler = some_func";
    const root = parse_python(code);
    const identifier = find_node_by_type(root, "identifier")!;

    const derived = extract_collection_source(identifier);
    expect(derived).toBeUndefined();
  });
});
