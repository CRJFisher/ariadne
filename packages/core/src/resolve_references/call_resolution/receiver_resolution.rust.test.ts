/**
 * Rust integration tests for self-reference call resolution
 */

import { describe, it, expect } from "vitest";
import type {
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import * as path from "path";
import { create_integration_test_context } from "./receiver_resolution.integration.test";

describe("Rust Self-Reference Resolution Integration", () => {
  const ctx = create_integration_test_context();

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

      const file = path.join(ctx.temp_dir, "counter.rs") as FilePath;
      ctx.project.update_file(file, code);

      const index = ctx.project.get_index_single_file(file);
      expect(index).toBeDefined();

      const counter_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Counter" as SymbolName)
      );
      expect(counter_struct).toBeDefined();

      const type_info = ctx.project.get_type_info(counter_struct!.symbol_id);
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

      const file = path.join(ctx.temp_dir, "data.rs") as FilePath;
      ctx.project.update_file(file, code);

      const index = ctx.project.get_index_single_file(file);
      expect(index).toBeDefined();

      const data_struct = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Data" as SymbolName)
      );
      expect(data_struct).toBeDefined();

      const type_info = ctx.project.get_type_info(data_struct!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("get_value" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("update" as SymbolName)).toBe(true);
      expect(type_info!.methods.has("process" as SymbolName)).toBe(true);
    });
  });
});
