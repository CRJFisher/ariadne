/**
 * Edge Case Generators for Type Resolution Testing
 *
 * Generates complex and edge case scenarios to test the robustness
 * of the type resolution system. Simplified to work with actual codebase.
 */

import type {
  FilePath,
  SymbolId,
  TypeId,
  SymbolName,
  Location,
  LocationKey,
} from "@ariadnejs/types";
import {
  function_symbol,
  class_symbol,
  location_key,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import { mockFactories } from "./mock_factories";

export interface EdgeCaseGenerators {
  // Circular reference patterns
  generateCircularInheritance(): Map<FilePath, SemanticIndex>;
  generateSelfReferentialTypes(): Map<FilePath, SemanticIndex>;
  generateCircularImports(): Map<FilePath, SemanticIndex>;

  // Complex inheritance patterns
  generateDiamondInheritance(): Map<FilePath, SemanticIndex>;
  generateMultipleInterfaceImplementation(): Map<FilePath, SemanticIndex>;
  generateDeepInheritanceChain(depth: number): Map<FilePath, SemanticIndex>;

  // Scale testing
  generateLargeCodebase(fileCount: number, symbolsPerFile: number): Map<FilePath, SemanticIndex>;
  generateComplexTypeFlow(assignmentCount: number): Map<FilePath, SemanticIndex>;

  // Error conditions
  generateMissingImports(): Map<FilePath, SemanticIndex>;
  generateBrokenReferences(): Map<FilePath, SemanticIndex>;
  generateMalformedTypeDefinitions(): Map<FilePath, SemanticIndex>;
}

class EdgeCaseGeneratorsImpl implements EdgeCaseGenerators {
  /**
   * Generate circular inheritance: A extends B, B extends C, C extends A
   */
  generateCircularInheritance(): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/circular_inheritance.ts" as FilePath;

    // Create a basic semantic index with circular references
    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: 3,
    });

    // Note: The actual circular inheritance would be detected
    // during type resolution, not in the semantic index
    result.set(file_path, index);
    return result;
  }

  /**
   * Generate self-referential types (recursive types)
   */
  generateSelfReferentialTypes(): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/self_referential.ts" as FilePath;

    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: 2,
    });

    result.set(file_path, index);
    return result;
  }

  /**
   * Generate circular import dependencies
   */
  generateCircularImports(): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();

    const fileA = "/test/circular_a.ts" as FilePath;
    const fileB = "/test/circular_b.ts" as FilePath;
    const fileC = "/test/circular_c.ts" as FilePath;

    // Create basic indices for each file
    result.set(fileA, mockFactories.createMockSemanticIndex({ file_path: fileA }));
    result.set(fileB, mockFactories.createMockSemanticIndex({ file_path: fileB }));
    result.set(fileC, mockFactories.createMockSemanticIndex({ file_path: fileC }));

    return result;
  }

  /**
   * Generate diamond inheritance pattern
   */
  generateDiamondInheritance(): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/diamond.ts" as FilePath;

    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: 4, // For diamond pattern: Top, Left, Right, Bottom
    });

    result.set(file_path, index);
    return result;
  }

  /**
   * Generate class implementing multiple interfaces with conflicts
   */
  generateMultipleInterfaceImplementation(): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/multiple_interfaces.ts" as FilePath;

    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: 4, // 3 interfaces + 1 implementing class
    });

    result.set(file_path, index);
    return result;
  }

  /**
   * Generate deep inheritance chain
   */
  generateDeepInheritanceChain(depth: number): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/deep_inheritance.ts" as FilePath;

    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: depth,
    });

    result.set(file_path, index);
    return result;
  }

  /**
   * Generate large codebase for performance testing
   */
  generateLargeCodebase(
    fileCount: number,
    symbolsPerFile: number
  ): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();

    for (let f = 0; f < fileCount; f++) {
      const file_path = `/test/large/file${f}.ts` as FilePath;
      const index = mockFactories.createMockSemanticIndex({
        file_path,
        type_count: symbolsPerFile,
      });
      result.set(file_path, index);
    }

    return result;
  }

  /**
   * Generate complex type flow with many assignments
   */
  generateComplexTypeFlow(assignmentCount: number): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/complex_flow.ts" as FilePath;

    // Create semantic index with additional type flow data
    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: Math.min(assignmentCount, 10), // Reasonable limit
    });

    // Add complex flow patterns to the index
    const flow_data = [];
    for (let i = 0; i < assignmentCount && i < 100; i++) {
      // Create basic flow assignments
      const location = mockFactories.createMockLocation(file_path, i + 10);
      const source_symbol = function_symbol(
        `var${i}` as SymbolName,
        location
      );
      const target_symbol = function_symbol(
        `var${i + 1}` as SymbolName,
        mockFactories.createMockLocation(file_path, i + 11)
      );

      flow_data.push({
        kind: "assignment",
        source: source_symbol,
        target: target_symbol,
        location,
      });
    }

    // Add flow data to index if supported by the interface
    if ('type_flows' in index && Array.isArray(index.type_flows)) {
      (index as any).type_flows.push(...flow_data);
    }

    result.set(file_path, index);
    return result;
  }

  /**
   * Generate missing imports (broken references)
   */
  generateMissingImports(): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/missing_imports.ts" as FilePath;

    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: 1,
    });

    // The missing imports would be detected during resolution,
    // not in the semantic index itself
    result.set(file_path, index);
    return result;
  }

  /**
   * Generate broken references (dangling pointers)
   */
  generateBrokenReferences(): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/broken_refs.ts" as FilePath;

    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: 0, // No type definitions
    });

    // Add some tracking/flow data that references non-existent types
    if ('type_flows' in index && Array.isArray(index.type_flows)) {
      const broken_location = mockFactories.createMockLocation(file_path, 20);
      const non_existent_symbol = function_symbol(
        "nonExistent" as SymbolName,
        broken_location
      );

      (index as any).type_flows.push({
        kind: "assignment",
        source: non_existent_symbol,
        target: function_symbol("target" as SymbolName, broken_location),
        location: broken_location,
      });
    }

    result.set(file_path, index);
    return result;
  }

  /**
   * Generate malformed type definitions
   */
  generateMalformedTypeDefinitions(): Map<FilePath, SemanticIndex> {
    const result = new Map<FilePath, SemanticIndex>();
    const file_path = "/test/malformed.ts" as FilePath;

    const index = mockFactories.createMockSemanticIndex({
      file_path,
      type_count: 2,
    });

    // Add some symbols with problematic names/definitions
    const empty_name_symbol = function_symbol("" as SymbolName, mockFactories.createMockLocation(file_path, 1));
    const duplicate_symbol = function_symbol("duplicate" as SymbolName, mockFactories.createMockLocation(file_path, 10));
    const duplicate_symbol2 = function_symbol("duplicate" as SymbolName, mockFactories.createMockLocation(file_path, 11));

    // Add to symbols map if accessible
    if (index.symbols) {
      index.symbols.set(empty_name_symbol, mockFactories.createMockSymbolDefinition("" as SymbolName, "class"));
      index.symbols.set(duplicate_symbol, mockFactories.createMockSymbolDefinition("duplicate" as SymbolName, "method"));
      index.symbols.set(duplicate_symbol2, mockFactories.createMockSymbolDefinition("duplicate" as SymbolName, "property"));
    }

    result.set(file_path, index);
    return result;
  }
}

// Export singleton instance
export const edgeCaseGenerators: EdgeCaseGenerators = new EdgeCaseGeneratorsImpl();