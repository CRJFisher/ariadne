/**
 * Semantic index tests - Rust
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import type { Language } from "@ariadnejs/types";
import { query_tree_and_parse_captures } from "./semantic_index";
import { SemanticEntity } from "./capture_types";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("Semantic Index - Rust", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Rust);
  });

  describe("Rust fixtures", () => {
    it.todo("should parse Rust structs and impl blocks");
    it.todo("should parse Rust traits and trait implementations");
    it.todo("should parse Rust modules and use statements");
    it.todo("should parse Rust generics and lifetimes");
  });
});