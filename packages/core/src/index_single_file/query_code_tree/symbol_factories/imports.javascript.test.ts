import { describe, it, expect } from "vitest";
import type { SymbolName } from "@ariadnejs/types";
import {
  extract_import_path,
  extract_require_path,
  extract_original_name,
  is_default_import,
  is_namespace_import,
} from "./imports.javascript";
import { parse_js, find_node_by_type } from "./test_utils";

describe("extract_import_path", () => {
  it("should extract path from import statement", () => {
    const root = parse_js("import x from './foo';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = extract_import_path(import_node);
    expect(result).toBe("./foo");
  });

  it("should extract path from named import", () => {
    const root = parse_js("import { bar } from './utils';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = extract_import_path(import_node);
    expect(result).toBe("./utils");
  });

  it("should return empty string for null node", () => {
    const result = extract_import_path(null);
    expect(result).toBe("");
  });
});

describe("extract_require_path", () => {
  it("should extract path from string node", () => {
    const root = parse_js("const x = require('./foo');");
    const string_node = find_node_by_type(root, "string")!;
    const result = extract_require_path(string_node);
    expect(result).toBe("./foo");
  });

  it("should return empty string for non-string node", () => {
    const root = parse_js("const x = require('./foo');");
    const identifier = find_node_by_type(root, "identifier")!;
    const result = extract_require_path(identifier);
    expect(result).toBe("");
  });

  it("should return empty string for null node", () => {
    const result = extract_require_path(null);
    expect(result).toBe("");
  });
});

describe("is_default_import", () => {
  it("should return true for default import", () => {
    const root = parse_js("import foo from './bar';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = is_default_import(import_node, "foo" as SymbolName);
    expect(result).toBe(true);
  });

  it("should return false for named import", () => {
    const root = parse_js("import { foo } from './bar';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = is_default_import(import_node, "foo" as SymbolName);
    expect(result).toBe(false);
  });

  it("should return false for namespace import", () => {
    const root = parse_js("import * as foo from './bar';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = is_default_import(import_node, "foo" as SymbolName);
    expect(result).toBe(false);
  });
});

describe("is_namespace_import", () => {
  it("should return true for namespace import", () => {
    const root = parse_js("import * as utils from './utils';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = is_namespace_import(import_node);
    expect(result).toBe(true);
  });

  it("should return false for default import", () => {
    const root = parse_js("import foo from './bar';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = is_namespace_import(import_node);
    expect(result).toBe(false);
  });

  it("should return false for named import", () => {
    const root = parse_js("import { foo } from './bar';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = is_namespace_import(import_node);
    expect(result).toBe(false);
  });
});

describe("extract_original_name", () => {
  it("should extract original name from aliased import", () => {
    const root = parse_js("import { foo as bar } from './mod';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = extract_original_name(import_node, "bar" as SymbolName);
    expect(result).toBe("foo");
  });

  it("should return undefined for non-aliased import", () => {
    const root = parse_js("import { foo } from './mod';");
    const import_node = find_node_by_type(root, "import_statement")!;
    const result = extract_original_name(import_node, "foo" as SymbolName);
    expect(result).toBeUndefined();
  });

  it("should return undefined for null node", () => {
    const result = extract_original_name(null, "foo" as SymbolName);
    expect(result).toBeUndefined();
  });
});
