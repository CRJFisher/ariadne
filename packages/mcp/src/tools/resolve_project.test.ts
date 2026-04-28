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
  let mock_project_manager: Pick<ProjectManager, "get_project">;
  let persistent_project: Project;

  beforeEach(() => {
    persistent_project = {} as Project;
    mock_project_manager = {
      get_project: vi.fn().mockReturnValue(persistent_project),
    };
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

  it("throws when a files entry is outside the project root", async () => {
    await expect(
      resolve_project(
        { files: ["/tmp/elsewhere/foo.ts"] },
        mock_project_manager,
        "/project",
      ),
    ).rejects.toThrow(/outside the loaded project root '\/project'/);
    expect(load_project).not.toHaveBeenCalled();
  });

  it("throws when a folders entry is outside the project root", async () => {
    await expect(
      resolve_project(
        { folders: ["/tmp/elsewhere"] },
        mock_project_manager,
        "/project",
      ),
    ).rejects.toThrow(/outside the loaded project root '\/project'/);
    expect(load_project).not.toHaveBeenCalled();
  });

  it("throws when a relative folders entry escapes via ..", async () => {
    await expect(
      resolve_project(
        { folders: ["../escape"] },
        mock_project_manager,
        "/project",
      ),
    ).rejects.toThrow(/outside the loaded project root/);
    expect(load_project).not.toHaveBeenCalled();
  });

  it("throws for an empty-string files entry", async () => {
    await expect(
      resolve_project(
        { files: [""] },
        mock_project_manager,
        "/project",
      ),
    ).rejects.toThrow(/files entry must not be empty/);
    expect(load_project).not.toHaveBeenCalled();
  });

  it("throws for a whitespace-only folders entry", async () => {
    await expect(
      resolve_project(
        { folders: ["   "] },
        mock_project_manager,
        "/project",
      ),
    ).rejects.toThrow(/folders entry must not be empty/);
    expect(load_project).not.toHaveBeenCalled();
  });

  it("accepts an absolute files entry inside the project root", async () => {
    const scoped_project = {} as Project;
    vi.mocked(load_project).mockResolvedValue(scoped_project);

    const result = await resolve_project(
      { files: ["/project/src/main.ts"] },
      mock_project_manager,
      "/project",
    );

    expect(result).toBe(scoped_project);
    expect(load_project).toHaveBeenCalled();
  });
});
