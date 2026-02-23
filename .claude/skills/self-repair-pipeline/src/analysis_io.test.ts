import { describe, it, expect } from "vitest";
import { path_to_project_id, project_id_from_config } from "./analysis_io.js";

describe("path_to_project_id", () => {
  it("replaces slashes with dashes", () => {
    expect(path_to_project_id("/Users/chuck/workspace/foo")).toEqual(
      "-Users-chuck-workspace-foo",
    );
  });

  it("handles nested paths", () => {
    expect(
      path_to_project_id("/Users/chuck/workspace/AmazonAdv/projections"),
    ).toEqual("-Users-chuck-workspace-AmazonAdv-projections");
  });
});

describe("project_id_from_config", () => {
  it("returns explicit name for internal project (project_path='.')", () => {
    expect(project_id_from_config(".", "core")).toEqual("core");
  });

  it("throws for internal project without explicit name", () => {
    expect(() => project_id_from_config(".", undefined)).toThrow(
      "Internal project (project_path=\".\") requires explicit project_name",
    );
  });

  it("derives identifier from absolute path for external project", () => {
    expect(
      project_id_from_config("/Users/chuck/workspace/AmazonAdv/projections", undefined),
    ).toEqual("-Users-chuck-workspace-AmazonAdv-projections");
  });

  it("ignores explicit name for external project", () => {
    expect(
      project_id_from_config("/Users/chuck/workspace/AmazonAdv/projections", "projections"),
    ).toEqual("-Users-chuck-workspace-AmazonAdv-projections");
  });
});
