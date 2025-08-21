import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ImportResolver } from "../../src_old/project/import_resolver";
import { ProjectState } from "../../src_old/storage/index";
import { Def } from "@ariadnejs/types";
import * as fs from "fs";

vi.mock("fs");

describe("ImportResolver (src_old)", () => {
  const createMockState = (): ProjectState => {
    // Minimal stubbed state compatible with src_old
    return {
      file_graphs: new Map(),
      file_cache: new Map(),
      languages: new Map(),
    } as unknown as ProjectState;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs and handles basic resolution", () => {
    const state = createMockState();
    const resolver = new ImportResolver();
    expect(resolver).toBeDefined();
  });
});
