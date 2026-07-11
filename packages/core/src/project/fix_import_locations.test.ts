import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import type { AnyDefinition, FilePath, ImportDefinition, SymbolName } from "@ariadnejs/types";

function get_original_import(
  project: Project,
  file: FilePath,
  name: string
): ImportDefinition {
  const matches = Array.from(
    project.get_index_single_file(file)!.imported_symbols.values()
  ).filter((imp) => imp.name === (name as SymbolName));
  expect(matches).toHaveLength(1);
  return matches[0];
}

function get_fixed_import(
  project: Project,
  file: FilePath,
  name: string
): ImportDefinition {
  const original = get_original_import(project, file, name);
  const fixed = project.definitions.get(original.symbol_id);
  expect(fixed?.kind).toBe("import");
  return fixed as ImportDefinition;
}

function get_definition(project: Project, name: string): AnyDefinition {
  const matches = project.definitions
    .get_definitions_by_name(name as SymbolName)
    .filter((def) => def.kind !== "import");
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe("fix_import_definition_locations", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  it("points a named import at the exported definition's location", () => {
    project.update_file(
      "src/source.ts" as FilePath,
      "export function target() { return 42; }"
    );
    const consumer = "src/consumer.ts" as FilePath;
    project.update_file(
      consumer,
      `import { target } from "./source";
      const x = target();`
    );

    const import_def = get_fixed_import(project, consumer, "target");
    const source_def = get_definition(project, "target");

    expect(import_def.location).toEqual(source_def.location);
  });

  it("points an aliased import at the original definition's location", () => {
    project.update_file(
      "src/source.ts" as FilePath,
      "export function original() { return 1; }"
    );
    const consumer = "src/consumer.ts" as FilePath;
    project.update_file(
      consumer,
      `import { original as aliased } from "./source";
      const x = aliased();`
    );

    const import_def = get_fixed_import(project, consumer, "aliased");
    const source_def = get_definition(project, "original");

    expect(import_def.original_name).toBe("original" as SymbolName);
    expect(import_def.location).toEqual(source_def.location);
  });

  it("points a namespace import at the module file, preserving the import site position", () => {
    project.update_file(
      "src/util.ts" as FilePath,
      "export function foo() {}"
    );
    const consumer = "src/main.ts" as FilePath;
    project.update_file(
      consumer,
      `import * as util from "./util";
      util.foo();`
    );

    const original = get_original_import(project, consumer, "util");
    const import_def = get_fixed_import(project, consumer, "util");

    expect(import_def.import_kind).toBe("namespace");
    expect(import_def.location).toEqual({
      file_path: "src/util.ts" as FilePath,
      start_line: original.location.start_line,
      start_column: original.location.start_column,
      end_line: original.location.end_line,
      end_column: original.location.end_column,
    });
  });

  it("leaves the import location unchanged when the module path does not resolve", () => {
    const consumer = "src/consumer.ts" as FilePath;
    project.update_file(
      consumer,
      `import { missing } from "./nonexistent";
      const x = missing();`
    );

    const original = get_original_import(project, consumer, "missing");
    const import_def = get_fixed_import(project, consumer, "missing");

    expect(import_def.location).toEqual(original.location);
    expect(import_def.location.file_path).toBe(consumer);
  });

  it("leaves the import location unchanged when the resolved module does not export the name", () => {
    project.update_file(
      "src/source.ts" as FilePath,
      "export function present() {}"
    );
    const consumer = "src/consumer.ts" as FilePath;
    project.update_file(
      consumer,
      `import { absent } from "./source";
      const x = absent();`
    );

    const original = get_original_import(project, consumer, "absent");
    const import_def = get_fixed_import(project, consumer, "absent");

    expect(import_def.location).toEqual(original.location);
    expect(import_def.location.file_path).toBe(consumer);
  });

  it("points a re-exported name through the barrel to its original source", () => {
    project.update_file(
      "src/origin.ts" as FilePath,
      "export function widget() {}"
    );
    project.update_file(
      "src/barrel.ts" as FilePath,
      "export { widget } from \"./origin\";"
    );
    const consumer = "src/consumer.ts" as FilePath;
    project.update_file(
      consumer,
      `import { widget } from "./barrel";
      const x = widget();`
    );

    const import_def = get_fixed_import(project, consumer, "widget");

    expect(import_def.location.file_path).toBe("src/origin.ts" as FilePath);
  });
});
