
import { describe, it, expect, beforeEach } from "vitest";
import { Project } from "./project";
import path from "path";
import type { FilePath, SymbolName } from "@ariadnejs/types";

import fs from "fs";
import os from "os";

// Create temp directory for tests
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-test-")) as FilePath;

describe("Project Integration - Collection Resolution", () => {
  let project: Project;

  beforeEach(async () => {
    project = new Project();
    await project.initialize(TEMP_ROOT);
  });

  describe("Python Support", () => {
    it("should resolve call to derived variable to collection functions", async () => {
      const code = `
def fn1(): pass
def fn2(): pass
handlers = [fn1, fn2]
handler = handlers[0]
handler()
`;
      const file = path.join(TEMP_ROOT, "test.py") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find the call to handler()
      const calls = project.resolutions.get_file_calls(file);
      const handler_call = calls.find(c => c.name === "handler");
      
      expect(handler_call).toBeDefined();
      expect(handler_call?.resolutions.length).toBe(2);
      
      const resolved_names = handler_call?.resolutions.map(r => {
        const def = project.definitions.get(r.symbol_id);
        return def?.name;
      });
      
      expect(resolved_names).toContain("fn1");
      expect(resolved_names).toContain("fn2");
    });
  });

  describe("Rust Support", () => {
    it("should resolve call to derived variable to collection functions", async () => {
      const code = `
fn fn1() {}
fn fn2() {}
fn main() {
    let handlers = vec![fn1, fn2];
    let handler = handlers[0];
    handler();
}
`;
      const file = path.join(TEMP_ROOT, "test.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      // Find the call to handler()
      const calls = project.resolutions.get_file_calls(file);
      const handler_call = calls.find(c => c.name === "handler");
      
      expect(handler_call).toBeDefined();
      expect(handler_call?.resolutions.length).toBe(2);
      
      const resolved_names = handler_call?.resolutions.map(r => {
        const def = project.definitions.get(r.symbol_id);
        return def?.name;
      });
      
      expect(resolved_names).toContain("fn1");
      expect(resolved_names).toContain("fn2");
    });
  });
});
