/**
 * Rust integration tests for self-reference call resolution
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { Project } from "../../project/project";
import type {
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Rust Self-Reference Resolution Integration", () => {
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

  describe("self.method()", () => {
    it("should resolve self.method() in impl block", () => {
      const code = `
        struct Counter {
          count: i32,
        }

        impl Counter {
          fn new() -> Self {
            Self { count: 0 }
          }

          fn increment(&mut self) {
            self.set_count(self.count + 1);
          }

          fn set_count(&mut self, value: i32) {
            self.count = value;
          }

          fn get_count(&self) -> i32 {
            self.count
          }
        }
      `;

      const file = path.join(temp_dir, "counter.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const counter_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_struct).toBeDefined();

      const type_info = project.get_type_info(counter_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("set_count" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("get_count" as SymbolName)).toBe(true);
    });

    it("should handle self parameter borrowing patterns", () => {
      const code = `
        struct Data {
          value: String,
        }

        impl Data {
          fn get_value(&self) -> &str {
            &self.value
          }

          fn update(&mut self, new_value: String) {
            self.value = new_value;
          }

          fn process(&mut self) {
            let current = self.get_value();
            self.update(format!("Processed: {}", current));
          }
        }
      `;

      const file = path.join(temp_dir, "data.rs") as FilePath;
      project.update_file(file, code);

      const index = project.get_index_single_file(file);
      expect(index).toBeDefined();

      const data_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Data" as SymbolName)
      );
      expect(data_struct).toBeDefined();

      const type_info = project.get_type_info(data_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("get_value" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("update" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("process" as SymbolName)).toBe(true);
    });
  });
});
