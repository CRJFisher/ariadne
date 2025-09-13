/**
 * Integration test for TypeScript type tracking with imports
 *
 * Verifies that imported types are properly resolved and qualified
 */

import { describe, it, expect } from "vitest";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { FilePath, ImportInfo, SourceCode } from "@ariadnejs/types";
import { process_file_for_types } from "./index";
import { get_variable_type } from "./test_utils";

describe("TypeScript Type Tracking with Imports", () => {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript as any);

  it("should resolve imported types in variable declarations", () => {
    const source = `
      import { User } from './models/user';
      import React from 'react';
      
      const user: User = { name: 'John' };
      const component: React.Component = new Component();
    `;

    const tree = parser.parse(source);

    // Simulate imports from import_resolution layer
    const imports: ImportInfo[] = [
      {
        name: "User",
        source: "./models/user",
        kind: "named",
        is_type_only: false,
        location: {
          line: 1,
          column: 1,
          file_path: "test.ts" as FilePath,
          end_line: 1,
          end_column: 1,
        },
      },
      {
        name: "React",
        source: "react",
        kind: "default",
        location: {
          line: 1,
          column: 1,
          file_path: "test.ts" as FilePath,
          end_line: 1,
          end_column: 1,
        },
        is_type_only: false,
      },
    ];

    const context = {
      language: "typescript" as const,
      file_path: "test.ts" as FilePath,
      source_code: source as SourceCode,
      debug: false,
    };

    const tracker = process_file_for_types(
      tree.rootNode,
      context,
      imports // imports from Layer 2
    );

    // Check that imported type is tracked
    const user_type = get_variable_type(tracker, "user");
    expect(user_type).toBeDefined();
    expect(user_type?.type_name).toBe("User");

    // Check namespace type resolution
    const component_type = get_variable_type(tracker, "component");
    expect(component_type).toBeDefined();
    // Should recognize React.Component as from the React import
  });

  it("should handle type-only imports", () => {
    const source = `
      import type { UserType } from './types';
      
      let user: UserType;
    `;

    const tree = parser.parse(source);

    const imports: ImportInfo[] = [
      {
        name: "UserType",
        source: "./types",
        kind: "named",
        location: {
          line: 1,
          column: 1,
          file_path: "test.ts" as FilePath,
          end_line: 1,
          end_column: 1,
        },
        is_type_only: true,
      },
    ];

    const context = {
      language: "typescript" as const,
      file_path: "test.ts" as FilePath,
      source_code: source as SourceCode,
      debug: false,
    };

    const tracker = process_file_for_types(
      tree.rootNode,
      context,
      imports
    );

    const user_type = get_variable_type(tracker, "user");
    expect(user_type).toBeDefined();
    expect(user_type?.type_name).toBe("UserType");
  });

  it("should handle namespace imports", () => {
    const source = `
      import * as models from './models';
      
      const user: models.User = {};
    `;

    const tree = parser.parse(source);

    const location = {
      line: 1,
      column: 1,
      file_path: "test.ts" as FilePath,
      end_line: 1,
      end_column: 1,
    };
    const imports: ImportInfo[] = [
      {
        name: "*",
        source: "./models",
        kind: "namespace",
        namespace_name: "models",
        location: location,
        is_type_only: false,
      },
    ];

    const context = {
      language: "typescript" as const,
      file_path: "test.ts" as FilePath,
      source_code: source as SourceCode,
      debug: false,
    };

    const tracker = process_file_for_types(
      tree.rootNode,
      context,
      imports
    );

    const user_type = get_variable_type(tracker, "user", location);
    expect(user_type).toBeDefined();
    // Namespace imports need special handling for member access
    // This test documents the expected behavior
  });

  it.skip("should handle imported types in function parameters", () => {
    const source = `
      import { User } from './models/user';
      
      function processUser(user: User): void {
        // Process user
      }
    `;

    const tree = parser.parse(source);

    const imports: ImportInfo[] = [
      {
        name: "User",
        source: "./models/user",
        kind: "named",
        is_type_only: false,
        location: {
          line: 1,
          column: 1,
          file_path: "test.ts" as FilePath,
          end_line: 1,
          end_column: 1,
        },
      },
    ];

    const context = {
      language: "typescript" as const,
      file_path: "test.ts" as FilePath,
      source_code: source as SourceCode,
      debug: false,
    };

    const tracker = process_file_for_types(
      tree.rootNode,
      context,
      imports
    );

    const user_type = get_variable_type(tracker, "user");
    expect(user_type).toBeDefined();
    expect(user_type?.type_name).toBe("User");
  });

  it("should distinguish between imported and local types", () => {
    const source = `
      import { RemoteUser } from './api';
      
      interface LocalUser {
        name: string;
      }
      
      const remote: RemoteUser = {};
      const local: LocalUser = {};
    `;

    const tree = parser.parse(source);

    const imports: ImportInfo[] = [
      {
        name: "RemoteUser",
        source: "./api",
        kind: "named",
        is_type_only: false,
        location: {
          line: 1,
          column: 1,
          file_path: "test.ts" as FilePath,
          end_line: 1,
          end_column: 1,
        },
      },
    ];

    const context = {
      language: "typescript" as const,
      file_path: "test.ts" as FilePath,
      source_code: source as SourceCode,
      debug: false,
    };

    const tracker = process_file_for_types(tree.rootNode, context, imports);

    const remoteType = get_variable_type(tracker, "remote");
    expect(remoteType).toBeDefined();
    expect(remoteType?.type_name).toBe("RemoteUser");

    const localType = get_variable_type(tracker, "local");
    expect(localType).toBeDefined();
    expect(localType?.type_name).toBe("LocalUser");
    // Local type should not be marked as imported
  });
});
