import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { FilePath, Language } from "@ariadnejs/types";
import { Project } from "../project/project";
import {
  serialize_semantic_index,
  deserialize_semantic_index,
} from "./serialize_index";
import { build_index_single_file } from "../index_single_file/index_single_file";
import type { ParsedFile } from "../index_single_file/file_utils";
import Parser from "tree-sitter";
import TypeScriptParser from "tree-sitter-typescript";

function fp(s: string): FilePath {
  return s as FilePath;
}

function parse_ts_code(content: string, file_path: string): ReturnType<typeof build_index_single_file> {
  const parser = new Parser();
  parser.setLanguage(TypeScriptParser.typescript);
  const tree = parser.parse(content);
  const lines = content.split("\n");
  const parsed: ParsedFile = {
    file_path: file_path as FilePath,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: "typescript" as Language,
  };
  return build_index_single_file(parsed, tree, "typescript" as Language);
}

// Pool of valid TypeScript code snippets for property-based testing
const TS_SNIPPETS = [
  "export function foo() { return 42; }",
  "export function bar(x: number) { return x + 1; }",
  "export class Greeter { greet() { return 'hello'; } }",
  "export const VALUE = 42;",
  "export interface Printable { print(): void; }",
  "export type ID = string | number;",
  "export enum Color { Red, Green, Blue }",
  "function internal() { return 1; }\nexport const x = internal();",
  "export function add(a: number, b: number) { return a + b; }",
  "export class Animal { name: string; constructor(name: string) { this.name = name; } }",
];

describe("Property-Based Tests", () => {
  it("round-trip identity for parsed TypeScript snippets", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TS_SNIPPETS),
        (code) => {
          const index = parse_ts_code(code, "test.ts");
          const json = serialize_semantic_index(index);
          const restored = deserialize_semantic_index(json);

          expect(restored.file_path).toEqual(index.file_path);
          expect(restored.language).toEqual(index.language);
          expect(restored.functions.size).toEqual(index.functions.size);
          expect(restored.classes.size).toEqual(index.classes.size);
          expect(restored.variables.size).toEqual(index.variables.size);
          expect(restored.references.length).toEqual(index.references.length);
          expect(restored.scopes.size).toEqual(index.scopes.size);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("cold/warm equivalence for generated file sets", () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...TS_SNIPPETS), {
          minLength: 1,
          maxLength: 4,
        }),
        async (snippets) => {
          const files = new Map<FilePath, string>();
          for (let i = 0; i < snippets.length; i++) {
            files.set(fp(`file${i}.ts`), snippets[i]);
          }

          // Cold build
          const cold = new Project();
          await cold.initialize();
          for (const [file_path, content] of files) {
            cold.update_file(file_path, content);
          }

          // Warm build (via serialize/deserialize round-trip)
          const warm = new Project();
          await warm.initialize();
          for (const [file_path, content] of files) {
            const index = cold.get_index_single_file(file_path);
            if (index) {
              const json = serialize_semantic_index(index);
              const restored = deserialize_semantic_index(json);
              warm.restore_file(file_path, content, restored);
            }
          }

          expect(warm.get_stats()).toEqual(cold.get_stats());
          expect(warm.get_call_graph().nodes.size).toEqual(
            cold.get_call_graph().nodes.size,
          );
        },
      ),
      { numRuns: 20 },
    );
  });

  it("idempotency: save, load, save, load produces same result", () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(...TS_SNIPPETS), {
          minLength: 1,
          maxLength: 3,
        }),
        async (snippets) => {
          const files = new Map<FilePath, string>();
          for (let i = 0; i < snippets.length; i++) {
            files.set(fp(`file${i}.ts`), snippets[i]);
          }

          // Build and "save" (serialize all indexes)
          const project1 = new Project();
          await project1.initialize();
          for (const [file_path, content] of files) {
            project1.update_file(file_path, content);
          }

          const saved1 = new Map<FilePath, string>();
          for (const file_path of project1.get_all_files()) {
            const index = project1.get_index_single_file(file_path);
            if (index) {
              saved1.set(file_path, serialize_semantic_index(index));
            }
          }

          // "Load" from saved
          const project2 = new Project();
          await project2.initialize();
          for (const [file_path, content] of files) {
            const json = saved1.get(file_path);
            if (json) {
              project2.restore_file(
                file_path,
                content,
                deserialize_semantic_index(json),
              );
            }
          }

          // "Save" again
          const saved2 = new Map<FilePath, string>();
          for (const file_path of project2.get_all_files()) {
            const index = project2.get_index_single_file(file_path);
            if (index) {
              saved2.set(file_path, serialize_semantic_index(index));
            }
          }

          // The serialized data should be identical
          expect(saved2.size).toEqual(saved1.size);
          for (const [file_path, json1] of saved1) {
            expect(saved2.get(file_path)).toEqual(json1);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
