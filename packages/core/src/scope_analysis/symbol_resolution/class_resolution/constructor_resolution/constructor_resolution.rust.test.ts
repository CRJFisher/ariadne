/**
 * Rust-specific tests for constructor resolution
 */

import { describe, it, expect } from "vitest";
import { resolve_constructor_call } from "./constructor_resolution";
import {
  ConstructorCall,
  ClassDefinition,
  Import,
  Export,
  NamedImport,
  NamedExport,
  NamespaceImport,
  SymbolName,
  FilePath,
  class_symbol,
  ScopeTree,
  function_scope,
  class_scope,
  ModulePath,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";

describe("Rust constructor resolution", () => {
  it("should resolve struct constructor", () => {
    const file_path: FilePath = "src/models.rs" as FilePath;

    const struct_def: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 10,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const call: ConstructorCall = {
      class_name: "User" as SymbolName,
      location: {
        file_path,
        line: 15,
        column: 1,
        end_line: 15,
        end_column: 10,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path,
            line: 1,
            column: 1,
            end_line: 20,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path,
            line: 1,
            column: 1,
            end_line: 20,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "rust",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("User" as SymbolName, struct_def.location),
                struct_def,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("User");
  });

  it("should resolve associated function (::new)", () => {
    const file_path: FilePath = "src/main.rs" as FilePath;

    const struct_def: ClassDefinition = {
      name: "MyStruct" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 3,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    // MyStruct::new() pattern
    const call: ConstructorCall = {
      class_name: "MyStruct::new" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 20,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path,
            line: 1,
            column: 1,
            end_line: 25,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path,
            line: 1,
            column: 1,
            end_line: 25,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "rust",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("MyStruct" as SymbolName, struct_def.location),
                struct_def,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("MyStruct");
  });

  it("should resolve module path struct", () => {
    const file_a: FilePath = "src/models/mod.rs" as FilePath;
    const file_b: FilePath = "src/main.rs" as FilePath;

    const struct_def: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path: file_a,
        line: 10,
        column: 1,
        end_line: 15,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: "src/models/mod.rs" as ModulePath,
        imports: [
          {
            name: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "User" as SymbolName,
      location: {
        file_path: file_b,
        line: 25,
        column: 1,
        end_line: 25,
        end_column: 10,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 30,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 30,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "rust",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("User" as SymbolName, struct_def.location),
                struct_def,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("User");
  });

  it("should resolve qualified module path", () => {
    const file_a: FilePath = "src/models/user.rs" as FilePath;
    const file_b: FilePath = "src/main.rs" as FilePath;

    const struct_def: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path: file_a,
        line: 5,
        column: 1,
        end_line: 10,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "namespace",
        source: "src/models/user.rs" as ModulePath,
        namespace_name: "models::user" as any,
      } as unknown as NamespaceImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    // models::user::User pattern
    const call: ConstructorCall = {
      class_name: "models::user::User" as SymbolName,
      location: {
        file_path: file_b,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 25,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 25,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 25,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "rust",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("User" as SymbolName, struct_def.location),
                struct_def,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("User");
  });

  it("should resolve aliased import", () => {
    const file_a: FilePath = "src/models.rs" as FilePath;
    const file_b: FilePath = "src/main.rs" as FilePath;

    const struct_def: ClassDefinition = {
      name: "UserModel" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: "src/models.rs" as ModulePath,
        imports: [
          {
            name: "UserModel" as SymbolName,
            alias: "User" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "UserModel" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "User" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 10,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 15,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 15,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "rust",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("UserModel" as SymbolName, struct_def.location),
                struct_def,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("UserModel");
  });

  it("should resolve crate import", () => {
    const file_a: FilePath = "src/lib.rs" as FilePath;
    const file_b: FilePath = "src/main.rs" as FilePath;

    const struct_def: ClassDefinition = {
      name: "Config" as SymbolName,
      location: {
        file_path: file_a,
        line: 10,
        column: 1,
        end_line: 15,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    const imports: Import[] = [
      {
        kind: "named",
        source: "src/lib.rs" as ModulePath,
        imports: [
          {
            name: "Config" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "Config" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "Config" as SymbolName,
      location: {
        file_path: file_b,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 15,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 25,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path: file_b,
            line: 1,
            column: 1,
            end_line: 25,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "rust",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("Config" as SymbolName, struct_def.location),
                struct_def,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("Config");
  });

  it("should resolve enum variant constructor", () => {
    const file_path: FilePath = "src/types.rs" as FilePath;

    const enum_def: ClassDefinition = {
      name: "Result" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 5,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
      kind: "enum", // Rust-specific
      variants: ["Ok", "Err"], // Enum variants
    };

    // Result::Ok pattern
    const call: ConstructorCall = {
      class_name: "Result::Ok" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 15,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path,
            line: 1,
            column: 1,
            end_line: 15,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path,
            line: 1,
            column: 1,
            end_line: 15,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "rust",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("Result" as SymbolName, enum_def.location),
                enum_def,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("Result");
  });

  it("should resolve tuple struct", () => {
    const file_path: FilePath = "src/types.rs" as FilePath;

    const tuple_struct: ClassDefinition = {
      name: "Point" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 1,
        end_column: 20,
      },
      methods: [],
      properties: [],
      base_classes: [],
      kind: "tuple_struct", // Rust-specific
    };

    const call: ConstructorCall = {
      class_name: "Point" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 5,
        end_column: 15,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path,
            line: 1,
            column: 1,
            end_line: 10,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path,
            line: 1,
            column: 1,
            end_line: 10,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "rust",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("Point" as SymbolName, tuple_struct.location),
                tuple_struct,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("Point");
  });

  it("should handle definition order (no restriction in Rust)", () => {
    const file_path: FilePath = "src/order.rs" as FilePath;

    const struct_def: ClassDefinition = {
      name: "MyStruct" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 1,
        end_line: 25,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
    };

    // Call before definition - should work in Rust
    const call: ConstructorCall = {
      class_name: "MyStruct" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 15,
      },
      arguments: [],
    };

    const context: FileResolutionContext = {
      scope_tree: {
        root: {
          id: function_scope({
            file_path,
            line: 1,
            column: 1,
            end_line: 30,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path,
            line: 1,
            column: 1,
            end_line: 30,
            end_column: 1,
          },
        },
        nodes: new Map(),
        get_symbols_in_scope: () => new Map(),
        get_parent_scope: () => undefined,
      } as unknown as ScopeTree,
      imports_by_file: new Map(),
      exports_by_file: new Map(),
      language: "rust",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("MyStruct" as SymbolName, struct_def.location),
                struct_def,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined(); // Should work - Rust allows forward references
    expect(resolved?.name).toBe("MyStruct");
  });
});
