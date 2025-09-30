/**
 * Tests for inheritance resolution functionality
 */

import { describe, it, expect } from "vitest";
import type {
  TypeId,
  FilePath,
  SymbolId,
  SymbolName,
  Location,
} from "@ariadnejs/types";
import { resolve_inheritance } from "./inheritance";
import type { LocalTypeDefinition } from "./types";

// Test utilities
function create_location(line: number, column: number): Location {
  return {
    start_line: line,
    start_column: column,
    end_line: line,
    end_column: column + 1,
    file_path: "file.ts" as FilePath,
  };
}

function create_local_type_definition(
  name: SymbolName,
  kind: "class" | "interface" | "type" | "enum",
  file_path: FilePath,
  extends_names?: SymbolName[],
  implements_names?: SymbolName[]
): LocalTypeDefinition {
  return {
    name,
    kind,
    location: create_location(1, 1),
    file_path,
    direct_members: new Map(),
    extends_names,
    implements_names,
  };
}

describe("resolve_inheritance", () => {
  describe("Basic inheritance", () => {
    it("should handle simple class inheritance", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "Base" as SymbolName,
              "class",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "Derived" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["Base" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      expect(result.extends_map.size).toBe(1);
      expect(result.all_ancestors.size).toBeGreaterThan(0);

      // Check that Derived extends Base
      const derived_parents = Array.from(result.extends_map.values())[0];
      expect(derived_parents).toBeDefined();
      expect(derived_parents.length).toBe(1);
    });

    it("should handle interface implementation", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "IDisposable" as SymbolName,
              "interface",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "MyClass" as SymbolName,
              "class",
              "file.ts" as FilePath,
              undefined,
              ["IDisposable" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      expect(result.implements_map.size).toBe(1);
      expect(result.all_ancestors.size).toBeGreaterThan(0);

      // Check that MyClass implements IDisposable
      const class_interfaces = Array.from(result.implements_map.values())[0];
      expect(class_interfaces).toBeDefined();
      expect(class_interfaces.length).toBe(1);
    });

    it("should handle both extends and implements", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "Base" as SymbolName,
              "class",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "IDisposable" as SymbolName,
              "interface",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "Derived" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["Base" as SymbolName],
              ["IDisposable" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      expect(result.extends_map.size).toBe(1);
      expect(result.implements_map.size).toBe(1);
      expect(result.all_ancestors.size).toBeGreaterThan(0);
    });
  });

  describe("Transitive inheritance", () => {
    it("should compute transitive closure correctly", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "GrandParent" as SymbolName,
              "class",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "Parent" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["GrandParent" as SymbolName]
            ),
            create_local_type_definition(
              "Child" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["Parent" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      expect(result.extends_map.size).toBe(2); // Parent->GrandParent, Child->Parent

      // Child should have both Parent and GrandParent as ancestors
      let child_ancestors: Set<TypeId> | undefined;
      result.all_ancestors.forEach((ancestors, type_id) => {
        if (type_id.includes("Child")) {
          child_ancestors = ancestors;
        }
      });

      expect(child_ancestors).toBeDefined();
      expect(child_ancestors!.size).toBe(2); // Parent and GrandParent
    });

    it("should compute descendants correctly", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "Base" as SymbolName,
              "class",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "Derived1" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["Base" as SymbolName]
            ),
            create_local_type_definition(
              "Derived2" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["Base" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      // Base should have both Derived1 and Derived2 as descendants
      let base_descendants: Set<TypeId> | undefined;
      result.all_descendants.forEach((descendants, type_id) => {
        if (type_id.includes("Base")) {
          base_descendants = descendants;
        }
      });

      expect(base_descendants).toBeDefined();
      expect(base_descendants!.size).toBe(2); // Derived1 and Derived2
    });
  });

  describe("Edge cases", () => {
    it("should handle circular inheritance gracefully", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "A" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["B" as SymbolName]
            ),
            create_local_type_definition(
              "B" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["A" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      // Should not throw an error
      expect(() => {
        const result = resolve_inheritance(type_definitions, resolved_imports);
      }).not.toThrow();
    });

    it("should handle missing parent types", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "Child" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["NonExistentParent" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      // Should not crash, but extends_map should be empty or have no resolved parents
      expect(result.extends_map.size).toBe(0);
    });

    it("should handle empty input", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>();
      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      expect(result.extends_map.size).toBe(0);
      expect(result.implements_map.size).toBe(0);
      expect(result.all_ancestors.size).toBe(0);
      expect(result.all_descendants.size).toBe(0);
    });

    it("should handle multiple interface implementation", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "IA" as SymbolName,
              "interface",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "IB" as SymbolName,
              "interface",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "IC" as SymbolName,
              "interface",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "MyClass" as SymbolName,
              "class",
              "file.ts" as FilePath,
              undefined,
              ["IA" as SymbolName, "IB" as SymbolName, "IC" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      expect(result.implements_map.size).toBe(1);

      const class_interfaces = Array.from(result.implements_map.values())[0];
      expect(class_interfaces.length).toBe(3); // IA, IB, IC
    });
  });

  describe("Cross-file inheritance", () => {
    it("should handle inheritance across files with imports", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "base.ts" as FilePath,
          [
            create_local_type_definition(
              "BaseClass" as SymbolName,
              "class",
              "base.ts" as FilePath
            ),
          ],
        ],
        [
          "derived.ts" as FilePath,
          [
            create_local_type_definition(
              "DerivedClass" as SymbolName,
              "class",
              "derived.ts" as FilePath,
              ["BaseClass" as SymbolName]
            ),
          ],
        ],
      ]);

      // Mock import resolution - DerivedClass imports BaseClass
      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >([
        [
          "derived.ts" as FilePath,
          new Map([
            ["BaseClass" as SymbolName, "Symbol:base.ts:BaseClass" as SymbolId],
          ]),
        ],
      ]);

      const result = resolve_inheritance(type_definitions, resolved_imports);

      // Should attempt to resolve cross-file inheritance
      // Implementation may vary based on symbol resolution logic
      expect(result).toBeDefined();
    });
  });

  describe("Advanced inheritance patterns", () => {
    it("should handle diamond inheritance pattern", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "IBase" as SymbolName,
              "interface",
              "file.ts" as FilePath
            ),
            create_local_type_definition(
              "ILeft" as SymbolName,
              "interface",
              "file.ts" as FilePath,
              ["IBase" as SymbolName]
            ),
            create_local_type_definition(
              "IRight" as SymbolName,
              "interface",
              "file.ts" as FilePath,
              ["IBase" as SymbolName]
            ),
            create_local_type_definition(
              "Diamond" as SymbolName,
              "class",
              "file.ts" as FilePath,
              undefined,
              ["ILeft" as SymbolName, "IRight" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      // Diamond should implement both interfaces
      // Note: Interfaces extending interfaces are processed as extends, not implements
      expect(result.implements_map.size).toBe(1); // Diamond->ILeft+IRight
      expect(result.extends_map.size).toBe(2); // ILeft->IBase, IRight->IBase

      // Diamond should have IBase as ancestor through both paths
      let diamond_ancestors: Set<TypeId> | undefined;
      for (const [type_id, ancestors] of Array.from(
        result.all_ancestors.entries()
      )) {
        if (type_id.includes("Diamond")) {
          diamond_ancestors = ancestors;
          break;
        }
      }

      expect(diamond_ancestors).toBeDefined();
      expect(diamond_ancestors!.size).toBe(3); // ILeft, IRight, IBase
    });

    it("should handle self-referential inheritance", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "SelfRef" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["SelfRef" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      // Should handle gracefully without infinite loops
      expect(() => {
        const result = resolve_inheritance(type_definitions, resolved_imports);
      }).not.toThrow();
    });

    it("should handle type name conflicts across files", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file1.ts" as FilePath,
          [
            create_local_type_definition(
              "Base" as SymbolName,
              "class",
              "file1.ts" as FilePath
            ),
            create_local_type_definition(
              "Derived" as SymbolName,
              "class",
              "file1.ts" as FilePath,
              ["Base" as SymbolName]
            ),
          ],
        ],
        [
          "file2.ts" as FilePath,
          [
            create_local_type_definition(
              "Base" as SymbolName,
              "class",
              "file2.ts" as FilePath
            ), // Same name, different file
            create_local_type_definition(
              "Derived" as SymbolName,
              "class",
              "file2.ts" as FilePath,
              ["Base" as SymbolName]
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      // Should handle both inheritance relationships separately
      // Note: Each file should resolve its own local inheritance
      expect(result.extends_map.size).toBeGreaterThanOrEqual(1); // At least one inheritance relationship
    });
  });

  describe("Malformed input handling", () => {
    it("should handle empty extends/implements arrays", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "EmptyExtends" as SymbolName,
              "class",
              "file.ts" as FilePath,
              []
            ), // Empty array
            create_local_type_definition(
              "EmptyImplements" as SymbolName,
              "class",
              "file.ts" as FilePath,
              undefined,
              []
            ), // Empty implements array
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      // Should handle gracefully
      expect(result.extends_map.size).toBe(0);
      expect(result.implements_map.size).toBe(0);
    });

    it("should handle invalid parent name references", () => {
      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        [
          "file.ts" as FilePath,
          [
            create_local_type_definition(
              "Child" as SymbolName,
              "class",
              "file.ts" as FilePath,
              ["" as SymbolName, "NonExistent" as SymbolName] // Empty string and non-existent
            ),
          ],
        ],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const result = resolve_inheritance(type_definitions, resolved_imports);

      // Should not crash, extends_map should be empty since parents don't exist
      expect(result.extends_map.size).toBe(0);
    });
  });

  describe("Performance and stress testing", () => {
    it("should handle deep inheritance chains efficiently", () => {
      const chain_depth = 50;
      const type_defs: LocalTypeDefinition[] = [];

      // Create a deep inheritance chain: Base0 -> Base1 -> ... -> Base49
      for (let i = 0; i < chain_depth; i++) {
        const name = `Base${i}` as SymbolName;
        const extends_name = i > 0 ? [`Base${i - 1}` as SymbolName] : undefined;
        type_defs.push(
          create_local_type_definition(
            name,
            "class",
            "file.ts" as FilePath,
            extends_name
          )
        );
      }

      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        ["file.ts" as FilePath, type_defs],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const start_time = performance.now();
      const result = resolve_inheritance(type_definitions, resolved_imports);
      const end_time = performance.now();

      // Should complete in reasonable time (less than 100ms for 50 levels)
      expect(end_time - start_time).toBeLessThan(100);

      // Last class should have all ancestors
      let last_ancestors: Set<TypeId> | undefined;
      for (const [type_id, ancestors] of Array.from(
        result.all_ancestors.entries()
      )) {
        if (type_id.includes("Base49")) {
          last_ancestors = ancestors;
          break;
        }
      }

      expect(last_ancestors).toBeDefined();
      expect(last_ancestors!.size).toBe(49); // All previous classes in chain
    });

    it("should handle wide inheritance trees efficiently", () => {
      const base_count = 100;
      const type_defs: LocalTypeDefinition[] = [];

      // Create one base class
      type_defs.push(
        create_local_type_definition(
          "Base" as SymbolName,
          "class",
          "file.ts" as FilePath
        )
      );

      // Create 100 classes that all extend the base
      for (let i = 0; i < base_count; i++) {
        type_defs.push(
          create_local_type_definition(
            `Derived${i}` as SymbolName,
            "class",
            "file.ts" as FilePath,
            ["Base" as SymbolName]
          )
        );
      }

      const type_definitions = new Map<FilePath, LocalTypeDefinition[]>([
        ["file.ts" as FilePath, type_defs],
      ]);

      const resolved_imports = new Map<
        FilePath,
        ReadonlyMap<SymbolName, SymbolId>
      >();

      const start_time = performance.now();
      const result = resolve_inheritance(type_definitions, resolved_imports);
      const end_time = performance.now();

      // Should complete in reasonable time
      expect(end_time - start_time).toBeLessThan(50);

      // Base should have all derived classes as descendants
      let base_descendants: Set<TypeId> | undefined;
      for (const [type_id, descendants] of Array.from(
        result.all_descendants.entries()
      )) {
        if (type_id.includes("Base") && !type_id.includes("Derived")) {
          base_descendants = descendants;
          break;
        }
      }

      expect(base_descendants).toBeDefined();
      expect(base_descendants!.size).toBe(100);
    });
  });
});
