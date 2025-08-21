import { describe, test, expect } from "vitest";
import { Project } from "../../src/index";

describe("Project", () => {
  test("creates new instance on file add", () => {
    const project = new Project();
    const code = `
      function test() {
        return 42;
      }
    `;
    const updated = project.add_or_update_file("test.ts", code);
    expect(updated).toBe(project);
    const graph = updated.get_scope_graph("test.ts");
    expect(graph).toBeTruthy();
  });
});
