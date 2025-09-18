/**
 * Semantic index tests - TypeScript
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { Language } from "@ariadnejs/types";
import { query_tree_and_parse_captures } from "./semantic_index";
import { SemanticEntity } from "./capture_types";

const FIXTURES_DIR = join(__dirname, "fixtures");

describe("Semantic Index - TypeScript", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.tsx);
  });

  describe("TypeScript fixtures", () => {
    it.todo("should parse TypeScript class with interfaces");
    it.todo("should parse TypeScript generics");
    it.todo("should parse TypeScript decorators");
    it.todo("should parse TypeScript type imports/exports");
  });
});