import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { FilePath } from "@ariadnejs/types";
import { build_semantic_index } from "./index_single_file/semantic_index";
import type { ParsedFile } from "./index_single_file/file_utils";

function create_parsed_file(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: "python"
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

describe("Debug Python Decorators", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  it("should debug decorator extraction for classmethod", () => {
    const code = `class User:
    @classmethod
    def from_dict(cls, data: dict) -> 'User':
        return cls(data['name'])
`;
    const tree = parser.parse(code);
    const file_path = "test.py" as FilePath;
    const parsed_file = create_parsed_file(code, file_path, tree, "python");

    const index = build_semantic_index(parsed_file, tree, "python");

    console.log("\n=== CLASSES ===");
    for (const cls of index.classes.values()) {
      console.log("Class:", cls.name);
      console.log("Methods:", cls.methods.map(m => ({
        name: m.name,
        decorators: m.decorators,
        abstract: m.abstract,
      })));
    }

    const user_class = Array.from(index.classes.values()).find(
      (c) => c.name === "User"
    );

    expect(user_class).toBeDefined();

    const class_method = user_class?.methods.find(
      (m) => m.name === "from_dict"
    );

    console.log("\n=== CLASS_METHOD ===");
    console.log("Method found:", !!class_method);
    if (class_method) {
      console.log("Name:", class_method.name);
      console.log("Decorators:", class_method.decorators);
      console.log("Abstract:", class_method.abstract);
      console.log("Static:", class_method.static);
    }

    expect(class_method).toBeDefined();
    console.log("\n=== DECORATOR EXPECTATION ===");
    console.log("decorators field:", class_method?.decorators);
    console.log("typeof decorators:", typeof class_method?.decorators);
  });
});
