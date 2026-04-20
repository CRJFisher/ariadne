import { describe, it, expect, beforeEach } from "vitest";
import type { FilePath, SymbolName } from "@ariadnejs/types";
import { Project } from "../project/project";
import { list_name_collisions } from "./list_name_collisions";

describe("list_name_collisions", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize();
  });

  it("returns all definitions when the same name is defined in multiple files", () => {
    project.update_file(
      "a.ts" as FilePath,
      "export function process_data() { return 1; }\n"
    );
    project.update_file(
      "b.ts" as FilePath,
      "export function process_data() { return 2; }\n"
    );

    const matches = list_name_collisions(project, "process_data" as SymbolName);

    expect(matches.length).toBe(2);
    const files = matches.map((d) => d.location.file_path).sort();
    expect(files).toEqual(["a.ts", "b.ts"]);
    for (const def of matches) {
      expect(def.kind).toBe("function");
      expect(def.name).toBe("process_data");
    }
  });

  it("returns a single definition when the name is unique in the project", () => {
    project.update_file(
      "a.ts" as FilePath,
      "export function singleton() { return 1; }\n"
    );

    const matches = list_name_collisions(project, "singleton" as SymbolName);

    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe("singleton");
  });

  it("returns an empty array when the name is not defined anywhere", () => {
    project.update_file(
      "a.ts" as FilePath,
      "export function something_else() { return 1; }\n"
    );

    const matches = list_name_collisions(project, "does_not_exist" as SymbolName);

    expect(matches).toEqual([]);
  });

  it("returns same-named methods across multiple classes (name-keyed, not kind-filtered)", () => {
    project.update_file(
      "a.ts" as FilePath,
      "export class A { run() { return \"a\"; } }\n"
    );
    project.update_file(
      "b.ts" as FilePath,
      "export class B { run() { return \"b\"; } }\n"
    );
    project.update_file(
      "c.ts" as FilePath,
      "export class C { run() { return \"c\"; } }\n"
    );

    const matches = list_name_collisions(project, "run" as SymbolName);

    expect(matches.length).toBe(3);
    for (const def of matches) {
      expect(def.kind).toBe("method");
      expect(def.name).toBe("run");
    }
    const files = matches.map((d) => d.location.file_path).sort();
    expect(files).toEqual(["a.ts", "b.ts", "c.ts"]);
  });
});
