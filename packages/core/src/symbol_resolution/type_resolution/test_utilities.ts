/**
 * Test utilities for handling ReadonlyMap structures in type resolution tests
 *
 * These utilities help create and manipulate ReadonlyMap-based interfaces
 * without causing TypeScript compilation errors.
 */

import type {
  TypeResolutionMap,
  ImportResolutionMap,
  FunctionResolutionMap,
  MethodResolutionMap,
} from "../types";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  LocationKey,
  TypeId,
  Location,
} from "@ariadnejs/types";

// ============================================================================
// Builder classes for test data creation
// ============================================================================

/**
 * Builder for creating TypeResolutionMap test data
 */
export class TypeResolutionMapBuilder {
  private symbol_types = new Map<SymbolId, TypeId>();
  private reference_types = new Map<LocationKey, TypeId>();
  private type_members = new Map<TypeId, Map<SymbolName, SymbolId>>();
  private constructors = new Map<TypeId, SymbolId>();
  private inheritance_hierarchy = new Map<TypeId, TypeId[]>();
  private interface_implementations = new Map<TypeId, TypeId[]>();

  addSymbolType(symbolId: SymbolId, typeId: TypeId): this {
    this.symbol_types.set(symbolId, typeId);
    return this;
  }

  addReferenceType(locationKey: LocationKey, typeId: TypeId): this {
    this.reference_types.set(locationKey, typeId);
    return this;
  }

  addTypeMember(typeId: TypeId, memberName: SymbolName, memberSymbolId: SymbolId): this {
    if (!this.type_members.has(typeId)) {
      this.type_members.set(typeId, new Map());
    }
    this.type_members.get(typeId)!.set(memberName, memberSymbolId);
    return this;
  }

  addConstructor(typeId: TypeId, constructorSymbolId: SymbolId): this {
    this.constructors.set(typeId, constructorSymbolId);
    return this;
  }

  addInheritance(typeId: TypeId, parentTypes: TypeId[]): this {
    this.inheritance_hierarchy.set(typeId, parentTypes);
    return this;
  }

  addInterfaceImplementation(typeId: TypeId, interfaceTypes: TypeId[]): this {
    this.interface_implementations.set(typeId, interfaceTypes);
    return this;
  }

  build(): TypeResolutionMap {
    // Convert mutable Maps to ReadonlyMaps
    const readonly_type_members = new Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>();
    for (const [typeId, members] of this.type_members) {
      readonly_type_members.set(typeId, members as ReadonlyMap<SymbolName, SymbolId>);
    }

    return {
      symbol_types: this.symbol_types as ReadonlyMap<SymbolId, TypeId>,
      reference_types: this.reference_types as ReadonlyMap<LocationKey, TypeId>,
      type_members: readonly_type_members as ReadonlyMap<TypeId, ReadonlyMap<SymbolName, SymbolId>>,
      constructors: this.constructors as ReadonlyMap<TypeId, SymbolId>,
      inheritance_hierarchy: this.inheritance_hierarchy as ReadonlyMap<TypeId, readonly TypeId[]>,
      interface_implementations: this.interface_implementations as ReadonlyMap<TypeId, readonly TypeId[]>,
    };
  }
}

/**
 * Builder for creating ImportResolutionMap test data
 */
export class ImportResolutionMapBuilder {
  private imports = new Map<FilePath, Map<SymbolName, SymbolId>>();

  addImport(filePath: FilePath, importName: SymbolName, symbolId: SymbolId): this {
    if (!this.imports.has(filePath)) {
      this.imports.set(filePath, new Map());
    }
    this.imports.get(filePath)!.set(importName, symbolId);
    return this;
  }

  addFileImports(filePath: FilePath, imports: Map<SymbolName, SymbolId>): this {
    this.imports.set(filePath, imports);
    return this;
  }

  build(): ImportResolutionMap {
    const readonly_imports = new Map<FilePath, ReadonlyMap<SymbolName, SymbolId>>();
    for (const [filePath, fileImports] of this.imports) {
      readonly_imports.set(filePath, fileImports as ReadonlyMap<SymbolName, SymbolId>);
    }

    return {
      imports: readonly_imports as ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
    };
  }
}

/**
 * Builder for creating FunctionResolutionMap test data
 */
export class FunctionResolutionMapBuilder {
  private function_calls = new Map<LocationKey, SymbolId>();
  private calls_to_function = new Map<SymbolId, Location[]>();

  addFunctionCall(locationKey: LocationKey, functionSymbolId: SymbolId): this {
    this.function_calls.set(locationKey, functionSymbolId);
    return this;
  }

  addCallSite(functionSymbolId: SymbolId, callLocation: Location): this {
    if (!this.calls_to_function.has(functionSymbolId)) {
      this.calls_to_function.set(functionSymbolId, []);
    }
    this.calls_to_function.get(functionSymbolId)!.push(callLocation);
    return this;
  }

  build(): FunctionResolutionMap {
    return {
      function_calls: this.function_calls as ReadonlyMap<LocationKey, SymbolId>,
      calls_to_function: this.calls_to_function as ReadonlyMap<SymbolId, readonly Location[]>,
    };
  }
}

/**
 * Builder for creating MethodResolutionMap test data
 */
export class MethodResolutionMapBuilder {
  private method_calls = new Map<LocationKey, SymbolId>();
  private constructor_calls = new Map<LocationKey, SymbolId>();
  private calls_to_method = new Map<SymbolId, Location[]>();

  addMethodCall(locationKey: LocationKey, methodSymbolId: SymbolId): this {
    this.method_calls.set(locationKey, methodSymbolId);
    return this;
  }

  addConstructorCall(locationKey: LocationKey, constructorSymbolId: SymbolId): this {
    this.constructor_calls.set(locationKey, constructorSymbolId);
    return this;
  }

  addCallSite(methodSymbolId: SymbolId, callLocation: Location): this {
    if (!this.calls_to_method.has(methodSymbolId)) {
      this.calls_to_method.set(methodSymbolId, []);
    }
    this.calls_to_method.get(methodSymbolId)!.push(callLocation);
    return this;
  }

  build(): MethodResolutionMap {
    return {
      method_calls: this.method_calls as ReadonlyMap<LocationKey, SymbolId>,
      constructor_calls: this.constructor_calls as ReadonlyMap<LocationKey, SymbolId>,
      calls_to_method: this.calls_to_method as ReadonlyMap<SymbolId, readonly Location[]>,
    };
  }
}

// ============================================================================
// Convenience factory functions
// ============================================================================

/**
 * Create an empty TypeResolutionMap
 */
export function createEmptyTypeResolutionMap(): TypeResolutionMap {
  return new TypeResolutionMapBuilder().build();
}

/**
 * Create an empty ImportResolutionMap
 */
export function createEmptyImportResolutionMap(): ImportResolutionMap {
  return new ImportResolutionMapBuilder().build();
}

/**
 * Create an empty FunctionResolutionMap
 */
export function createEmptyFunctionResolutionMap(): FunctionResolutionMap {
  return new FunctionResolutionMapBuilder().build();
}

/**
 * Create an empty MethodResolutionMap
 */
export function createEmptyMethodResolutionMap(): MethodResolutionMap {
  return new MethodResolutionMapBuilder().build();
}

/**
 * Create a simple ImportResolutionMap with no imports for a file
 */
export function createEmptyFileImports(filePath: FilePath): ImportResolutionMap {
  return new ImportResolutionMapBuilder()
    .addFileImports(filePath, new Map())
    .build();
}

/**
 * Convert a regular Map to ReadonlyMap (type-safe cast)
 */
export function toReadonlyMap<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  return map as ReadonlyMap<K, V>;
}

/**
 * Create a mutable Map and then convert to ReadonlyMap
 */
export function createReadonlyMap<K, V>(entries?: readonly (readonly [K, V])[]): ReadonlyMap<K, V> {
  return new Map(entries) as ReadonlyMap<K, V>;
}

/**
 * Create a nested ReadonlyMap structure for type members
 */
export function createTypeMembersMap(
  entries: Array<[TypeId, Array<[SymbolName, SymbolId]>]>
): ReadonlyMap<TypeId, ReadonlyMap<SymbolName, SymbolId>> {
  const outerMap = new Map<TypeId, ReadonlyMap<SymbolName, SymbolId>>();

  for (const [typeId, memberEntries] of entries) {
    const innerMap = new Map(memberEntries);
    outerMap.set(typeId, innerMap as ReadonlyMap<SymbolName, SymbolId>);
  }

  return outerMap as ReadonlyMap<TypeId, ReadonlyMap<SymbolName, SymbolId>>;
}