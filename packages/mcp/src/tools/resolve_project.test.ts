import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve_project } from "./resolve_project";
import type { ProjectManager } from "../project_manager";
import { Project } from "@ariadnejs/core";

import { load_project } from "@ariadnejs/core";

vi.mock("@ariadnejs/core", async () => {
  const actual = await vi.importActual<typeof import("@ariadnejs/core")>("@ariadnejs/core");
  return {
    ...actual,
    load_project: vi.fn(),
  };
});

describe("resolve_project", () => {
  let mock_project_manager: ProjectManager;
  let persistent_project: Project;

  beforeEach(() => {
    persistent_project = {} as Project;
    mock_project_manager = {
      get_project: vi.fn().mockReturnValue(persistent_project),
    } as unknown as ProjectManager;
    vi.clearAllMocks();
  });

  it("should return persistent project when no filters specified", async () => {
    const result = await resolve_project({}, mock_project_manager, "/project");

    expect(result).toBe(persistent_project);
    expect(mock_project_manager.get_project).toHaveBeenCalled();
    expect(load_project).not.toHaveBeenCalled();
  });

  it("should return persistent project when filters are empty arrays", async () => {
    const result = await resolve_project(
      { files: [], folders: [] },
      mock_project_manager,
      "/project",
    );

    expect(result).toBe(persistent_project);
    expect(load_project).not.toHaveBeenCalled();
  });

  it("should create scoped project when files filter is provided", async () => {
    const scoped_project = {} as Project;
    vi.mocked(load_project).mockResolvedValue(scoped_project);

    const result = await resolve_project(
      { files: ["src/main.ts"] },
      mock_project_manager,
      "/project",
    );

    expect(result).toBe(scoped_project);
    expect(load_project).toHaveBeenCalledWith({
      project_path: "/project",
      files: ["src/main.ts"],
      folders: undefined,
    });
    expect(mock_project_manager.get_project).not.toHaveBeenCalled();
  });

  it("should create scoped project when folders filter is provided", async () => {
    const scoped_project = {} as Project;
    vi.mocked(load_project).mockResolvedValue(scoped_project);

    const result = await resolve_project(
      { folders: ["src/"] },
      mock_project_manager,
      "/project",
    );

    expect(result).toBe(scoped_project);
    expect(load_project).toHaveBeenCalledWith({
      project_path: "/project",
      files: undefined,
      folders: ["src/"],
    });
  });
});
