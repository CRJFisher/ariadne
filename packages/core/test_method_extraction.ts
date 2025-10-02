import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import { build_semantic_index } from "./src/index_single_file/semantic_index";
import { FilePath } from "@ariadnejs/types";

const parser = new Parser();
parser.setLanguage(Rust);

const code = `
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
    fn new(width: u32, height: u32) -> Self {
        Rectangle { width, height }
    }

    fn area(&self) -> u32 {
        self.width * self.height
    }
}
`;

const tree = parser.parse(code);
const file_path = "test.rs" as FilePath;
const parsed_file = {
  file_path,
  content: code,
  tree,
  language: "rust" as const,
};

const index = build_semantic_index(parsed_file, tree, "rust");

console.log("=== CLASSES ===");
for (const [id, cls] of index.classes.entries()) {
  console.log("Class:", cls.name);
  console.log("  ID:", id);
  console.log("  Methods:", cls.methods.length);
  cls.methods.forEach((m: any) => {
    console.log("    -", m.name, "(static:", m.static, ")");
  });
}
