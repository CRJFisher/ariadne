import { describe, it, expect } from "vitest";
import { build_local_type_context, get_variable_type, get_expression_type } from "./local_type_context";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import { class_symbol, method_symbol, location_key } from "@ariadnejs/types";

describe("Local Type Context", () => {
  const test_location = {
    file_path: "/test.ts" as any,
    start_position: { row: 1, column: 0, offset: 0 },
    end_position: { row: 1, column: 10, offset: 10 },
  };

  const user_class = class_symbol("User", "/test.ts", test_location);
  const admin_class = class_symbol("Admin", "/test.ts", test_location);

  it("should track constructor calls", () => {
    const indices = new Map<string, SemanticIndex>([
      ["/test.ts", {
        classes: new Map([[user_class, {
          id: user_class,
          name: "User" as any,
          kind: "class" as const,
          location: test_location,
          scope_id: "scope1" as any,
          availability: { scope: "public" as const },
        }]]),
        local_type_flow: {
          constructor_calls: [{
            class_name: "User" as any,
            location: test_location,
            assigned_to: "user",
            scope_id: "scope1" as any,
          }],
        },
      } as any]
    ]);

    const imports = new Map();
    const context = build_local_type_context(indices, imports);

    const file_context = context.get("/test.ts" as any);
    expect(file_context).toBeDefined();

    // Check variable tracking
    expect(file_context?.variable_types.get("user")).toBe(user_class);

    // Check expression tracking
    expect(file_context?.expression_types.get(location_key(test_location))).toBe(user_class);

    // Check constructor calls
    expect(file_context?.constructor_calls).toHaveLength(1);
    expect(file_context?.constructor_calls[0].class_id).toBe(user_class);
    expect(file_context?.constructor_calls[0].assigned_to).toBe("user");
  });

  it("should resolve imported class constructors", () => {
    const indices = new Map<string, SemanticIndex>([
      ["/test.ts", {
        classes: new Map(),
        local_type_flow: {
          constructor_calls: [{
            class_name: "User" as any,
            location: test_location,
            assigned_to: "user",
            scope_id: "scope1" as any,
          }],
        },
      } as any],
      ["/user.ts", {
        classes: new Map([[user_class, {
          id: user_class,
          name: "User" as any,
          kind: "class" as const,
          location: test_location,
          scope_id: "scope1" as any,
          availability: { scope: "public" as const },
        }]]),
      } as any]
    ]);

    const imports = new Map([
      ["/test.ts" as any, new Map([["User" as any, user_class]])]
    ]);

    const context = build_local_type_context(indices, imports);
    const file_context = context.get("/test.ts" as any);

    expect(file_context?.variable_types.get("user")).toBe(user_class);
  });

  it("should handle multiple constructor calls", () => {
    const indices = new Map<string, SemanticIndex>([
      ["/test.ts", {
        classes: new Map([
          [user_class, {
            id: user_class,
            name: "User" as any,
            kind: "class" as const,
            location: test_location,
            scope_id: "scope1" as any,
            availability: { scope: "public" as const },
          }],
          [admin_class, {
            id: admin_class,
            name: "Admin" as any,
            kind: "class" as const,
            location: test_location,
            scope_id: "scope1" as any,
            availability: { scope: "public" as const },
          }],
        ]),
        local_type_flow: {
          constructor_calls: [
            {
              class_name: "User" as any,
              location: test_location,
              assigned_to: "user",
              scope_id: "scope1" as any,
            },
            {
              class_name: "Admin" as any,
              location: {
                ...test_location,
                start_position: { row: 2, column: 0, offset: 20 },
              },
              assigned_to: "admin",
              scope_id: "scope1" as any,
            }
          ],
        },
      } as any]
    ]);

    const imports = new Map();
    const context = build_local_type_context(indices, imports);
    const file_context = context.get("/test.ts" as any);

    expect(file_context?.variable_types.get("user")).toBe(user_class);
    expect(file_context?.variable_types.get("admin")).toBe(admin_class);
    expect(file_context?.constructor_calls).toHaveLength(2);
  });
});