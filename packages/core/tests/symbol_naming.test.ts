import {
  get_symbol_id,
  parse_symbol_id,
  normalize_module_path,
  get_qualified_name,
  create_method_symbol_id,
  is_method_symbol,
  get_symbol_container,
  get_unqualified_name,
  same_module,
} from "../src/symbol_naming";
import { Def } from "../src/graph";

// Helper to create a test Def object
function create_test_def(overrides: Partial<Def>): Def {
  return {
    id: 1,
    kind: "definition",
    name: "test_function",
    symbol_kind: "function",
    file_path: "src/test.ts",
    range: {
      start: { row: 10, column: 0 },
      end: { row: 10, column: 20 },
    },
    ...overrides,
  };
}

describe("normalize_module_path", () => {
  test("removes file extension", () => {
    expect(normalize_module_path("src/utils/helpers.ts")).toBe(
      "src/utils/helpers"
    );
    expect(normalize_module_path("src/utils/helpers.js")).toBe(
      "src/utils/helpers"
    );
    expect(normalize_module_path("src/utils/helpers.py")).toBe(
      "src/utils/helpers"
    );
    expect(normalize_module_path("src/utils/helpers.rs")).toBe(
      "src/utils/helpers"
    );
  });

  test("handles files with multiple dots", () => {
    expect(normalize_module_path("src/utils/helpers.test.ts")).toBe(
      "src/utils/helpers.test"
    );
    expect(normalize_module_path("src/config.prod.js")).toBe("src/config.prod");
  });

  test("normalizes backslashes to forward slashes", () => {
    expect(normalize_module_path("src\\utils\\helpers.ts")).toBe(
      "src/utils/helpers"
    );
    expect(normalize_module_path("src\\components\\Button.tsx")).toBe(
      "src/components/Button"
    );
  });

  test("removes leading slash", () => {
    expect(normalize_module_path("/src/utils/helpers.ts")).toBe(
      "src/utils/helpers"
    );
    expect(normalize_module_path("/absolute/path/file.js")).toBe(
      "absolute/path/file"
    );
  });

  test("handles files without extension", () => {
    expect(normalize_module_path("src/utils/Makefile")).toBe(
      "src/utils/Makefile"
    );
    expect(normalize_module_path("src/LICENSE")).toBe("src/LICENSE");
  });

  test("handles root-level files", () => {
    expect(normalize_module_path("index.ts")).toBe("index");
    expect(normalize_module_path("package.json")).toBe("package");
  });
});

describe("get_qualified_name", () => {
  test("returns simple name for functions", () => {
    const def = create_test_def({ name: "process_data" });
    expect(get_qualified_name(def)).toBe("process_data");
  });

  test("includes class name for methods", () => {
    const def = create_test_def({
      name: "validate",
      symbol_kind: "method",
      metadata: {
        class_name: "User",
        line_count: 10,
      },
    });
    expect(get_qualified_name(def)).toBe("User.validate");
  });

  test("handles anonymous functions", () => {
    const def = create_test_def({ name: "<anonymous>" });
    expect(get_qualified_name(def)).toBe("<anonymous_line_10_col_0>");

    const def2 = create_test_def({ name: "" });
    expect(get_qualified_name(def2)).toBe("<anonymous_line_10_col_0>");

    const def3 = create_test_def({ name: undefined as any });
    expect(get_qualified_name(def3)).toBe("<anonymous_line_10_col_0>");
  });

  test("handles constructor names", () => {
    const def = create_test_def({
      name: "constructor",
      symbol_kind: "method",
      metadata: {
        class_name: "Button",
        line_count: 5,
      },
    });
    expect(get_qualified_name(def)).toBe("Button.constructor");
  });
});

describe("get_symbol_id", () => {
  test("generates correct ID for functions", () => {
    const def = create_test_def({
      name: "process_data",
      file_path: "src/utils/helpers.ts",
    });
    expect(get_symbol_id(def)).toBe("src/utils/helpers#process_data");
  });

  test("generates correct ID for methods", () => {
    const def = create_test_def({
      name: "validate",
      symbol_kind: "method",
      file_path: "src/models/User.ts",
      metadata: {
        class_name: "User",
        line_count: 15,
      },
    });
    expect(get_symbol_id(def)).toBe("src/models/User#User.validate");
  });

  test("handles nested paths", () => {
    const def = create_test_def({
      name: "deepFunction",
      file_path: "src/components/forms/inputs/TextInput.tsx",
    });
    expect(get_symbol_id(def)).toBe(
      "src/components/forms/inputs/TextInput#deepFunction"
    );
  });

  test("handles anonymous functions with position", () => {
    const def = create_test_def({
      name: "<anonymous>",
      file_path: "src/utils/callbacks.js",
      range: {
        start: { row: 42, column: 15 },
        end: { row: 45, column: 0 },
      },
    });
    expect(get_symbol_id(def)).toBe(
      "src/utils/callbacks#<anonymous_line_42_col_15>"
    );
  });
});

describe("parse_symbol_id", () => {
  test("parses function symbol IDs", () => {
    const result = parse_symbol_id("src/utils/helpers#process_data");
    expect(result.module_path).toBe("src/utils/helpers");
    expect(result.symbol_name).toBe("process_data");
  });

  test("parses method symbol IDs", () => {
    const result = parse_symbol_id("src/models/User#User.validate");
    expect(result.module_path).toBe("src/models/User");
    expect(result.symbol_name).toBe("User.validate");
  });

  test("handles symbols with # in name", () => {
    const result = parse_symbol_id("src/utils/helpers#process#data");
    expect(result.module_path).toBe("src/utils/helpers");
    expect(result.symbol_name).toBe("process#data");
  });

  test("throws on invalid format", () => {
    expect(() => parse_symbol_id("invalid_symbol_id")).toThrow(
      "Invalid symbol ID format"
    );
    expect(() => parse_symbol_id("")).toThrow("Invalid symbol ID format");
  });
});

describe("create_method_symbol_id", () => {
  test("creates correct method symbol ID", () => {
    const id = create_method_symbol_id("src/models/User", "User", "validate");
    expect(id).toBe("src/models/User#User.validate");
  });

  test("handles nested classes", () => {
    const id = create_method_symbol_id(
      "src/ui/components",
      "Button.Icon",
      "render"
    );
    expect(id).toBe("src/ui/components#Button.Icon.render");
  });
});

describe("is_method_symbol", () => {
  test("identifies method symbols", () => {
    expect(is_method_symbol("src/models/User#User.validate")).toBe(true);
    expect(is_method_symbol("src/ui/Button#Button.render")).toBe(true);
  });

  test("identifies non-method symbols", () => {
    expect(is_method_symbol("src/utils/helpers#process_data")).toBe(false);
    expect(is_method_symbol("src/index#main")).toBe(false);
  });
});

describe("get_symbol_container", () => {
  test("extracts container from method symbols", () => {
    expect(get_symbol_container("src/models/User#User.validate")).toBe("User");
    expect(get_symbol_container("src/ui/Button#Component.render")).toBe(
      "Component"
    );
  });

  test("returns null for non-method symbols", () => {
    expect(get_symbol_container("src/utils/helpers#process_data")).toBe(null);
    expect(get_symbol_container("src/index#main")).toBe(null);
  });

  test("handles nested containers", () => {
    expect(get_symbol_container("src/ui/forms#Form.Field.validate")).toBe(
      "Form"
    );
  });
});

describe("get_unqualified_name", () => {
  test("returns unqualified name for methods", () => {
    expect(get_unqualified_name("src/models/User#User.validate")).toBe(
      "validate"
    );
    expect(get_unqualified_name("src/ui/Button#Button.render")).toBe("render");
  });

  test("returns full name for non-methods", () => {
    expect(get_unqualified_name("src/utils/helpers#process_data")).toBe(
      "process_data"
    );
    expect(get_unqualified_name("src/index#main")).toBe("main");
  });

  test("handles nested qualifications", () => {
    expect(get_unqualified_name("src/ui/forms#Form.Field.validate")).toBe(
      "validate"
    );
  });
});

describe("same_module", () => {
  test("identifies same modules with different extensions", () => {
    expect(same_module("src/utils/helpers.ts", "src/utils/helpers.js")).toBe(
      true
    );
    expect(same_module("src/models/User.ts", "src/models/User.py")).toBe(true);
  });

  test("handles .d.ts files correctly", () => {
    // .d.ts files are normalized to remove the full .d.ts extension
    expect(normalize_module_path("src/models/User.d.ts")).toBe(
      "src/models/User.d"
    );
    expect(same_module("src/models/User.d.ts", "src/models/User.d.ts")).toBe(
      true
    );
    // But User.ts and User.d.ts are different modules
    expect(same_module("src/models/User.ts", "src/models/User.d.ts")).toBe(
      false
    );
  });

  test("identifies same modules with different path separators", () => {
    expect(same_module("src/utils/helpers.ts", "src\\utils\\helpers.ts")).toBe(
      true
    );
    expect(same_module("src\\models\\User.ts", "src/models/User.ts")).toBe(
      true
    );
  });

  test("identifies different modules", () => {
    expect(same_module("src/utils/helpers.ts", "src/utils/strings.ts")).toBe(
      false
    );
    expect(same_module("src/models/User.ts", "src/models/Post.ts")).toBe(false);
  });

  test("handles leading slashes", () => {
    expect(same_module("/src/utils/helpers.ts", "src/utils/helpers.ts")).toBe(
      true
    );
    expect(same_module("/src/models/User.ts", "/src/models/User.js")).toBe(
      true
    );
  });
});
