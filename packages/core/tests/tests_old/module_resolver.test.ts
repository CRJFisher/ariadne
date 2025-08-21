import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { ModuleResolver } from "../../src_old/module_resolver";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("ModuleResolver (src_old)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-old-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("exists for backward-compat scaffolding", () => {
    expect(typeof ModuleResolver).toBe("function");
  });
});
