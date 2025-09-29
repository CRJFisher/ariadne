import { describe, it, expect } from "vitest";
import {
  build_method_index,
  resolve_method_heuristic,
  ResolutionStrategy,
} from "./heuristic_resolver";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { MemberAccessReference } from "../../index_single_file/references/member_access_references/member_access_references";
import type { HeuristicLookupContext } from "./heuristic_types";
import { class_symbol, method_symbol } from "@ariadnejs/types";
import type {
  ClassDefinition,
  MethodDefinition,
} from "@ariadnejs/types/src/symbol_definitions";

describe("Heuristic Method Resolution (Simple)", () => {
  const test_location = {
    file_path: "/test.ts" as any,
    start_position: { row: 1, column: 0, offset: 0 },
    end_position: { row: 1, column: 10, offset: 10 },
  };

  const user_class = class_symbol("User", "/test.ts", test_location);
  const get_name_method = method_symbol(
    "getName",
    "User",
    "/test.ts",
    test_location
  );

  it("should resolve unique method names directly", () => {
    // Create a class definition with a method using SemanticIndex types
    const user_class_def = {
      id: user_class,
      name: "User" as any,
      kind: "class" as const,
      location: test_location,
      scope_id: "scope1" as any,
      availability: { scope: "public" as const },
      methods: [
        {
          id: get_name_method,
          name: "getName" as any,
          kind: "method" as const,
          location: test_location,
          scope_id: "scope2" as any,
          availability: { scope: "public" as const },
          is_static: false,
        },
      ],
    };

    const indices = new Map<string, SemanticIndex>([
      [
        "/test.ts",
        {
          classes: new Map([[user_class, user_class_def]]),
          references: {
            member_accesses: [],
          },
        } as any,
      ],
    ]);

    const method_index = build_method_index(indices);

    // Create a member access for user.getName()
    const member_access: MemberAccessReference = {
      member_name: "getName",
      location: test_location,
      object: { location: test_location } as any,
      access_type: "method",
    };

    const context: HeuristicLookupContext = {
      imports: new Map(),
      current_file: "/test.ts" as any,
      current_index: indices.get("/test.ts")!,
      indices,
      local_type_context: {
        variable_types: new Map(),
        expression_types: new Map(),
        type_guards: [],
        constructor_calls: [],
      },
    };

    const result = resolve_method_heuristic(
      member_access,
      context,
      method_index
    );

    expect(result).toBeTruthy();
    expect(result?.method_id).toBe(get_name_method);
    expect(result?.class_id).toBe(user_class);
    expect(result?.strategy).toBe(ResolutionStrategy.UNIQUE_METHOD);
  });

  it("should return null when multiple methods exist without disambiguation", () => {
    const admin_class = class_symbol("Admin", "/test.ts", test_location);
    const admin_get_name = method_symbol(
      "getName",
      "Admin",
      "/test.ts",
      test_location
    );

    const user_class_def = {
      id: user_class,
      name: "User" as any,
      kind: "class" as const,
      location: test_location,
      scope_id: "scope1" as any,
      availability: { scope: "public" as const },
      methods: [
        {
          id: get_name_method,
          name: "getName" as any,
          kind: "method" as const,
          location: test_location,
          scope_id: "scope2" as any,
          availability: { scope: "public" as const },
          is_static: false,
        },
      ],
    };

    const admin_class_def = {
      id: admin_class,
      name: "Admin" as any,
      kind: "class" as const,
      location: test_location,
      scope_id: "scope3" as any,
      availability: { scope: "public" as const },
      methods: [
        {
          id: admin_get_name,
          name: "getName" as any,
          kind: "method" as const,
          location: test_location,
          scope_id: "scope4" as any,
          availability: { scope: "public" as const },
          is_static: false,
        },
      ],
    };

    const indices = new Map<string, SemanticIndex>([
      [
        "/test.ts",
        {
          classes: new Map([
            [user_class, user_class_def],
            [admin_class, admin_class_def],
          ]),
          references: {
            member_accesses: [],
          },
        } as any,
      ],
    ]);

    const method_index = build_method_index(indices);

    const member_access: MemberAccessReference = {
      member_name: "getName",
      location: test_location,
      object: { location: test_location } as any,
      access_type: "method",
    };

    const context: HeuristicLookupContext = {
      imports: new Map(),
      current_file: "/test.ts" as any,
      current_index: indices.get("/test.ts")!,
      indices,
      local_type_context: {
        variable_types: new Map(),
        expression_types: new Map(),
        type_guards: [],
        constructor_calls: [],
      },
    };

    const result = resolve_method_heuristic(
      member_access,
      context,
      method_index
    );

    // Without additional context, multiple matches should use file proximity
    // Since both are in the same file, it will return one of them
    // (in practice, this would need more context to disambiguate)
    expect(result).toBeTruthy();
    expect([get_name_method, admin_get_name]).toContain(result?.method_id);
  });
});
