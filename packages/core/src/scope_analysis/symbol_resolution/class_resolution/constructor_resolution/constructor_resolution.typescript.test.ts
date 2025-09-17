/**
 * TypeScript-specific tests for constructor resolution
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
  DefaultImport,
  DefaultExport,
  NamespaceImport,
  ReExport,
  SymbolName,
  FilePath,
  class_symbol,
  ScopeTree,
  function_scope,
  class_scope,
  block_scope,
} from "@ariadnejs/types";
import { FileResolutionContext } from "../../symbol_resolution";

describe("TypeScript constructor resolution", () => {
  it("should resolve local class constructor with generics", () => {
    const file_path: FilePath = "src/generics.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "GenericClass" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 8,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
      // TypeScript-specific: generics
      type_parameters: ["T", "U"],
    };

    const call: ConstructorCall = {
      class_name: "GenericClass" as SymbolName,
      location: {
        file_path,
        line: 15,
        column: 1,
        end_line: 15,
        end_column: 30,
      },
      arguments: [],
      // TypeScript-specific: type arguments
      type_arguments: ["string", "number"],
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
      language: "typescript",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("GenericClass" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("GenericClass");
  });

  it("should handle temporal dead zone for class declarations", () => {
    const file_path: FilePath = "src/tdz.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "MyClass" as SymbolName,
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

    // Call before declaration - should fail due to temporal dead zone
    const call: ConstructorCall = {
      class_name: "MyClass" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 10,
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
      language: "typescript",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("MyClass" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeUndefined(); // Should fail due to temporal dead zone
  });

  it("should resolve type-only imported class (should not be constructable)", () => {
    const file_a: FilePath = "src/types/User.ts" as FilePath;
    const file_b: FilePath = "src/services/auth.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "UserClass" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
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
        kind: "named",
        source: "../types/User" as any,
        imports: [
          {
            name: "UserClass" as SymbolName,
            is_type_only: true, // Type-only import
          },
        ],
      } as unknown as NamedImport,
    ];

    const exports: Export[] = [
      {
        kind: "named",
        exports: [
          {
            local_name: "UserClass" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "UserClass" as SymbolName,
      location: {
        file_path: file_b,
        line: 10,
        column: 1,
        end_line: 10,
        end_column: 20,
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
            end_line: 20,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path: file_b,
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
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("UserClass" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    // Type-only imports cannot be used as values, but we're testing resolution logic
    // In a real TypeScript compiler, this would be an error
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("UserClass");
  });

  it("should resolve abstract class (not constructable directly)", () => {
    const file_path: FilePath = "src/abstract.ts" as FilePath;

    const abstractClass: ClassDefinition = {
      name: "AbstractBase" as SymbolName,
      location: {
        file_path,
        line: 1,
        column: 1,
        end_line: 8,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
      is_abstract: true, // TypeScript-specific
    };

    const concreteClass: ClassDefinition = {
      name: "ConcreteImpl" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 18,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: ["AbstractBase" as SymbolName],
      extends: ["AbstractBase" as SymbolName],
    };

    const call1: ConstructorCall = {
      class_name: "AbstractBase" as SymbolName,
      location: {
        file_path,
        line: 20,
        column: 1,
        end_line: 20,
        end_column: 25,
      },
      arguments: [],
    };

    const call2: ConstructorCall = {
      class_name: "ConcreteImpl" as SymbolName,
      location: {
        file_path,
        line: 22,
        column: 1,
        end_line: 22,
        end_column: 25,
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
      language: "typescript",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol(
                  "AbstractBase" as SymbolName,
                  abstractClass.location
                ),
                abstractClass,
              ],
              [
                class_symbol(
                  "ConcreteImpl" as SymbolName,
                  concreteClass.location
                ),
                concreteClass,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    // Abstract class can be resolved (even though not constructable in TypeScript)
    const resolved1 = resolve_constructor_call(call1, context);
    expect(resolved1).toBeDefined();
    expect(resolved1?.name).toBe("AbstractBase");
    expect(resolved1?.is_abstract).toBe(true);

    // Concrete implementation can be constructed
    const resolved2 = resolve_constructor_call(call2, context);
    expect(resolved2).toBeDefined();
    expect(resolved2?.name).toBe("ConcreteImpl");
  });

  it("should resolve namespace imported class", () => {
    const file_a: FilePath = "src/models/index.ts" as FilePath;
    const file_b: FilePath = "src/app.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "User" as SymbolName,
      location: {
        file_path: file_a,
        line: 5,
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
        kind: "namespace",
        source: "./models" as any,
        namespace_name: "Models" as any,
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

    const call: ConstructorCall = {
      class_name: "Models.User" as SymbolName,
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
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("User" as SymbolName, cls.location), cls],
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

  it("should resolve class with interface implementation", () => {
    const file_path: FilePath = "src/implementation.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "MyImplementation" as SymbolName,
      location: {
        file_path,
        line: 10,
        column: 1,
        end_line: 20,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
      implements: ["IMyInterface" as SymbolName], // TypeScript-specific
    };

    const call: ConstructorCall = {
      class_name: "MyImplementation" as SymbolName,
      location: {
        file_path,
        line: 25,
        column: 1,
        end_line: 25,
        end_column: 30,
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
      language: "typescript",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("MyImplementation" as SymbolName, cls.location),
                cls,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("MyImplementation");
    expect(resolved?.implements?.[0]).toBe("IMyInterface");
  });

  it("should resolve decorated class", () => {
    const file_path: FilePath = "src/decorators.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "DecoratedClass" as SymbolName,
      location: {
        file_path,
        line: 5,
        column: 1,
        end_line: 15,
        end_column: 2,
      },
      methods: [],
      properties: [],
      base_classes: [],
      decorators: ["@Injectable", "@Component"], // TypeScript-specific
    };

    const call: ConstructorCall = {
      class_name: "DecoratedClass" as SymbolName,
      location: {
        file_path,
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
      language: "typescript",
      definitions: new Map([
        [
          file_path,
          {
            functions: new Map(),
            classes: new Map([
              [class_symbol("DecoratedClass" as SymbolName, cls.location), cls],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("DecoratedClass");
  });

  it("should resolve aliased imported class", () => {
    const file_a: FilePath = "src/components/Button.ts" as FilePath;
    const file_b: FilePath = "src/app.ts" as FilePath;

    const cls: ClassDefinition = {
      name: "ButtonComponent" as SymbolName,
      location: {
        file_path: file_a,
        line: 1,
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
        kind: "named",
        source: "./components/Button" as any,
        imports: [
          {
            name: "ButtonComponent" as SymbolName,
            alias: "Button" as SymbolName,
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
            local_name: "ButtonComponent" as SymbolName,
            is_type_only: false,
          },
        ],
      } as unknown as NamedExport,
    ];

    const call: ConstructorCall = {
      class_name: "Button" as SymbolName,
      location: {
        file_path: file_b,
        line: 15,
        column: 1,
        end_line: 15,
        end_column: 20,
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
            end_line: 20,
            end_column: 1,
          }),
          type: "function",
          parent_id: undefined,
          location: {
            file_path: file_b,
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
      imports_by_file: new Map([[file_b, imports]]),
      exports_by_file: new Map([[file_a, exports]]),
      language: "typescript",
      definitions: new Map([
        [
          file_a,
          {
            functions: new Map(),
            classes: new Map([
              [
                class_symbol("ButtonComponent" as SymbolName, cls.location),
                cls,
              ],
            ]),
            methods: new Map(),
          },
        ],
      ]),
    };

    const resolved = resolve_constructor_call(call, context);
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe("ButtonComponent");
  });
});
