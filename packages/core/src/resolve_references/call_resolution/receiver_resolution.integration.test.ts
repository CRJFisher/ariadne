/**
 * Integration test helpers for self-reference call resolution
 *
 * Shared setup and utilities for language-specific integration test files.
 * Language-specific tests live in:
 * - receiver_resolution.integration.typescript.test.ts
 * - receiver_resolution.integration.python.test.ts
 * - receiver_resolution.integration.javascript.test.ts
 * - receiver_resolution.integration.rust.test.ts
 */

import { describe, it, beforeEach, beforeAll, afterAll } from "vitest";
import { Project } from "../../project/project";
import type { FilePath } from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Creates a shared test context with a temp directory and project instance.
 * Call this inside a describe block; it registers beforeAll/afterAll/beforeEach hooks.
 */
// Vitest requires at least one test suite in .test.ts files
describe("Self-Reference Resolution Integration (shared helpers)", () => {
  it("exports create_integration_test_context", () => {
    // Verified by language-specific test files importing this helper
  });
});

export function create_integration_test_context() {
  let project: Project;
  let temp_dir: string;

  beforeAll(() => {
    temp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-test-"));
  });

  afterAll(() => {
    if (fs.existsSync(temp_dir)) {
      fs.rmSync(temp_dir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    project = new Project();
    await project.initialize(temp_dir as FilePath);
  });

  return {
    get project() {
      return project;
    },
    get temp_dir() {
      return temp_dir;
    },
  };
}
