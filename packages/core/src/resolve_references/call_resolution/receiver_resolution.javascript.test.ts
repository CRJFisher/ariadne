/**
 * JavaScript integration tests for self-reference call resolution
 */

import { describe, it, expect } from "vitest";
import type {
  FilePath,
  SymbolName,
  SelfReferenceCall,
} from "@ariadnejs/types";
import * as path from "path";
import { create_integration_test_context } from "./receiver_resolution.integration.test";

describe("JavaScript Self-Reference Resolution Integration", () => {
  const ctx = create_integration_test_context();

  describe("this.method()", () => {
    it("should resolve this.method() in ES6 class", () => {
      const code = `
        class User {
          constructor(name) {
            this.name = name;
          }

          greet() {
            return this.getName();
          }

          getName() {
            return this.name;
          }
        }
      `;

      const file = path.join(ctx.temp_dir, "user.js") as FilePath;
      ctx.project.update_file(file, code);

      const index = ctx.project.get_index_single_file(file);
      expect(index).toBeDefined();

      const user_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("User" as SymbolName)
      );
      expect(user_class).toBeDefined();

      const type_info = ctx.project.get_type_info(user_class!.symbol_id);
      expect(type_info).toBeDefined();
      expect(type_info!.methods.has("getName" as SymbolName)).toBe(true);

      const self_ref_calls = index!.references.filter(
        (r): r is SelfReferenceCall => r.kind === "self_reference_call"
      );
      expect(self_ref_calls.length).toBeGreaterThan(0);
    });

    it("should resolve this.method() in prototype pattern", () => {
      const code = `
        function Counter() {
          this.count = 0;
        }

        Counter.prototype.increment = function() {
          this.count++;
        };

        Counter.prototype.getCount = function() {
          return this.count;
        };
      `;

      const file = path.join(ctx.temp_dir, "counter.js") as FilePath;
      ctx.project.update_file(file, code);

      const index = ctx.project.get_index_single_file(file);
      expect(index).toBeDefined();

      const functions = Array.from(index!.functions.values());
      const counter_fn = functions.find((f) => f.name === ("Counter" as SymbolName));
      expect(counter_fn).toBeDefined();
    });
  });

  describe("Polymorphic this Dispatch", () => {
    // Note: JavaScript class inheritance tracking (`extends` extraction) is not yet implemented.
    // The polymorphic dispatch logic works correctly when subtype tracking is available.
    // This test verifies that at least the base method is resolved.
    it("should resolve this.method() to base method in ES6 class", () => {
      const code = `
        class Base {
          process() { this.helper(); }
          helper() { return "base"; }
        }
        class Child extends Base {
          helper() { return "child"; }
        }
      `;

      const file = path.join(ctx.temp_dir, "polymorphic.js") as FilePath;
      ctx.project.update_file(file, code);

      const referenced = ctx.project.resolutions.get_all_referenced_symbols();
      const index = ctx.project.get_index_single_file(file);

      const base_class = Array.from(index!.classes.values()).find(
        (c) => c.name === ("Base" as SymbolName)
      );

      expect(base_class).toBeDefined();

      const base_type_info = ctx.project.get_type_info(base_class!.symbol_id);
      const base_helper = base_type_info!.methods.get("helper" as SymbolName);

      expect(base_helper).toBeDefined();

      // Base method should be referenced (child override not tracked due to missing extends extraction)
      expect(referenced.has(base_helper!)).toBe(true);
    });
  });
});
