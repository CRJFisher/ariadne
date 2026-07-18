import { describe, it, expect } from "vitest";
import {
  CANONICAL_PATH,
  DefinitionSite,
  SINGLETON_INSTRUCTION,
  find_definition_lines,
  find_singleton_offenders,
  format_violation,
  is_scannable_source_path,
} from "./detect_language_singleton.js";

describe("find_definition_lines", () => {
  it("matches the canonical function definition", () => {
    expect(
      find_definition_lines(
        "export function detect_language(file_path: string): Language | null {",
      ),
    ).toEqual([1]);
  });

  it("matches an async function definition", () => {
    expect(
      find_definition_lines(
        "export async function detect_language(file_path: string) {",
      ),
    ).toEqual([1]);
  });

  it("matches a const arrow definition", () => {
    expect(
      find_definition_lines(
        "const detect_language = (file_path: string): Language | null => null;",
      ),
    ).toEqual([1]);
  });

  it("matches a type-annotated const definition", () => {
    expect(
      find_definition_lines(
        "export const detect_language: Detector = (file_path) => null;",
      ),
    ).toEqual([1]);
  });

  it("ignores an import line", () => {
    expect(
      find_definition_lines(
        'import { detect_language } from "@ariadnejs/core";',
      ),
    ).toEqual([]);
  });

  it("ignores a re-export line", () => {
    expect(
      find_definition_lines(
        'export { detect_language } from "./detect_language.js";',
      ),
    ).toEqual([]);
  });

  it("ignores a call site", () => {
    expect(
      find_definition_lines("const language = detect_language(file_path);"),
    ).toEqual([]);
  });

  it("ignores a dist declaration line", () => {
    expect(
      find_definition_lines(
        "export declare function detect_language(file_path: string): Language | null;",
      ),
    ).toEqual([]);
  });

  it("ignores similarly named symbols", () => {
    expect(
      find_definition_lines(
        [
          "const detect_language_map = {};",
          "function detect_language_helper(file_path: string) {}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("ignores a commented-out definition", () => {
    expect(
      find_definition_lines("  // const detect_language = legacy;"),
    ).toEqual([]);
  });

  it("reports each definition line in a multi-definition file", () => {
    const content = [
      "export function detect_language(file_path: string): Language | null {",
      "}",
      "const detect_language = (file_path: string) => null;",
    ].join("\n");
    expect(find_definition_lines(content)).toEqual([1, 3]);
  });
});

describe("is_scannable_source_path", () => {
  it("includes package source ts files", () => {
    expect(is_scannable_source_path("packages/core/src/detect_language.ts")).toEqual(
      true,
    );
  });

  it("excludes test files", () => {
    expect(
      is_scannable_source_path("packages/core/src/detect_language.test.ts"),
    ).toEqual(false);
  });

  it("excludes dist output", () => {
    expect(
      is_scannable_source_path("packages/core/dist/detect_language.d.ts"),
    ).toEqual(false);
  });

  it("excludes declaration files outside dist", () => {
    expect(is_scannable_source_path("packages/core/src/globals.d.ts")).toEqual(
      false,
    );
  });

  it("excludes node_modules", () => {
    expect(
      is_scannable_source_path("packages/core/node_modules/pkg/index.ts"),
    ).toEqual(false);
  });

  it("excludes paths outside packages", () => {
    expect(is_scannable_source_path(".claude/hooks/utils.ts")).toEqual(false);
  });
});

describe("find_singleton_offenders", () => {
  it("returns nothing when the only definition is canonical", () => {
    expect(
      find_singleton_offenders([{ file: CANONICAL_PATH, line: 10 }]),
    ).toEqual([]);
  });

  it("returns nothing when no definitions exist", () => {
    expect(find_singleton_offenders([])).toEqual([]);
  });

  it("flags a second definition outside the canonical file", () => {
    const foreign: DefinitionSite = { file: "packages/mcp/src/lang.ts", line: 5 };
    expect(
      find_singleton_offenders([{ file: CANONICAL_PATH, line: 10 }, foreign]),
    ).toEqual([foreign]);
  });

  it("flags a sole definition that lives outside the canonical file", () => {
    const foreign: DefinitionSite = { file: "packages/mcp/src/lang.ts", line: 5 };
    expect(find_singleton_offenders([foreign])).toEqual([foreign]);
  });

  it("flags every canonical site when the canonical file holds duplicates", () => {
    expect(
      find_singleton_offenders([
        { file: CANONICAL_PATH, line: 10 },
        { file: CANONICAL_PATH, line: 42 },
      ]),
    ).toEqual([
      { file: CANONICAL_PATH, line: 10 },
      { file: CANONICAL_PATH, line: 42 },
    ]);
  });
});

describe("format_violation", () => {
  it("renders each offending file:line with the singleton instruction", () => {
    expect(
      format_violation([
        { file: "packages/mcp/src/lang.ts", line: 5 },
        { file: "packages/core/src/other.ts", line: 12 },
      ]),
    ).toEqual(
      "detect_language is defined in more than one place or outside its canonical home:\n" +
        "  packages/mcp/src/lang.ts:5\n" +
        "  packages/core/src/other.ts:12\n\n" +
        SINGLETON_INSTRUCTION,
    );
  });
});
