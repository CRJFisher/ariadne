import { describe, it, expect } from "vitest";
import {
  build_method_index,
  resolve_method_heuristic,
} from "./heuristic_resolver";
import { build_local_type_context } from "../local_type_context";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { MemberAccessReference } from "../../index_single_file/references/member_access_references/member_access_references";
import type { HeuristicLookupContext } from "./heuristic_types";
import { class_symbol, method_symbol, location_key } from "@ariadnejs/types";

describe("Heuristic Resolution with Local Type Context", () => {
  const test_location = {
    file_path: "/test.ts" as any,
    start_position: { row: 1, column: 0, offset: 0 },
    end_position: { row: 1, column: 10, offset: 10 },
  };

  const user_class = class_symbol("User", "/test.ts", test_location);
  const admin_class = class_symbol("Admin", "/test.ts", test_location);
  const user_get_name = method_symbol(
    "getName",
    "User",
    "/test.ts",
    test_location
  );
  const admin_get_name = method_symbol(
    "getName",
    "Admin",
    "/test.ts",
    test_location
  );

  it("should resolve method using constructor type hint", () => {
    // Setup: Two classes with same method name
    const user_class_def = {
      id: user_class,
      name: "User" as any,
      kind: "class" as const,
      location: test_location,
      scope_id: "scope1" as any,
      availability: { scope: "public" as const },
      methods: [
        {
          id: user_get_name,
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

    const call_location = {
      ...test_location,
      start_position: { row: 3, column: 0, offset: 30 },
    };

    const indices = new Map<string, SemanticIndex>([
      [
        "/test.ts",
        {
          classes: new Map([
            [user_class, user_class_def],
            [admin_class, admin_class_def],
          ]),
          local_type_flow: {
            constructor_calls: [
              {
                class_name: "User" as any,
                location: test_location,
                assigned_to: "user",
                scope_id: "scope1" as any,
              },
            ],
          },
          references: {
            member_accesses: [],
          },
        } as any,
      ],
    ]);

    // Build type context
    const imports = new Map();
    const local_types = build_local_type_context(indices, imports);

    // Build method index
    const method_index = build_method_index(indices);

    // Create member access for user.getName()
    const member_access: MemberAccessReference = {
      member_name: "getName" as any,
      location: call_location,
      object: {
        location: call_location,
        name: "user", // Variable name that was assigned from constructor
      } as any,
      access_type: "method",
    };

    const context: HeuristicLookupContext = {
      imports,
      current_file: "/test.ts" as any,
      current_index: indices.get("/test.ts")!,
      indices,
      local_type_context: local_types.get("/test.ts" as any),
    };

    const result = resolve_method_heuristic(
      member_access,
      context,
      method_index
    );

    // Should resolve to User.getName, not Admin.getName
    expect(result).toBeTruthy();
    expect(result?.method_id).toBe(user_get_name);
    expect(result?.class_id).toBe(user_class);
    expect(result?.strategy).toBe("explicit_type");
    expect(result?.confidence).toBeGreaterThan(0.9);
  });

  it("should resolve method without type hints using file proximity", () => {
    // When no type hints are available, should still resolve using other strategies
    const user_class_def = {
      id: user_class,
      name: "User" as any,
      kind: "class" as const,
      location: test_location,
      scope_id: "scope1" as any,
      availability: { scope: "public" as const },
      methods: [
        {
          id: user_get_name,
          name: "getUser" as any, // Unique method name
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

    const imports = new Map();
    const local_types = build_local_type_context(indices, imports);
    const method_index = build_method_index(indices);

    const member_access: MemberAccessReference = {
      member_name: "getUser" as any,
      location: test_location,
      object: { location: test_location } as any,
      access_type: "method",
    };

    const context: HeuristicLookupContext = {
      imports,
      current_file: "/test.ts" as any,
      current_index: indices.get("/test.ts")!,
      indices,
      local_type_context: local_types.get("/test.ts" as any),
    };

    const result = resolve_method_heuristic(
      member_access,
      context,
      method_index
    );

    // Should resolve using unique method strategy
    expect(result).toBeTruthy();
    expect(result?.method_id).toBe(user_get_name);
    expect(result?.strategy).toBe("unique_method");
  });

  it("should prioritize type hints over other strategies", () => {
    // Setup: Class in different file, but type hint available
    const remote_location = {
      ...test_location,
      file_path: "/models/user.ts" as any,
    };

    const user_class_def = {
      id: user_class,
      name: "User" as any,
      kind: "class" as const,
      location: remote_location,
      scope_id: "scope1" as any,
      availability: { scope: "public" as const },
      methods: [
        {
          id: user_get_name,
          name: "getName" as any,
          kind: "method" as const,
          location: remote_location,
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
          classes: new Map(),
          local_type_flow: {
            constructor_calls: [
              {
                class_name: "User" as any,
                location: test_location,
                assigned_to: "user",
                scope_id: "scope1" as any,
              },
            ],
          },
          references: {
            member_accesses: [],
          },
        } as any,
      ],
      [
        "/models/user.ts",
        {
          classes: new Map([[user_class, user_class_def]]),
          references: {
            member_accesses: [],
          },
        } as any,
      ],
    ]);

    // User is imported
    const imports = new Map([
      ["/test.ts" as any, new Map([["User" as any, user_class]])],
    ]);

    const local_types = build_local_type_context(indices, imports);
    const method_index = build_method_index(indices);

    const member_access: MemberAccessReference = {
      member_name: "getName" as any,
      location: test_location,
      object: {
        location: test_location,
        name: "user",
      } as any,
      access_type: "method",
    };

    const context: HeuristicLookupContext = {
      imports,
      current_file: "/test.ts" as any,
      current_index: indices.get("/test.ts")!,
      indices,
      local_type_context: local_types.get("/test.ts" as any),
    };

    const result = resolve_method_heuristic(
      member_access,
      context,
      method_index
    );

    // Should resolve using type hint even though class is in different file
    expect(result).toBeTruthy();
    expect(result?.method_id).toBe(user_get_name);
    expect(result?.class_id).toBe(user_class);
    expect(result?.strategy).toBe("explicit_type");
  });
});
