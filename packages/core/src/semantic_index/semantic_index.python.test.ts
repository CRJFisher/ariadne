/**
 * Semantic index tests - Python
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { Language } from "@ariadnejs/types";
import { query_tree_and_parse_captures } from "./semantic_index";
import { SemanticEntity } from "./capture_types";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("Semantic Index - Python", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(Python);
  });

  describe("Python fixtures", () => {
    it.todo("should parse Python classes and methods");
    it.todo("should parse Python decorators");
    it.todo("should parse Python imports (from/import)");
    it.todo("should parse Python type hints");
  });
});