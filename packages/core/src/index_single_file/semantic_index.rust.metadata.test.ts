/**
 * Rust Semantic Index Metadata Integration Tests
 *
 * Tests that verify Rust metadata extractors are properly integrated
 * into the semantic index pipeline.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { Language, FilePath } from "@ariadnejs/types";
import { build_semantic_index } from "./semantic_index";
import type { ParsedFile } from "./file_utils";

// Helper to create ParsedFile
function createParsedFile(
  code: string,
  filePath: FilePath,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = code.split('\n');
  return {
    file_path: filePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language
  };
}

describe("Rust Semantic Index - Metadata Integration", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  describe("Type metadata extraction", () => {
    it("should extract type info from function parameter type annotations", () => {
      const code = `
fn greet(name: &str, age: u32) -> String {
    format!("Hello {}, you are {} years old", name, age)
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Debug: log all references to understand what's being captured
      // console.log("All references:", index.references.map(r => ({ type: r.type, name: r.name })));

      // Check that type references were extracted
      const type_refs = index.references.filter(r => r.type === "type");
      expect(type_refs.length).toBeGreaterThan(0);

      // Check that type_info is populated (this proves extractors are working)
      const types_with_info = type_refs.filter(r => r.type_info);
      expect(types_with_info.length).toBeGreaterThan(0);

      // Verify type info structure
      const first_type = types_with_info[0];
      expect(first_type.type_info).toBeDefined();
      expect(first_type.type_info?.type_name).toBeDefined();
      expect(first_type.type_info?.certainty).toBe("declared");
    });

    it("should extract type info from variable annotations", () => {
      const code = `
fn main() {
    let count: i32 = 0;
    let name: String = String::from("Alice");
    let items: Vec<String> = Vec::new();
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      const type_refs = index.references.filter(r => r.type === "type");
      const types_with_info = type_refs.filter(r => r.type_info);

      expect(types_with_info.length).toBeGreaterThan(0);

      // Check that at least one type has proper metadata
      const has_valid_type = types_with_info.some(t =>
        t.type_info?.type_name && t.type_info.certainty === "declared"
      );
      expect(has_valid_type).toBe(true);
    });

    it("should handle generic types", () => {
      const code = `
use std::collections::HashMap;

fn process(items: Vec<String>, mapping: HashMap<String, i32>) -> Option<String> {
    None
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      const type_refs = index.references.filter(r => r.type === "type");
      const types_with_info = type_refs.filter(r => r.type_info);

      // Check that we have type references with metadata
      expect(types_with_info.length).toBeGreaterThan(0);

      // Check that type_name is extracted
      const types_with_names = types_with_info.filter(t => t.type_info?.type_name);
      expect(types_with_names.length).toBeGreaterThan(0);
    });
  });

  describe("Basic integration", () => {
    it("should successfully wire Rust extractors into semantic index", () => {
      const code = `
fn main() {
    let x: i32 = 42;
    let y: String = String::from("hello");
}
`;
      const tree = parser.parse(code);
      const file_path = "test.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Basic integration checks
      expect(index).toBeDefined();
      expect(index.language).toBe("rust");
      expect(index.file_path).toBe(file_path);

      // Check that references exist
      expect(index.references.length).toBeGreaterThan(0);

      // Check that type references are extracted
      const type_refs = index.references.filter(r => r.type === "type");

      // If we have type refs, verify metadata extraction is working
      if (type_refs.length > 0) {
        const types_with_info = type_refs.filter(r => r.type_info);
        expect(types_with_info.length).toBeGreaterThan(0);

        // Verify at least one type has proper Rust type info
        const rust_type = types_with_info.find(t => t.type_info?.type_name === "i32");
        if (rust_type) {
          expect(rust_type.type_info?.certainty).toBe("declared");
        }
      }
    });
  });

  describe("Integration validation", () => {
    it("should properly integrate Rust extractors into semantic index pipeline", () => {
      const code = `
use std::collections::HashMap;

#[derive(Debug, Clone)]
struct Config {
    settings: HashMap<String, String>,
    version: u32,
}

impl Config {
    fn new() -> Self {
        Config {
            settings: HashMap::new(),
            version: 1,
        }
    }

    fn get(&self, key: &str) -> Option<&String> {
        self.settings.get(key)
    }

    fn set(&mut self, key: String, value: String) {
        self.settings.insert(key, value);
    }
}

fn main() {
    let mut config = Config::new();
    config.set(String::from("theme"), String::from("dark"));

    if let Some(theme) = config.get("theme") {
        println!("Current theme: {}", theme);
    }
}
`;
      const tree = parser.parse(code);
      const file_path = "config.rs" as FilePath;
      const parsed_file = createParsedFile(code, file_path, tree, "rust");

      const index = build_semantic_index(parsed_file, tree, "rust");

      // Comprehensive checks
      expect(index).toBeDefined();
      expect(index.language).toBe("rust");
      expect(index.file_path).toBe(file_path);

      // Check that various reference types are captured
      const type_refs = index.references.filter(r => r.type === "type");
      const call_refs = index.references.filter(r => r.type === "call");

      expect(type_refs.length).toBeGreaterThan(0);
      expect(call_refs.length).toBeGreaterThan(0);

      // Check that metadata is being extracted
      const refs_with_metadata = index.references.filter(r => r.type_info);
      expect(refs_with_metadata.length).toBeGreaterThan(0);

      // Verify Rust-specific metadata
      const rust_types = type_refs.filter(r => r.type_info?.type_name);
      expect(rust_types.length).toBeGreaterThan(0);

      // Verify certainty is set correctly
      const declared_types = rust_types.filter(r => r.type_info?.certainty === "declared");
      expect(declared_types.length).toBeGreaterThan(0);
    });
  });
});