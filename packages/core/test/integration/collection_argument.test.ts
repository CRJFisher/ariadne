/**
 * Integration test for collection argument resolution
 *
 * Tests that function collections passed as arguments are correctly detected
 * and all stored functions are marked as called.
 */

import { describe, test, expect } from "vitest";
import { build_project_call_graph } from "../../src/project";
import type { Language, FileInput } from "@ariadnejs/types";

describe("Collection Argument Resolution", () => {
  test("marks collection contents as called when passed as argument", () => {
    const files: FileInput[] = [
      {
        path: "/test/handlers.ts",
        content: `
          function handleAdd(x: number) {
            console.log("add", x);
          }

          function handleSubtract(x: number) {
            console.log("subtract", x);
          }

          const HANDLERS = {
            add: handleAdd,
            subtract: handleSubtract,
          };

          function processOperations(operations: string[], handlers: any) {
            for (const op of operations) {
              const handler = handlers[op];
              if (handler) handler(1);
            }
          }

          // This call should mark handleAdd and handleSubtract as called
          processOperations(["add"], HANDLERS);
        `,
        language: "typescript" as Language,
      },
    ];

    const call_graph = build_project_call_graph(files);

    // Get entry points (functions that are never called)
    const entry_points = call_graph.nodes.filter(node => node.callers.size === 0);
    const entry_point_names = entry_points.map(node => node.name);

    // handleAdd and handleSubtract should NOT be entry points
    // because they're in HANDLERS which is passed to processOperations
    expect(entry_point_names).not.toContain("handleAdd");
    expect(entry_point_names).not.toContain("handleSubtract");

    // processOperations IS an entry point (called at top level)
    // handleAdd and handleSubtract should have callers
    const handleAdd = call_graph.nodes.find(n => n.name === "handleAdd");
    const handleSubtract = call_graph.nodes.find(n => n.name === "handleSubtract");

    expect(handleAdd).toBeDefined();
    expect(handleSubtract).toBeDefined();
    expect(handleAdd!.callers.size).toBeGreaterThan(0);
    expect(handleSubtract!.callers.size).toBeGreaterThan(0);
  });

  test("resolves spread references transitively", () => {
    const files: FileInput[] = [
      {
        path: "/test/handlers.ts",
        content: `
          function baseHandler() {
            console.log("base");
          }

          function extendedHandler() {
            console.log("extended");
          }

          const BASE_HANDLERS = {
            base: baseHandler,
          };

          const EXTENDED_HANDLERS = {
            ...BASE_HANDLERS,
            extended: extendedHandler,
          };

          function dispatch(registry: any) {
            registry.base();
            registry.extended();
          }

          dispatch(EXTENDED_HANDLERS);
        `,
        language: "typescript" as Language,
      },
    ];

    const call_graph = build_project_call_graph(files);

    const entry_points = call_graph.nodes.filter(node => node.callers.size === 0);
    const entry_point_names = entry_points.map(node => node.name);

    // Both handlers should be marked as called via the spread operator
    expect(entry_point_names).not.toContain("baseHandler");
    expect(entry_point_names).not.toContain("extendedHandler");
  });
});
