import { describe, it, expect } from "vitest";
import { path_to_project_id } from "./analysis_io.js";

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
